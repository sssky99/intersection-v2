"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  conversationResultImageSrc,
  conversationResultOverview,
  conversationResults,
  type ConversationResultCode,
} from "@/data/conversationResults";
import { profileQuestions } from "@/data/profileQuestions";
import {
  identifyAnalyticsUser,
  trackEvent,
  trackLoginSuccessFromUrl,
} from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import type {
  ProfileQuestion,
  QuestionAnswer,
  QuestionOption,
  StoredAnswerRow,
} from "@/types/question";

type AnswerMap = Record<number, QuestionAnswer>;
type QuestionFlowMode = "guest" | "onboarding" | "preview" | "regeneration";

function conversationResultCode(answers: AnswerMap): ConversationResultCode {
  const axes = [
    { ids: [1, 2, 3, 4], left: "O", right: "I", tieBreaker: 2 },
    { ids: [5, 6, 7, 8], left: "L", right: "Q", tieBreaker: 5 },
    { ids: [9, 10, 11, 12], left: "H", right: "W", tieBreaker: 9 },
    { ids: [13, 14, 15, 16], left: "C", right: "E", tieBreaker: 13 },
  ] as const;

  if (axes.some(({ ids }) => ids.some((id) => !answers[id]))) return "OQHC";

  return axes
    .map(({ ids, left, right, tieBreaker }) => {
      const leftCount = ids.filter((id) => answers[id]?.value === left).length;
      const rightCount = ids.length - leftCount;
      if (leftCount === rightCount) {
        return answers[tieBreaker]?.value === left ? left : right;
      }
      return leftCount > rightCount ? left : right;
    })
    .join("") as ConversationResultCode;
}

function resultExplanation(body: string) {
  return (
    body.match(/## 결과 해설\s*([\s\S]*?)(?=\n## |$)/)?.[1]?.trim() ??
    body
  );
}

function FixedResultExplanation({ body }: { body: string }) {
  return (
    <div className="space-y-3">
      {body.split(/\n\s*\n/).map((block, index) => {
        const text = block.trim();
        if (!text) return null;
        if (text.startsWith("## ")) {
          return (
            <h2
              key={`${index}-${text}`}
              className="pb-1 pt-5 text-[19px] font-black tracking-[-0.04em] text-black/82 first:pt-0"
            >
              {text.slice(3)}
            </h2>
          );
        }
        if (text.startsWith("> ")) {
          return (
            <div
              key={`${index}-${text}`}
              className="rounded-[20px] border border-black/[0.07] bg-[#f7f7f5] px-4 py-4 text-[14px] font-semibold leading-6 tracking-[-0.02em] text-black/62"
            >
              {text.split("\n").map((line) => (
                <p key={line}>{line.replace(/^>\s?/, "")}</p>
              ))}
            </div>
          );
        }
        return (
          <p
            key={`${index}-${text}`}
            className="break-keep text-[14px] font-medium leading-6 tracking-[-0.02em] text-black/58"
          >
            {text}
          </p>
        );
      })}
    </div>
  );
}

const SCALE_VALUES = ["1", "2", "3", "4", "5"];
const AGE_RANGE_DEFAULT_YEARS = 4;
const AGE_RANGE_MIN_YEARS = 4;
const AGE_RANGE_MAX_YEARS = 10;
const AGE_RANGE_TRACK_MAX = AGE_RANGE_MAX_YEARS * 2;

type AgeRangeYears = {
  down: number;
  up: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isAgeRangeQuestion(question: ProfileQuestion) {
  return Boolean(
    question.options?.some((option) => {
      const value = typeof option === "string" ? option : option.value;
      return value.startsWith("age_range");
    }),
  );
}

function ageRangeAnswerValue({ down, up }: AgeRangeYears) {
  return `age_range_down_${down}_up_${up}`;
}

function ageRangeYearsFromAnswer(value: QuestionAnswer["value"] | undefined) {
  if (typeof value !== "string") {
    return {
      down: AGE_RANGE_DEFAULT_YEARS,
      up: AGE_RANGE_DEFAULT_YEARS,
    };
  }

  const splitMatch = /^age_range_down_(\d+)_up_(\d+)$/.exec(value);
  if (splitMatch) {
    return {
      down: clamp(
        Number(splitMatch[1]),
        AGE_RANGE_MIN_YEARS,
        AGE_RANGE_MAX_YEARS,
      ),
      up: clamp(
        Number(splitMatch[2]),
        AGE_RANGE_MIN_YEARS,
        AGE_RANGE_MAX_YEARS,
      ),
    };
  }

  const match = /^age_range_(\d+)$/.exec(value);
  const years = match ? Number(match[1]) : AGE_RANGE_DEFAULT_YEARS;
  const legacyYears = Number.isFinite(years)
    ? clamp(years, AGE_RANGE_MIN_YEARS, AGE_RANGE_MAX_YEARS)
    : AGE_RANGE_DEFAULT_YEARS;

  return {
    down: legacyYears,
    up: legacyYears,
  };
}

function defaultAgeRangeAnswer(question: ProfileQuestion): QuestionAnswer {
  return {
    questionId: question.id,
    value: ageRangeAnswerValue({
      down: AGE_RANGE_DEFAULT_YEARS,
      up: AGE_RANGE_DEFAULT_YEARS,
    }),
  };
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function optionValue(option: string | QuestionOption) {
  return typeof option === "string" ? option : option.value;
}

function optionLabel(option: string | QuestionOption) {
  return typeof option === "string" ? option : option.label;
}

function optionMeta(question: ProfileQuestion, value: string) {
  return question.options
    ?.map((option) =>
      typeof option === "string" ? { value: option, label: option } : option,
    )
    .find((option) => option.value === value);
}

function optionValues(question: ProfileQuestion) {
  return new Set((question.options ?? []).map((option) => optionValue(option)));
}

function rowToAnswer(
  row: StoredAnswerRow,
  questions: ProfileQuestion[],
): QuestionAnswer {
  const question = questions.find(
    (item) => (item.order ?? item.id) === row.question_order,
  );
  const storedValue = question
    ? row.answer_values ??
      (question.type === "text"
        ? row.answer_text ?? row.answer_value ?? ""
        : row.answer_value ?? "")
    : "";
  const value =
    question && isAgeRangeQuestion(question) && typeof storedValue === "string"
      ? storedValue
      : question?.type === "single_choice"
      ? typeof storedValue === "string" &&
        optionValues(question).has(storedValue)
        ? storedValue
        : ""
      : question?.type === "multi_choice"
        ? (Array.isArray(storedValue) ? storedValue : [storedValue])
            .filter((item): item is string => typeof item === "string")
            .filter((item) => optionValues(question).has(item))
        : storedValue;

  return {
    questionId: question?.id ?? row.question_order,
    value,
    otherText: row.other_text ?? undefined,
  };
}

function isComplete(question: ProfileQuestion, answer?: QuestionAnswer) {
  if (!answer) return false;

  const value = answer.value;
  const hasValue = Array.isArray(value)
    ? value.length > 0
    : Boolean(String(value).trim());

  if (!hasValue) return false;

  if (question.type === "text") {
    return typeof value === "string" && value.trim().length > 0;
  }

  const needsOther = Array.isArray(value)
    ? value.some((item) => optionMeta(question, item)?.hasTextInput)
    : typeof value === "string" && Boolean(optionMeta(question, value)?.hasTextInput);

  return !needsOther || Boolean(answer.otherText?.trim());
}

function toAnswerPayload(question: ProfileQuestion, answer: QuestionAnswer) {
  if (Array.isArray(answer.value)) {
    return {
      answer_value: null,
      answer_values: answer.value,
      answer_text: null,
    };
  }

  if (question.type === "text") {
    return {
      answer_value: null,
      answer_values: null,
      answer_text: String(answer.value),
    };
  }

  return {
    answer_value: String(answer.value),
    answer_values: null,
    answer_text: null,
  };
}

function answersToStoredRows(
  answers: AnswerMap,
  questions: ProfileQuestion[],
): StoredAnswerRow[] {
  return questions.flatMap((question) => {
    const answer = answers[question.id];
    if (!answer || !isComplete(question, answer)) return [];
    return [
      {
        question_order: question.order ?? question.id,
        ...toAnswerPayload(question, answer),
        other_text: answer.otherText?.trim() || null,
      },
    ];
  });
}

function initialIndexFromSearch(value: string | null, questionCount: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > questionCount) return null;
  return parsed - 1;
}

function StarProgress({
  completedParts,
  currentPart,
  large = false,
  celebratePart,
}: {
  completedParts: number;
  currentPart: number;
  large?: boolean;
  celebratePart?: number;
}) {
  const parts = [
    "20,20 15.59,13.93 20,2 24.41,13.93",
    "20,20 24.41,13.93 37.12,14.44 27.13,22.32",
    "20,20 27.13,22.32 30.58,34.56 20,27.5",
    "20,20 20,27.5 9.42,34.56 12.87,22.32",
    "20,20 12.87,22.32 2.88,14.44 15.59,13.93",
  ];
  const outline =
    "20,2 24.41,13.93 37.12,14.44 27.13,22.32 30.58,34.56 20,27.5 9.42,34.56 12.87,22.32 2.88,14.44 15.59,13.93";

  return (
    <motion.svg
      viewBox="0 0 40 38"
      className={large ? "h-28 w-28" : "h-8 w-9"}
      aria-hidden
      initial={large ? { opacity: 0, scale: 0.78, rotate: -5 } : false}
      animate={
        large
          ? { opacity: 1, scale: [0.78, 1.08, 1], rotate: 0 }
          : { scale: completedParts > 0 ? [1, 1.04, 1] : 1 }
      }
      transition={{ duration: large ? 0.7 : 0.35, ease: "easeOut" }}
    >
      {parts.map((points, index) => (
        <motion.polygon
          key={points}
          points={points}
          initial={
            celebratePart === index
              ? { fill: "#d5d5d0", stroke: "#d5d5d0" }
              : false
          }
          animate={{
            fill:
              index < completedParts
                ? "#121212"
                : index === currentPart
                  ? "#d5d5d0"
                  : "#ecece8",
            stroke:
              index < completedParts
                ? "#121212"
                : index === currentPart
                  ? "#d5d5d0"
                  : "#ecece8",
          }}
          transition={{
            duration: celebratePart === index ? 0.65 : 0.28,
            delay: celebratePart === index ? 0.28 : 0,
            ease: "easeOut",
          }}
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
      ))}
      <polygon
        points={outline}
        fill="none"
        stroke="#121212"
        strokeOpacity="0.28"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}

export function QuestionFlow({
  userId,
  initialRows,
  mode = "onboarding",
  onPreviewComplete,
  onGuestDraftChange,
  onGuestComplete,
}: {
  userId?: string;
  initialRows: StoredAnswerRow[];
  mode?: QuestionFlowMode;
  onPreviewComplete?: () => void;
  onGuestDraftChange?: (rows: StoredAnswerRow[]) => void;
  onGuestComplete?: (rows: StoredAnswerRow[]) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPreview = mode === "preview";
  const isGuest = mode === "guest";
  const isRegeneration = mode === "regeneration";
  const questions = profileQuestions;
  const initialAnswers = useMemo(
    () =>
      Object.fromEntries(
        initialRows
          .filter((row) =>
            questions.some(
              (question) =>
                (question.order ?? question.id) === row.question_order,
            ),
          )
          .map((row) => {
            const answer = rowToAnswer(row, questions);
            return [answer.questionId, answer];
          }),
      ) as AnswerMap,
    [initialRows, questions],
  );
  const firstIncomplete = questions.findIndex(
    (question) => !isComplete(question, initialAnswers[question.id]),
  );
  const requestedStartIndex = initialIndexFromSearch(
    searchParams.get("start"),
    questions.length,
  );
  const requestedResultCode = searchParams.get("result")?.toUpperCase();
  const previewResultCode =
    isPreview &&
    requestedResultCode &&
    requestedResultCode in conversationResults
      ? (requestedResultCode as ConversationResultCode)
      : null;
  const previewResultAnswers = previewResultCode
    ? (Object.fromEntries(
        Array.from({ length: 16 }, (_, index) => {
          const questionId = index + 1;
          const axisIndex = Math.floor(index / 4);
          return [
            questionId,
            { questionId, value: previewResultCode[axisIndex] },
          ];
        }),
      ) as AnswerMap)
    : null;
  const [questionIndex, setQuestionIndex] = useState(
    requestedStartIndex ??
      (isPreview
        ? 0
        : firstIncomplete === -1
          ? questions.length - 1
          : firstIncomplete),
  );
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<number | null>(null);
  const [resultAnswers, setResultAnswers] = useState<AnswerMap | null>(
    previewResultAnswers,
  );
  const [showResultDetails, setShowResultDetails] = useState(false);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const milestoneAnswersRef = useRef<AnswerMap | null>(null);
  const savingRef = useRef(false);
  const completionSubmittedRef = useRef(false);
  const trackedMilestonesRef = useRef<Set<string>>(new Set());
  const questionStartTrackedRef = useRef(false);
  const question = questions[questionIndex];
  const answer = answers[question.id];
  const selectedValues = Array.isArray(answer?.value) ? answer.value : [];
  const progressPercent = ((questionIndex + 1) / questions.length) * 100;
  const isAgeRange = isAgeRangeQuestion(question);
  const ageRangeYears = ageRangeYearsFromAnswer(answer?.value);
  const ageRangeDownTrackValue = AGE_RANGE_MAX_YEARS - ageRangeYears.down;
  const ageRangeUpTrackValue = AGE_RANGE_MAX_YEARS + ageRangeYears.up;
  const ageRangeDownPercent =
    (ageRangeDownTrackValue / AGE_RANGE_TRACK_MAX) * 100;
  const ageRangeUpPercent =
    (ageRangeUpTrackValue / AGE_RANGE_TRACK_MAX) * 100;
  const ageRangeTickMarks = [
    { value: 0, label: "10" },
    { value: 2, label: "8" },
    { value: 4, label: "6" },
    { value: 6, label: "4" },
    { value: 14, label: "4" },
    { value: 16, label: "6" },
    { value: 18, label: "8" },
    { value: 20, label: "10" },
  ];
  const canContinue = isAgeRange || isComplete(question, answer);
  const scaleOptions =
    question.type === "single_choice"
      ? SCALE_VALUES.map((value) =>
          question.options?.find((option) => optionValue(option) === value),
        ).filter(
          (option): option is string | QuestionOption => Boolean(option),
        )
      : [];
  const usesNumericScale = scaleOptions.length === SCALE_VALUES.length;
  const hideNumericScaleValues = false;

  useEffect(() => {
    if (isPreview || isGuest || isRegeneration) return;
    trackLoginSuccessFromUrl("new");
  }, [isGuest, isPreview, isRegeneration]);

  useEffect(() => {
    if (isPreview || isGuest || !userId) return;
    identifyAnalyticsUser(userId);
  }, [isGuest, isPreview, userId]);

  useEffect(() => {
    if (isPreview || isRegeneration || questionStartTrackedRef.current) return;

    questionStartTrackedRef.current = true;
    trackEvent("question_start", {
      question_count: questions.length,
    });
  }, [isPreview, isRegeneration, questions.length]);

  const trackQuestionAnswered = (targetQuestion: ProfileQuestion) => {
    if (isPreview || isRegeneration) return;

    trackEvent("question_answered", {
      question_order: targetQuestion.order ?? targetQuestion.id,
      question_type: targetQuestion.type,
      category: targetQuestion.category,
    });
  };

  const trackQuestionMilestone = (
    key: string,
    eventName: string,
    targetQuestions: ProfileQuestion[],
    nextAnswers: AnswerMap,
  ) => {
    if (
      targetQuestions.length === 0 ||
      trackedMilestonesRef.current.has(key) ||
      !targetQuestions.every((item) => isComplete(item, nextAnswers[item.id]))
    ) {
      return;
    }

    trackedMilestonesRef.current.add(key);
    trackEvent(eventName, {
      question_count: targetQuestions.length,
    });
  };

  const trackQuestionMilestones = (nextAnswers: AnswerMap) => {
    if (isPreview || isRegeneration) return;

    trackQuestionMilestone(
      "choice_questions_complete",
      "choice_questions_complete",
      questions.filter((item) => item.type !== "text"),
      nextAnswers,
    );
    trackQuestionMilestone(
      "text_questions_complete",
      "text_questions_complete",
      questions.filter((item) => item.type === "text"),
      nextAnswers,
    );
  };

  const saveAnswer = async (
    targetQuestion: ProfileQuestion,
    nextAnswer: QuestionAnswer,
  ) => {
    if (isPreview) return;
    if (!userId) throw new Error("QuestionFlow requires userId in onboarding mode.");

    const { error: saveError } = await createClient()
      .from(isRegeneration ? "profile_regeneration_answers" : "user_answers")
      .upsert(
        {
          user_id: userId,
          question_order: targetQuestion.order ?? targetQuestion.id,
          category: targetQuestion.category,
          question_type: targetQuestion.type,
          ...toAnswerPayload(targetQuestion, nextAnswer),
          other_text: nextAnswer.otherText?.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,question_order" },
      );

    if (saveError) throw new Error(saveError.message);
  };

  const answerMapWith = (nextAnswer: QuestionAnswer) => ({
    ...answers,
    [nextAnswer.questionId]: nextAnswer,
  });

  const beginSaving = () => {
    if (savingRef.current) return false;

    savingRef.current = true;
    setSaving(true);
    return true;
  };

  const endSaving = () => {
    savingRef.current = false;
    setSaving(false);
  };

  const completeOrMoveNext = async (nextAnswers: AnswerMap) => {
    const missingIndex = questions.findIndex(
      (item) => !isComplete(item, nextAnswers[item.id]),
    );

    if (missingIndex !== -1) {
      setQuestionIndex(missingIndex);
      return;
    }

    if (completionSubmittedRef.current) return;
    completionSubmittedRef.current = true;

    if (isGuest) {
      onGuestComplete?.(answersToStoredRows(nextAnswers, questions));
      return;
    }

    if (!userId) {
      completionSubmittedRef.current = false;
      throw new Error("QuestionFlow requires userId in onboarding mode.");
    }

    const response = await fetch("/api/profile/questions/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: isRegeneration ? "regeneration" : "onboarding" }),
    }).catch(() => null);

    if (!response?.ok) {
      completionSubmittedRef.current = false;
      throw new Error("Profile question completion failed.");
    }

    if (!isRegeneration) {
      trackEvent("questions_complete", {
        question_count: questions.length,
      });
    }

    router.replace(
      isRegeneration
        ? "/onboarding/profile?regenerate=1"
        : "/onboarding/profile",
    );
    router.refresh();
  };

  const moveToNext = async (nextAnswers: AnswerMap) => {
    if (questionIndex >= questions.length - 1) {
      setResultAnswers(nextAnswers);
      if (isPreview) onPreviewComplete?.();
      return;
    }

    setQuestionIndex((current) => Math.min(questions.length - 1, current + 1));
  };

  const showMilestoneOrMoveNext = async (nextAnswers: AnswerMap) => {
    const completedQuestionCount = questionIndex + 1;
    if (completedQuestionCount % 4 === 0) {
      milestoneAnswersRef.current = nextAnswers;
      setMilestone(completedQuestionCount / 4);
      return;
    }

    await moveToNext(nextAnswers);
  };

  const updateLocalAnswer = (nextAnswer: QuestionAnswer) => {
    const nextAnswers = answerMapWith(nextAnswer);
    setAnswers(nextAnswers);
    if (isGuest) {
      onGuestDraftChange?.(answersToStoredRows(nextAnswers, questions));
    }
    return nextAnswers;
  };

  const scheduleAutoAdvance = (nextAnswers: AnswerMap, delayMs: number) => {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
    }

    autoAdvanceTimerRef.current = window.setTimeout(() => {
      autoAdvanceTimerRef.current = null;
      void showMilestoneOrMoveNext(nextAnswers).finally(() => {
        if (!completionSubmittedRef.current) endSaving();
      });
    }, delayMs);
  };

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  const selectSingle = async (value: string) => {
    if (!beginSaving()) return;

    const nextAnswer = { questionId: question.id, value };
    const nextAnswers = answerMapWith(nextAnswer);
    const nextDelay = 420;

    updateLocalAnswer(nextAnswer);
    setError(null);

    if (isPreview) {
      scheduleAutoAdvance(nextAnswers, nextDelay);
      return;
    }

    if (isGuest) {
      trackQuestionAnswered(question);
      trackQuestionMilestones(nextAnswers);
      scheduleAutoAdvance(nextAnswers, nextDelay);
      return;
    }

    try {
      await saveAnswer(question, nextAnswer);
      trackQuestionAnswered(question);
      trackQuestionMilestones(nextAnswers);
      scheduleAutoAdvance(nextAnswers, nextDelay);
    } catch (saveError) {
      console.error("Failed to save onboarding answer:", saveError);
      setError("답변 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      endSaving();
    }
  };

  const selectAgeRange = (direction: keyof AgeRangeYears, years: number) => {
    const nextYears = {
      ...ageRangeYears,
      [direction]: clamp(years, AGE_RANGE_MIN_YEARS, AGE_RANGE_MAX_YEARS),
    };

    setError(null);
    updateLocalAnswer({
      questionId: question.id,
      value: ageRangeAnswerValue(nextYears),
    });
  };

  const toggleMultiple = (value: string) => {
    const selectedOption = optionMeta(question, value);
    const exclusiveValues =
      question.options
        ?.filter(
          (option) => typeof option !== "string" && Boolean(option.exclusive),
        )
        .map(optionValue) ?? [];

    const pairedQuestionId = question.id === 17 ? 18 : question.id === 18 ? 17 : null;
    const pairedValues = pairedQuestionId
      ? answers[pairedQuestionId]?.value
      : undefined;
    if (
      !selectedOption?.exclusive &&
      Array.isArray(pairedValues) &&
      pairedValues.includes(value) &&
      !selectedValues.includes(value)
    ) {
      setError(
        question.id === 17
          ? "피하고 싶은 활동으로도 선택한 항목이에요. 한쪽 선택을 먼저 해제해주세요."
          : "하고 싶은 활동으로도 선택한 항목이에요. 한쪽 선택을 먼저 해제해주세요.",
      );
      return;
    }

    let nextValues: string[];
    if (selectedOption?.exclusive) {
      nextValues = [value];
    } else {
      const withoutExclusive = selectedValues.filter(
        (item) => !exclusiveValues.includes(item),
      );
      const alreadySelected = withoutExclusive.includes(value);

      if (
        !alreadySelected &&
        question.maxSelections &&
        withoutExclusive.length >= question.maxSelections
      ) {
        setError(`최대 ${question.maxSelections}개까지 선택할 수 있어요.`);
        return;
      }

      nextValues = alreadySelected
        ? withoutExclusive.filter((item) => item !== value)
        : [...withoutExclusive, value];
    }

    setError(null);
    updateLocalAnswer({
      questionId: question.id,
      value: nextValues,
      otherText: nextValues.some(
        (item) => optionMeta(question, item)?.hasTextInput,
      )
        ? answer?.otherText
        : undefined,
    });
  };

  const continueQuestion = async () => {
    const answerToContinue =
      answer ?? (isAgeRange ? defaultAgeRangeAnswer(question) : undefined);

    if (!answerToContinue || !canContinue || !beginSaving()) return;

    const nextAnswers = {
      ...answers,
      [answerToContinue.questionId]: answerToContinue,
    };
    updateLocalAnswer(answerToContinue);
    setError(null);

    if (isGuest) {
      trackQuestionAnswered(question);
      trackQuestionMilestones(nextAnswers);
      await showMilestoneOrMoveNext(nextAnswers);
      endSaving();
      return;
    }

    try {
      await saveAnswer(question, answerToContinue);
      trackQuestionAnswered(question);
      trackQuestionMilestones(nextAnswers);
      await showMilestoneOrMoveNext(nextAnswers);
    } catch (saveError) {
      console.error("Failed to save onboarding answer:", saveError);
      setError("답변 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      if (!completionSubmittedRef.current) endSaving();
    }
  };

  const isConversationQuestion = (question.order ?? question.id) <= 16;
  const completedStarParts = Math.min(5, Math.floor(questionIndex / 4));
  const currentStarPart = Math.min(4, Math.floor(questionIndex / 4));
  const milestoneMessages = [
    {
      title: "좋아요, 잘 진행하고 있어요.",
      body: "첫 번째 별 조각이 채워졌어요.\n지금처럼 평소의 모습에 가까운 쪽을 골라주세요.",
    },
    {
      title: "좋은 흐름이에요.",
      body: "당신이 대화를 이어가는 방식이\n조금씩 선명해지고 있어요.",
    },
    {
      title: "어느새 절반을 넘었어요.",
      body: "답변이 차곡차곡 모이고 있어요.\n조금만 더 당신의 이야기를 들려주세요.",
    },
    {
      title: "이제 거의 다 왔어요.",
      body: "마지막으로 좋아하는 활동과\n요즘의 이야기를 들려주세요.",
    },
    {
      title: "별이 모두 완성됐어요.",
      body: "답변을 바탕으로 당신의 대화 결과를\n차분히 정리해볼게요.",
    },
  ] as const;

  if (resultAnswers) {
    const resultCode = conversationResultCode(resultAnswers);
    const result = conversationResults[resultCode];
    return (
      <section className="relative flex min-h-dvh flex-col overflow-y-auto bg-[#f7f7f5] px-6 pb-[calc(120px+env(safe-area-inset-bottom))] pt-[calc(54px+env(safe-area-inset-top))] text-[#121212] md:min-h-[calc(100dvh-32px)]">
        <div className="pointer-events-none absolute -right-24 top-24 h-64 w-64 rounded-full bg-accent/15 blur-[80px]" />
        <div className="pointer-events-none absolute -left-20 bottom-28 h-52 w-52 rounded-full bg-[#e8d9c6]/45 blur-[70px]" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 flex flex-1 flex-col"
        >
          <div className="rounded-[26px] border border-black/[0.08] bg-white/70 p-5 shadow-[0_18px_50px_rgba(18,18,18,0.06)] backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.45, ease: "easeOut" }}
              className="grid grid-cols-[168px_minmax(0,1fr)] items-center gap-2"
            >
              <div className="flex h-[298px] items-center justify-center overflow-hidden">
                <Image
                  src={conversationResultImageSrc[resultCode]}
                  alt={`${result.title} 일러스트`}
                  width={941}
                  height={1671}
                  priority
                  className="h-full w-auto object-contain mix-blend-multiply"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[-0.01em] text-black/38">
                  나의 대화 결과 · {resultCode}
                </p>
                <h1 className="mt-3 break-keep text-[26px] font-black leading-[1.15] tracking-[-0.055em] text-black/88">
                  {result.title}
                </h1>
                <p className="mt-3 break-keep text-[14px] font-semibold leading-[1.65] tracking-[-0.025em] text-black/48">
                  {result.subtitle}
                </p>
              </div>
            </motion.div>
            <p className="mt-4 border-t border-black/[0.07] pt-5 break-keep text-[14px] font-medium leading-6 tracking-[-0.02em] text-black/62">
              {conversationResultOverview(result.body)}
            </p>
          </div>

          <button
            type="button"
            aria-expanded={showResultDetails}
            onClick={() => setShowResultDetails((current) => !current)}
            className="mt-4 flex h-13 w-full items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white/55 px-5 py-4 text-[14px] font-extrabold text-black/64 transition hover:border-black/20"
          >
            {showResultDetails ? "결과 해설 접기" : "내 결과 자세히 보기"}
            <ChevronRight
              size={16}
              aria-hidden
              className={`transition-transform ${showResultDetails ? "rotate-90" : ""}`}
            />
          </button>

          <AnimatePresence initial={false}>
            {showResultDetails && (
              <motion.article
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.38, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-4 rounded-[26px] border border-black/[0.08] bg-white/72 p-5 shadow-[0_18px_50px_rgba(18,18,18,0.05)] backdrop-blur-sm">
                  <h2 className="mb-4 text-[19px] font-black tracking-[-0.04em] text-black/82">
                    결과 해설
                  </h2>
                  <FixedResultExplanation
                    body={resultExplanation(result.body)}
                  />
                </div>
              </motion.article>
            )}
          </AnimatePresence>

        </motion.div>
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] bg-gradient-to-t from-[#f7f7f5] via-[#f7f7f5]/98 to-transparent px-6 pb-[max(18px,env(safe-area-inset-bottom))] pt-5 md:bottom-4">
          {error && (
            <p className="mb-2 text-center text-[12px] font-semibold text-red-600">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (isPreview) {
                router.push("/onboarding/profile");
                return;
              }
              if (!beginSaving()) return;
              setError(null);
              void completeOrMoveNext(resultAnswers)
                .catch((completionError) => {
                  console.error(
                    "Failed to complete profile questions:",
                    completionError,
                  );
                  setError(
                    "답변 완료 처리에 실패했어요. 잠시 후 다시 시도해주세요.",
                  );
                })
                .finally(() => {
                  if (!completionSubmittedRef.current) endSaving();
                });
            }}
            className="flex h-14 w-full items-center justify-center rounded-full bg-black text-[16px] font-extrabold text-white shadow-[0_16px_42px_rgba(18,18,18,0.16)] transition active:scale-[0.98] disabled:opacity-45"
          >
            {saving ? "프로필로 이동하는 중..." : "프로필 작성하기"}
          </button>
        </div>
      </section>
    );
  }

  if (milestone !== null) {
    const message = milestoneMessages[milestone - 1];
    const isLastMilestone = milestone === 5;

    return (
      <section className="relative flex min-h-dvh flex-col overflow-hidden bg-[#f7f7f5] px-6 pb-[calc(18px+env(safe-area-inset-bottom))] pt-[calc(18px+env(safe-area-inset-top))] text-[#121212] md:min-h-[calc(100dvh-32px)]">
        <div className="pointer-events-none absolute -right-24 top-24 h-64 w-64 rounded-full bg-accent/15 blur-[80px]" />
        <div className="pointer-events-none absolute -left-20 bottom-28 h-52 w-52 rounded-full bg-[#e8d9c6]/45 blur-[70px]" />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
          <StarProgress
            completedParts={milestone}
            currentPart={-1}
            large
            celebratePart={milestone - 1}
          />
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.42, ease: "easeOut" }}
            className="mt-10"
          >
            <p className="text-[12px] font-bold text-black/35">
              {milestone * 4} / {questions.length}
            </p>
            <h1 className="mt-3 break-keep text-[25px] font-black leading-[1.25] tracking-[-0.055em] text-black/86">
              {message.title}
            </h1>
            <p className="mt-4 whitespace-pre-line break-keep text-[14px] font-semibold leading-6 tracking-[-0.02em] text-black/48">
              {message.body}
            </p>
          </motion.div>
        </div>
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.58, duration: 0.35 }}
          onClick={() => {
            const nextAnswers = milestoneAnswersRef.current ?? answers;
            setMilestone(null);
            void moveToNext(nextAnswers);
          }}
          className="relative z-10 flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-black text-[16px] font-extrabold text-white shadow-[0_16px_42px_rgba(18,18,18,0.16)] transition active:scale-[0.98]"
        >
          {isLastMilestone ? "결과 확인하기" : "계속하기"}
          <ChevronRight size={17} aria-hidden />
        </motion.button>
      </section>
    );
  }

  return (
    <section className="relative flex min-h-dvh flex-col overflow-y-auto bg-[#f7f7f5] px-6 pb-5 pt-[calc(14px+env(safe-area-inset-top))] text-[#121212] md:min-h-[calc(100dvh-32px)]">
      <div className="pointer-events-none absolute -right-24 top-24 h-64 w-64 rounded-full bg-accent/15 blur-[80px]" />
      <div className="pointer-events-none absolute -left-20 bottom-28 h-52 w-52 rounded-full bg-[#e8d9c6]/45 blur-[70px]" />
      <header className="relative z-10 shrink-0">
        <div className="grid grid-cols-[42px_1fr_42px] items-center">
          <button
            type="button"
            aria-label="이전 질문"
            disabled={questionIndex === 0 || saving}
            onClick={() => {
              setError(null);
              setQuestionIndex((current) => Math.max(0, current - 1));
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-black/55 transition hover:bg-black/[0.04] disabled:opacity-0"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <div className="flex items-center justify-center gap-2">
            <StarProgress
              completedParts={completedStarParts}
              currentPart={currentStarPart}
            />
            <span className="text-[13px] font-bold tabular-nums text-black/45">
              {questionIndex + 1} / {questions.length}
            </span>
          </div>
          <div />
        </div>
        <p className="mt-1 text-center text-[11px] font-semibold tracking-[-0.01em] text-black/38">
          {isConversationQuestion
            ? "평소의 나에게 더 가까운 쪽을 골라주세요."
            : "솔직하게 답할수록 더 편안한 자리를 준비할 수 있어요."}
        </p>
        <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-black/[0.07]">
          <motion.div
            className="h-full rounded-full bg-black/70"
            initial={false}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="relative z-10 flex flex-1 flex-col"
        >
          <div className={cn("text-center", isConversationQuestion ? "mt-[12vh]" : "mt-10")}>
            <h1 className="mx-auto max-w-[350px] whitespace-pre-line break-keep text-[25px] font-black leading-[1.34] tracking-[-0.055em] text-black/86">
              {question.question}
            </h1>
            {question.prompt && (
              <p className="mx-auto mt-3 max-w-[330px] whitespace-pre-line text-[13px] font-semibold leading-5 text-black/42">
                {question.prompt}
              </p>
            )}
            {question.description && (
              <p className="mx-auto mt-3 max-w-[340px] whitespace-pre-line break-keep text-[13px] font-semibold leading-6 text-black/45">
                {question.description}
              </p>
            )}
          </div>

          {question.type === "single_choice" && (
            <div className="my-auto space-y-4 pb-10 pt-10">
              {(question.options ?? []).map((option, index) => {
                const value = optionValue(option);
                const selected = answer?.value === value;
                return (
                  <motion.button
                    key={value}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + index * 0.07 }}
                    whileTap={!saving ? { scale: 0.985 } : undefined}
                    disabled={saving}
                    onClick={() => void selectSingle(value)}
                    className={cn(
                      "flex min-h-[84px] w-full items-center justify-center rounded-[24px] border px-5 py-4 text-center text-[14px] font-semibold leading-[1.55] tracking-[-0.02em] backdrop-blur transition disabled:cursor-wait",
                      selected
                        ? "border-black bg-black font-extrabold text-white shadow-[0_16px_42px_rgba(18,18,18,0.16)]"
                        : "border-black/[0.07] bg-white/68 text-black/68 shadow-[0_12px_35px_rgba(18,18,18,0.045)] hover:border-black/15",
                    )}
                  >
                    <span className="max-w-[310px]">{optionLabel(option)}</span>
                  </motion.button>
                );
              })}
            </div>
          )}

          {question.type === "multi_choice" && (
            <div className="mt-8 grid grid-cols-2 gap-3 pb-24">
              {(question.options ?? []).map((option) => {
                const value = optionValue(option);
                const priorityIndex = selectedValues.indexOf(value);
                const selected = priorityIndex !== -1;
                const exclusive = optionMeta(question, value)?.exclusive;
                return (
                  <motion.button
                    key={value}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleMultiple(value)}
                    className={cn(
                      "relative flex min-h-[76px] items-center justify-center rounded-[22px] border px-3 py-4 text-center text-[13px] font-bold leading-5 backdrop-blur transition",
                      exclusive && "col-span-2 min-h-[58px]",
                      selected
                        ? "border-black bg-black font-extrabold text-white shadow-[0_14px_32px_rgba(18,18,18,0.14)]"
                        : "border-black/[0.07] bg-white/65 text-black/65 shadow-[0_10px_28px_rgba(18,18,18,0.04)]",
                    )}
                  >
                    {optionLabel(option)}
                    {selected && !exclusive && (
                      <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white/18 px-1 text-[9px] font-black text-white">
                        {priorityIndex + 1}
                      </span>
                    )}
                    {selected && exclusive && <Check className="ml-2" size={15} />}
                  </motion.button>
                );
              })}
            </div>
          )}

          {question.type === "text" && (
            <div className="mt-8 pb-24">
              <textarea
                value={typeof answer?.value === "string" ? answer.value : ""}
                placeholder={question.placeholder ?? "편하게 적어주세요."}
                maxLength={300}
                onChange={(event) =>
                  updateLocalAnswer({
                    questionId: question.id,
                    value: event.target.value,
                  })
                }
                className="min-h-[210px] w-full resize-none rounded-[28px] border border-black/[0.07] bg-white/68 px-5 py-5 text-[14px] font-medium leading-6 text-black/75 shadow-[0_18px_50px_rgba(18,18,18,0.055)] backdrop-blur outline-none placeholder:text-black/28 focus:border-black/20"
              />
              <p className="mt-2 pr-1 text-right text-[10px] font-semibold text-black/30">
                {typeof answer?.value === "string" ? answer.value.length : 0}/300
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <p className="fixed bottom-24 left-1/2 z-20 w-[calc(100%-48px)] max-w-[382px] -translate-x-1/2 rounded-2xl bg-black px-4 py-3 text-center text-xs font-semibold leading-5 text-white shadow-lg">
          {error}
        </p>
      )}

      {question.type !== "single_choice" && (
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-[430px] bg-gradient-to-t from-[#f7f7f5] via-[#f7f7f5]/96 to-transparent px-6 pb-[calc(16px+env(safe-area-inset-bottom))] pt-7">
          <button
            type="button"
            disabled={!canContinue || saving}
            onClick={() => void continueQuestion()}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-black text-[16px] font-extrabold text-white shadow-[0_16px_42px_rgba(18,18,18,0.16)] transition active:scale-[0.98] disabled:bg-black/10 disabled:text-black/30 disabled:shadow-none"
          >
            {saving ? "답변을 저장하고 있어요" : questionIndex === questions.length - 1 ? "결과 확인하기" : "다음"}
            {!saving && <ChevronRight size={17} aria-hidden />}
          </button>
        </div>
      )}
    </section>
  );
}
