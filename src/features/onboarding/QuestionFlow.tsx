"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { profileQuestions, questionCategories } from "@/data/profileQuestions";
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
  const [questionIndex, setQuestionIndex] = useState(
    isPreview
      ? 0
      : requestedStartIndex ??
          (firstIncomplete === -1 ? questions.length - 1 : firstIncomplete),
  );
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
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
    if (isPreview) {
      if (questionIndex >= questions.length - 1) {
        onPreviewComplete?.();
        return;
      }

      setQuestionIndex((current) => Math.min(questions.length - 1, current + 1));
      return;
    }

    if (questionIndex >= questions.length - 1) {
      await completeOrMoveNext(nextAnswers);
      return;
    }

    setQuestionIndex((current) => Math.min(questions.length - 1, current + 1));
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
      void moveToNext(nextAnswers).finally(() => {
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
      await moveToNext(nextAnswers);
      endSaving();
      return;
    }

    try {
      await saveAnswer(question, answerToContinue);
      trackQuestionAnswered(question);
      trackQuestionMilestones(nextAnswers);
      await moveToNext(nextAnswers);
    } catch (saveError) {
      console.error("Failed to save onboarding answer:", saveError);
      setError("답변 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      if (!completionSubmittedRef.current) endSaving();
    }
  };

  const categoryLabel =
    questionCategories.find((category) => category.key === question.category)
      ?.label ?? question.category;

  return (
    <section className="relative flex min-h-dvh flex-col px-5 pb-5 pt-7 md:min-h-[calc(100dvh-32px)]">
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                질문 진행도 {questionIndex + 1}/{questions.length}
              </span>
              <span className="text-[10px] font-semibold text-black/35">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/5">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={false}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          <div className="mb-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
              {categoryLabel}
            </span>
            <h1 className="mt-2 whitespace-pre-line text-xl font-bold leading-8 tracking-tight text-black">
              {question.question}
            </h1>
            {question.scaleLabel && !usesNumericScale && (
              <p className="mt-2 text-[11px] font-semibold text-black/35">
                {question.scaleLabel}
              </p>
            )}
            {question.description && (
              <p className="mt-2 whitespace-pre-line text-xs leading-5 text-black/45">
                {question.description}
              </p>
            )}
          </div>

          {question.type === "single_choice" && usesNumericScale && (
            <div className="space-y-2">
              {scaleOptions.map((option) => {
                const value = optionValue(option);
                const selected = answer?.value === value;

                return (
                  <motion.button
                    key={value}
                    type="button"
                    whileTap={!saving ? { scale: 0.98 } : undefined}
                    disabled={saving}
                    onClick={() => void selectSingle(value)}
                    aria-label={
                      hideNumericScaleValues
                        ? optionLabel(option)
                        : `${value}. ${optionLabel(option)}`
                    }
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold leading-5 transition-all disabled:cursor-wait",
                      selected
                        ? "border-black bg-black text-white shadow-sm"
                        : "border-black/10 bg-white text-black/70 hover:border-black/20",
                    )}
                  >
                    {!hideNumericScaleValues && (
                      <span className="shrink-0 text-xs font-extrabold tabular-nums opacity-55">
                        {value}.
                      </span>
                    )}
                    <span className="flex-1">{optionLabel(option)}</span>
                    {selected && <Check size={16} aria-hidden />}
                  </motion.button>
                );
              })}
            </div>
          )}

          {question.type === "single_choice" && isAgeRange && (
            <div className="rounded-[28px] border border-black/10 bg-white px-5 py-7 shadow-[0_18px_46px_rgba(0,0,0,0.045)]">
              <div className="mx-auto flex min-h-[154px] max-w-[300px] flex-col justify-center rounded-[26px] border border-black/10 bg-[#f8f8f5] px-5 py-6 text-center shadow-[0_16px_38px_rgba(0,0,0,0.045)]">
                <p className="whitespace-pre-line text-[22px] font-extrabold leading-[1.34] tracking-[-0.035em] text-black">
                  아래로 {ageRangeYears.down}살{"\n"}
                  위로 {ageRangeYears.up}살{"\n"}
                  까지 가능해요.
                </p>
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between px-1 text-[12px] font-black text-accent">
                  <span>아래로</span>
                  <span>위로</span>
                </div>
              </div>

              <div className="relative mt-3 min-h-[86px] px-1 pt-8">
                <div
                  aria-hidden="true"
                  className="absolute inset-x-1 top-[35px] h-2 rounded-full bg-black/[0.07]"
                />
                <div
                  aria-hidden="true"
                  className="absolute top-[35px] h-2 rounded-full bg-accent"
                  style={{
                    left: `${ageRangeDownPercent}%`,
                    width: `${ageRangeUpPercent - ageRangeDownPercent}%`,
                  }}
                />
                {ageRangeTickMarks.map((tick) => {
                  const percent = (tick.value / AGE_RANGE_TRACK_MAX) * 100;

                  return (
                    <span
                      key={`${tick.value}-${tick.label}`}
                      aria-hidden="true"
                      className="absolute top-[31px] flex -translate-x-1/2 flex-col items-center gap-2 text-[10px] font-black tabular-nums text-black/38"
                      style={{ left: `${percent}%` }}
                    >
                      <span className="h-4 w-px bg-black/12" />
                      <span>{tick.label}</span>
                    </span>
                  );
                })}
                <input
                  type="range"
                  min={0}
                  max={AGE_RANGE_TRACK_MAX}
                  step={1}
                  value={ageRangeDownTrackValue}
                  disabled={saving}
                  aria-label={`아래로 ${ageRangeYears.down}살까지 허용`}
                  onChange={(event) => {
                    const trackValue = clamp(
                      Number(event.currentTarget.value),
                      0,
                      AGE_RANGE_MAX_YEARS - AGE_RANGE_MIN_YEARS,
                    );
                    selectAgeRange("down", AGE_RANGE_MAX_YEARS - trackValue);
                  }}
                  className="pointer-events-none absolute inset-x-0 top-[25px] z-20 h-7 w-full appearance-none bg-transparent outline-none disabled:opacity-60 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-black [&::-moz-range-thumb]:shadow-[0_5px_14px_rgba(0,0,0,0.2)] [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:shadow-[0_5px_14px_rgba(0,0,0,0.2)]"
                />
                <input
                  type="range"
                  min={0}
                  max={AGE_RANGE_TRACK_MAX}
                  step={1}
                  value={ageRangeUpTrackValue}
                  disabled={saving}
                  aria-label={`위로 ${ageRangeYears.up}살까지 허용`}
                  onChange={(event) => {
                    const trackValue = clamp(
                      Number(event.currentTarget.value),
                      AGE_RANGE_MAX_YEARS + AGE_RANGE_MIN_YEARS,
                      AGE_RANGE_TRACK_MAX,
                    );
                    selectAgeRange("up", trackValue - AGE_RANGE_MAX_YEARS);
                  }}
                  className="pointer-events-none absolute inset-x-0 top-[25px] z-30 h-7 w-full appearance-none bg-transparent outline-none disabled:opacity-60 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-black [&::-moz-range-thumb]:shadow-[0_5px_14px_rgba(0,0,0,0.2)] [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:shadow-[0_5px_14px_rgba(0,0,0,0.2)]"
                />
              </div>
            </div>
          )}

          {question.type === "single_choice" && !usesNumericScale && !isAgeRange && (
            <div className="space-y-2">
              {(question.options ?? []).map((option) => {
                const value = optionValue(option);
                const selected = answer?.value === value;

                return (
                  <motion.button
                    key={value}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    disabled={saving}
                    onClick={() => void selectSingle(value)}
                    className={cn(
                      "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold leading-5 transition-all disabled:cursor-wait",
                      selected
                        ? "border-black bg-black text-white shadow-sm"
                        : "border-black/10 bg-white text-black/70 hover:border-black/20",
                    )}
                  >
                    <span className="flex-1">{optionLabel(option)}</span>
                    {selected && <Check size={16} aria-hidden />}
                  </motion.button>
                );
              })}
            </div>
          )}

          {question.type === "multi_choice" && (
            <div className="space-y-3">
              <div className="space-y-2">
                {(question.options ?? []).map((option) => {
                  const value = optionValue(option);
                  const priorityIndex = selectedValues.indexOf(value);
                  const selected = priorityIndex !== -1;

                  return (
                    <motion.button
                      key={value}
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => toggleMultiple(value)}
                      className={cn(
                        "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold leading-5 transition-all",
                        selected
                          ? "border-black bg-black text-white shadow-sm"
                          : "border-black/10 bg-white text-black/70 hover:border-black/20",
                      )}
                    >
                      <span>{optionLabel(option)}</span>
                      {selected ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/14 px-2 py-1 text-[10px] font-black text-current">
                          {priorityIndex + 1}순위
                          <Check size={12} aria-hidden />
                        </span>
                      ) : null}
                    </motion.button>
                  );
                })}
              </div>

              {selectedValues.some(
                (value) => optionMeta(question, value)?.hasTextInput,
              ) && (
                <input
                  value={answer?.otherText ?? ""}
                  placeholder="직접 입력해주세요."
                  onChange={(event) =>
                    updateLocalAnswer({
                      questionId: question.id,
                      value: selectedValues,
                      otherText: event.target.value,
                    })
                  }
                  className="h-11 w-full rounded-xl border border-black/10 bg-white px-3.5 text-xs outline-none focus:border-accent"
                />
              )}
            </div>
          )}

          {question.type === "text" && (
            <div>
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
                className="min-h-[210px] w-full resize-none rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm leading-6 outline-none placeholder:text-black/25 focus:border-accent"
              />
              <p className="mt-2 text-right text-[10px] font-semibold text-black/32">
                {typeof answer?.value === "string" ? answer.value.length : 0}/300
              </p>
              {question.examples && question.examples.length > 0 && (
                <div className="mt-5 border border-[#eadfc8] bg-[#fff8ea] shadow-[4px_4px_0_rgba(0,0,0,0.035)]">
                  {question.examples.map((example) => {
                    const exampleText = example.replace(/^예:\s*/, "");

                    return (
                      <div
                        key={example}
                        className="grid grid-cols-[18px_1fr] gap-2 border-b border-[#eadfc8]/70 px-3 py-2.5 text-[11px] font-semibold leading-5 text-black/52 last:border-b-0"
                      >
                        <span className="pt-px text-[12px]" aria-hidden>
                          📌
                        </span>
                        <p>{exampleText}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 mt-auto flex items-center justify-between bg-white/95 pb-[calc(4px+env(safe-area-inset-bottom))] pt-5 backdrop-blur">
        <button
          type="button"
          aria-label="이전 질문"
          disabled={questionIndex === 0 || saving}
          onClick={() => {
            setError(null);
            setQuestionIndex((current) => Math.max(0, current - 1));
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full text-black/55 disabled:text-black/15"
        >
          <ChevronLeft size={19} aria-hidden />
        </button>

        {(question.type === "multi_choice" || question.type === "text" || isAgeRange) && (
          <button
            type="button"
            aria-label={saving ? "답변 저장 중" : "다음 질문"}
            disabled={!canContinue || saving}
            onClick={() => void continueQuestion()}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full transition",
              canContinue && !saving
                ? "text-black/60 hover:text-black"
                : "text-black/18",
            )}
          >
            <ChevronRight
              size={20}
              aria-hidden
              className={saving ? "animate-pulse" : ""}
            />
          </button>
        )}

        {question.type !== "multi_choice" && question.type !== "text" && !isAgeRange && (
          <div className="h-11 w-11" />
        )}
      </div>
    </section>
  );
}
