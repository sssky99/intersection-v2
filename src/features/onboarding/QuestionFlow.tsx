"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { TicketDrawingFrame } from "@/components/TicketDrawingFrame";
import { profileQuestions, questionCategories } from "@/data/profileQuestions";
import {
  parseTicketRatingAnswer,
  ticketRatingOptions,
} from "@/features/onboarding/ticketRating";
import { trackEvent, trackLoginSuccessFromUrl } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import type {
  ProfileQuestion,
  QuestionAnswer,
  QuestionOption,
  TicketRatingAnswer,
  TicketQuestionTemplate,
} from "@/types/question";

export type { TicketQuestionTemplate } from "@/types/question";

export type StoredAnswerRow = {
  question_order: number;
  answer_value: string | null;
  answer_values: string[] | null;
  answer_text: string | null;
  other_text: string | null;
};

type AnswerMap = Record<number, QuestionAnswer>;
type QuestionFlowMode = "onboarding" | "preview" | "regeneration";

const SCALE_VALUES = ["1", "2", "3", "4", "5"];
const TICKET_QUESTION_BASE_ORDER = 9;
const QUESTION_TYPING_SPEED_MS = 18;
const TICKET_COACHMARK_SESSION_KEY = "intersection-ticket-question-coachmark-dismissed";
const ticketRatingReactions: Record<string, string[]> = {
  "1": ["👎", "👎"],
  "2": ["👎"],
  "3": ["😐"],
  "4": ["❤️"],
  "5": ["❤️", "❤️"],
};

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

function ticketAnswer(value: QuestionAnswer["value"] | undefined) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "ticket_id" in value
  ) {
    return value as TicketRatingAnswer;
  }
  return null;
}

function TypingText({
  className,
  speedMs = QUESTION_TYPING_SPEED_MS,
  startDelayMs = 0,
  textClassName = "whitespace-pre-line",
  text,
}: {
  className?: string;
  speedMs?: number;
  startDelayMs?: number;
  textClassName?: string;
  text: string;
}) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [displayText, setDisplayText] = useState(
    shouldReduceMotion ? text : "",
  );

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayText(text);
      return;
    }

    const characters = Array.from(text);
    let index = 0;
    let timer: number | null = null;
    setDisplayText("");

    if (characters.length === 0) return;

    const startTyping = () => {
      timer = window.setInterval(() => {
        index += 1;
        setDisplayText(characters.slice(0, index).join(""));

        if (index >= characters.length) {
          setDisplayText(text);
          if (timer) window.clearInterval(timer);
        }
      }, speedMs);
    };

    const delayTimer = window.setTimeout(startTyping, startDelayMs);

    return () => {
      window.clearTimeout(delayTimer);
      if (timer) window.clearInterval(timer);
    };
  }, [shouldReduceMotion, speedMs, startDelayMs, text]);

  return (
    <span aria-label={text} className={cn("grid", className)}>
      <span
        aria-hidden="true"
        className={cn("invisible col-start-1 row-start-1", textClassName)}
      >
        {text}
      </span>
      <span
        aria-hidden="true"
        className={cn("col-start-1 row-start-1", textClassName)}
      >
        {displayText}
      </span>
    </span>
  );
}

function OnboardingTicketPreview({ question }: { question: ProfileQuestion }) {
  const [drawn, setDrawn] = useState(false);
  const [imageVisible, setImageVisible] = useState(false);

  useEffect(() => {
    setDrawn(false);
    setImageVisible(false);
    const revealTimer = window.setTimeout(() => {
      setImageVisible(true);
      setDrawn(true);
    }, 650);

    return () => window.clearTimeout(revealTimer);
  }, [question.id]);

  if (!question.ticket) return null;

  return (
    <TicketDrawingFrame
      motionKey={question.ticket.id}
      title={question.ticket.title}
      imageUrl={question.ticket.imageUrl}
      date={question.ticket.dateLabel}
      time={question.ticket.timeLabel}
      location={question.ticket.locationLabel}
      tags={question.ticket.tags}
      proposerLabel={question.ticket.proposerLabel}
      drawn={drawn}
      imageVisible={imageVisible}
      className="!w-[82%] !max-w-[292px] sm:!max-w-[310px]"
    />
  );
}

function EmojiBurst({ emojis }: { emojis: string[] }) {
  return (
    <span
      className="pointer-events-none absolute bottom-6 left-1/2 z-10 h-10 w-12 -translate-x-1/2"
      aria-hidden
    >
      {emojis.map((emoji, index) => {
        const pairOffset = emojis.length > 1;
        const left = pairOffset ? (index === 0 ? "44%" : "56%") : "50%";
        const rotate = pairOffset ? (index === 0 ? -14 : 12) : 0;

        return (
          <motion.span
            key={`${emoji}-${index}`}
            initial={{ opacity: 0, x: "-50%", y: 16, scale: 0.64, rotate }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: "-50%",
              y: [16, -12, -30, -42],
              scale: [0.64, 1.16, 1, 0.9],
              rotate: [rotate, rotate * -0.3, rotate],
            }}
            transition={{ duration: 0.62, ease: "easeOut", delay: index * 0.04 }}
            className="absolute bottom-0 left-1/2 text-[21px] drop-shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
            style={{ left }}
          >
            {emoji}
          </motion.span>
        );
      })}
    </span>
  );
}

function TicketRatingReaction({ rating }: { rating: string }) {
  return <EmojiBurst emojis={ticketRatingReactions[rating] ?? []} />;
}

function TicketCoachmarkOverlay({ onClose }: { onClose: () => void }) {
  const shouldReduceMotion = Boolean(useReducedMotion());

  return (
    <>
      <motion.div
        className="absolute inset-0 z-40 bg-black/[0.58] backdrop-blur-[1.5px]"
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        aria-hidden
      />
      <motion.button
        type="button"
        aria-label="코치마크 닫기"
        onClick={onClose}
        className="absolute right-4 top-4 z-[80] flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-black/55 shadow-[0_8px_22px_rgba(0,0,0,0.18)] backdrop-blur transition hover:text-black"
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <X size={18} strokeWidth={2.4} aria-hidden />
      </motion.button>
      <motion.p
        className="pointer-events-none absolute left-5 top-6 z-[70] text-left text-[32px] font-black uppercase leading-none tracking-[0.04em] text-white"
        style={{
          WebkitTextStroke: "1px rgba(0,0,0,0.48)",
          textShadow:
            "0 2px 0 rgba(0,0,0,0.28), 0 8px 22px rgba(0,0,0,0.42)",
        }}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, y: 3 }}
        transition={{ duration: 0.24, delay: shouldReduceMotion ? 0 : 0.08 }}
      >
        <TypingText text="HOW TO..." speedMs={32} startDelayMs={80} />
      </motion.p>
    </>
  );
}

function TicketCoachmarkHint({
  className,
  delayMs,
  placement = "center",
  text,
}: {
  className?: string;
  delayMs: number;
  placement?: "center" | "rating";
  text: string;
}) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const delay = shouldReduceMotion ? 0 : delayMs / 1000;
  const positionClass =
    placement === "rating"
      ? "left-[44%] -translate-x-1/2"
      : "left-1/2 -translate-x-1/2";

  return (
    <motion.p
      className={cn(
        "pointer-events-none absolute z-[70] min-w-max whitespace-nowrap rounded-full bg-white px-5 py-2 text-center text-[12px] font-extrabold leading-4 text-black shadow-[0_12px_30px_rgba(0,0,0,0.22)]",
        positionClass,
        className,
      )}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, delay, ease: "easeOut" }}
    >
      <TypingText
        text={text}
        speedMs={24}
        startDelayMs={delayMs}
        textClassName="whitespace-nowrap"
      />
    </motion.p>
  );
}

function templateToTicketQuestion(
  template: TicketQuestionTemplate,
): ProfileQuestion {
  const order = TICKET_QUESTION_BASE_ORDER + template.questionOrder;
  const signalTags = [
    template.activityType,
    template.recommendationCopy,
    ...template.moodTags,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .slice(0, 4);

  return {
    id: order,
    order,
    category: "모임 취향",
    type: "ticket_rating",
    question: "이런 자리는 어떠세요?",
    ticket: {
      id: template.id,
      title: template.title,
      imageUrl: template.imageUrl ?? "",
      dateLabel: "",
      timeLabel: "",
      locationLabel: "",
      proposerLabel: template.proposerLabel,
      tags: template.moodTags,
    },
    intent:
      template.recommendationCopy ??
      template.activityType ??
      template.shortDescription ??
      "모임 취향 선호 파악",
    signalTags: signalTags.length > 0 ? signalTags : ["모임 취향"],
  };
}

function questionsWithTicketTemplates(
  ticketQuestionTemplates: TicketQuestionTemplate[],
) {
  if (ticketQuestionTemplates.length === 0) return profileQuestions;

  const dynamicTicketQuestions = ticketQuestionTemplates
    .map(templateToTicketQuestion)
    .sort((left, right) => (left.order ?? left.id) - (right.order ?? right.id));
  const staticQuestions = profileQuestions
    .filter((question) => question.type !== "ticket_rating")
    .sort((left, right) => (left.order ?? left.id) - (right.order ?? right.id));

  return [...dynamicTicketQuestions, ...staticQuestions];
}

function rowToAnswer(
  row: StoredAnswerRow,
  questions: ProfileQuestion[],
): QuestionAnswer {
  const question = questions.find(
    (item) => (item.order ?? item.id) === row.question_order,
  );
  const value = question
    ? question.type === "ticket_rating"
      ? parseTicketRatingAnswer(row.answer_text) ?? ""
      : row.answer_values ??
        (question.type === "text"
          ? row.answer_text ?? row.answer_value ?? ""
          : row.answer_value ?? "")
    : "";

  return {
    questionId: question?.id ?? row.question_order,
    value,
    otherText: row.other_text ?? undefined,
  };
}

function isComplete(question: ProfileQuestion, answer?: QuestionAnswer) {
  if (!answer) return false;

  if (question.type === "ticket_rating") {
    const rating = ticketAnswer(answer.value);
    return Boolean(rating?.ticket_id && rating.rating);
  }

  const value = answer.value;
  const hasValue = Array.isArray(value)
    ? value.length > 0
    : typeof value === "object"
      ? false
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
  if (question.type === "ticket_rating") {
    return {
      answer_value: null,
      answer_values: null,
      answer_text: JSON.stringify(answer.value),
    };
  }

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

function initialIndexFromSearch(value: string | null, questionCount: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > questionCount) return null;
  return parsed - 1;
}

function clampInternalScore(value: number) {
  return Math.min(100, Math.max(-100, value));
}

function answerScoreToInternalScore(value: QuestionAnswer["value"] | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) return 0;
  return clampInternalScore((parsed - 3) * 50);
}

function profileScoresFromAnswers(answers: AnswerMap) {
  return {
    score_temperature: answerScoreToInternalScore(answers[1]?.value),
    score_texture: answerScoreToInternalScore(answers[2]?.value),
    score_tone: answerScoreToInternalScore(answers[3]?.value),
    score_rhythm: answerScoreToInternalScore(answers[4]?.value),
  };
}

export function QuestionFlow({
  userId,
  initialRows,
  ticketQuestionTemplates = [],
  mode = "onboarding",
  onPreviewComplete,
}: {
  userId?: string;
  initialRows: StoredAnswerRow[];
  ticketQuestionTemplates?: TicketQuestionTemplate[];
  mode?: QuestionFlowMode;
  onPreviewComplete?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPreview = mode === "preview";
  const isRegeneration = mode === "regeneration";
  const questions = useMemo(
    () => questionsWithTicketTemplates(ticketQuestionTemplates),
    [ticketQuestionTemplates],
  );
  const initialAnswers = useMemo(
    () =>
      Object.fromEntries(
        initialRows.map((row) => {
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
  const [selectedFeedback, setSelectedFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticketCoachmarkReady, setTicketCoachmarkReady] = useState(isPreview);
  const [ticketCoachmarkDismissed, setTicketCoachmarkDismissed] = useState(false);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const trackedMilestonesRef = useRef<Set<string>>(new Set());
  const questionStartTrackedRef = useRef(false);
  const shouldReduceMotion = Boolean(useReducedMotion());
  const question = questions[questionIndex];
  const answer = answers[question.id];
  const selectedValues = Array.isArray(answer?.value) ? answer.value : [];
  const progressPercent = ((questionIndex + 1) / questions.length) * 100;
  const canContinue = isComplete(question, answer);
  const scaleOptions =
    question.type === "single_choice"
      ? SCALE_VALUES.map((value) =>
          question.options?.find((option) => optionValue(option) === value),
        ).filter(
          (option): option is string | QuestionOption => Boolean(option),
        )
      : [];
  const usesNumericScale = scaleOptions.length === SCALE_VALUES.length;
  const selectedTicketAnswer = ticketAnswer(answer?.value);
  const shouldShowTicketCoachmark =
    ticketCoachmarkReady &&
    !ticketCoachmarkDismissed &&
    questionIndex === 0 &&
    question.type === "ticket_rating";
  const cardCoachmarkAnimation = shouldShowTicketCoachmark
    ? {
        filter: shouldReduceMotion
          ? "drop-shadow(0 0 30px rgba(255,255,255,0.62))"
          : [
              "drop-shadow(0 0 12px rgba(255,255,255,0.38))",
              "drop-shadow(0 0 34px rgba(255,255,255,0.78))",
              "drop-shadow(0 0 18px rgba(126,179,199,0.58))",
            ],
        scale: shouldReduceMotion ? 1 : [1, 1.015, 1],
      }
    : undefined;
  const ratingCoachmarkAnimation = shouldShowTicketCoachmark
    ? {
        filter: shouldReduceMotion
          ? "drop-shadow(0 0 24px rgba(255,255,255,0.62))"
          : [
              "drop-shadow(0 0 0 rgba(255,255,255,0))",
              "drop-shadow(0 0 28px rgba(255,255,255,0.72))",
              "drop-shadow(0 0 16px rgba(126,179,199,0.55))",
            ],
        scale: shouldReduceMotion ? 1 : [1, 1.03, 1],
      }
    : undefined;

  useEffect(() => {
    if (isPreview || isRegeneration) return;
    trackLoginSuccessFromUrl("new");
  }, [isPreview, isRegeneration]);

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
      "ticket_test_complete",
      "ticket_test_complete",
      questions.filter((item) => item.type === "ticket_rating"),
      nextAnswers,
    );
    trackQuestionMilestone(
      "choice_questions_complete",
      "choice_questions_complete",
      questions.filter(
        (item) => item.type !== "ticket_rating" && item.type !== "text",
      ),
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

  const completeOrMoveNext = async (nextAnswers: AnswerMap) => {
    const missingIndex = questions.findIndex(
      (item) => !isComplete(item, nextAnswers[item.id]),
    );

    if (missingIndex !== -1) {
      setQuestionIndex(missingIndex);
      return;
    }

    if (!userId) throw new Error("QuestionFlow requires userId in onboarding mode.");

    const { error: profileError } = await createClient()
      .from("profiles")
      .update(
        isRegeneration
          ? { profile_regeneration_questions_completed_at: new Date().toISOString() }
          : {
              questions_completed: true,
              ...profileScoresFromAnswers(nextAnswers),
            },
      )
      .eq("user_id", userId);

    if (profileError) throw new Error(profileError.message);

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
    setAnswers((current) => ({
      ...current,
      [nextAnswer.questionId]: nextAnswer,
    }));
  };

  const scheduleAutoAdvance = (nextAnswers: AnswerMap, delayMs: number) => {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
    }

    autoAdvanceTimerRef.current = window.setTimeout(() => {
      autoAdvanceTimerRef.current = null;
      void moveToNext(nextAnswers).finally(() => {
        setSaving(false);
        setSelectedFeedback(null);
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

  useEffect(() => {
    if (isPreview || isRegeneration) {
      setTicketCoachmarkDismissed(false);
      setTicketCoachmarkReady(true);
      return;
    }

    setTicketCoachmarkDismissed(
      window.sessionStorage.getItem(TICKET_COACHMARK_SESSION_KEY) === "1",
    );
    setTicketCoachmarkReady(true);
  }, [isPreview, isRegeneration]);

  const dismissTicketCoachmark = () => {
    setTicketCoachmarkDismissed(true);
    if (!isPreview && !isRegeneration) {
      window.sessionStorage.setItem(TICKET_COACHMARK_SESSION_KEY, "1");
    }
  };

  const selectSingle = async (value: string) => {
    if (saving) return;

    const nextAnswer = { questionId: question.id, value };
    const nextAnswers = answerMapWith(nextAnswer);
    const nextDelay = 420;

    updateLocalAnswer(nextAnswer);
    setSaving(true);
    setError(null);

    if (isPreview) {
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
      setSaving(false);
      setSelectedFeedback(null);
    }
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
    if (!answer || !canContinue || saving) return;

    const nextAnswers = answerMapWith(answer);
    setSaving(true);
    setError(null);
    try {
      await saveAnswer(question, answer);
      trackQuestionAnswered(question);
      trackQuestionMilestones(nextAnswers);
      await moveToNext(nextAnswers);
    } catch (saveError) {
      console.error("Failed to save onboarding answer:", saveError);
      setError("답변 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const selectTicketRating = async (rating: string) => {
    if (question.type !== "ticket_rating" || !question.ticket || saving) return;

    const nextAnswer: QuestionAnswer = {
      questionId: question.id,
      value: {
        ticket_id: question.ticket.id,
        rating,
        title: question.ticket.title,
        signal_tags: question.signalTags ?? [],
      },
    };
    const nextAnswers = answerMapWith(nextAnswer);
    updateLocalAnswer(nextAnswer);
    setSaving(true);
    setSelectedFeedback(rating);
    setError(null);

    if (isPreview) {
      scheduleAutoAdvance(nextAnswers, 650);
      return;
    }

    try {
      await saveAnswer(question, nextAnswer);
      trackQuestionAnswered(question);
      trackQuestionMilestones(nextAnswers);
      scheduleAutoAdvance(nextAnswers, 650);
    } catch (saveError) {
      console.error("Failed to save ticket rating:", saveError);
      setError("티켓 반응을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
      setSelectedFeedback(null);
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

          <div className={cn("mb-6", question.type === "ticket_rating" && "mb-4")}>
            {question.type !== "ticket_rating" && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                {categoryLabel}
              </span>
            )}
            <h1
              className={cn(
                "whitespace-pre-line text-xl font-bold leading-8 tracking-tight text-black",
                question.type !== "ticket_rating" && "mt-2",
              )}
            >
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
                    aria-label={`${value}. ${optionLabel(option)}`}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold leading-5 transition-all disabled:cursor-wait",
                      selected
                        ? "border-black bg-black text-white shadow-sm"
                        : "border-black/10 bg-white text-black/70 hover:border-black/20",
                    )}
                  >
                    <span className="shrink-0 text-xs font-extrabold tabular-nums opacity-55">
                      {value}.
                    </span>
                    <span className="flex-1">{optionLabel(option)}</span>
                    {selected && <Check size={16} aria-hidden />}
                  </motion.button>
                );
              })}
            </div>
          )}

          {question.type === "single_choice" && !usesNumericScale && (
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
                      "flex min-h-11 w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-all",
                      selected
                        ? "border-black bg-black text-white shadow-sm"
                        : "border-black/10 bg-white text-black/70 hover:border-black/20",
                    )}
                  >
                    <span>{optionLabel(option)}</span>
                    {selected && <Check size={13} aria-hidden />}
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
                  const selected = selectedValues.includes(value);

                  return (
                    <motion.button
                      key={value}
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => toggleMultiple(value)}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-all",
                        selected
                          ? "border-black bg-black text-white shadow-sm"
                          : "border-black/10 bg-white text-black/70 hover:border-black/20",
                      )}
                    >
                      <span>{optionLabel(option)}</span>
                      {selected && <Check size={13} aria-hidden />}
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

          {question.type === "ticket_rating" && question.ticket && (
            <div>
              <motion.div
                className={cn(
                  "relative",
                  shouldShowTicketCoachmark && "pointer-events-none z-50",
                )}
                animate={cardCoachmarkAnimation}
                transition={{
                  duration: shouldReduceMotion ? 0 : 1.3,
                  ease: "easeInOut",
                  repeat: shouldReduceMotion ? 0 : Infinity,
                  repeatDelay: 1.7,
                }}
              >
                <OnboardingTicketPreview question={question} />
                {shouldShowTicketCoachmark && (
                  <TicketCoachmarkHint
                    className="top-6"
                    delayMs={260}
                    text="카드 설명과 분위기를 보고"
                  />
                )}
              </motion.div>

              <motion.div
                className={cn(
                  "relative mt-4",
                  shouldShowTicketCoachmark && "pointer-events-none z-50",
                )}
                animate={ratingCoachmarkAnimation}
                transition={{
                  duration: shouldReduceMotion ? 0 : 1.15,
                  delay: shouldReduceMotion ? 0 : 1.05,
                  ease: "easeInOut",
                  repeat: shouldReduceMotion ? 0 : Infinity,
                  repeatDelay: 1.85,
                }}
              >
                {shouldShowTicketCoachmark && (
                  <TicketCoachmarkHint
                    className="top-[62px]"
                    delayMs={1250}
                    placement="rating"
                    text="하단 번호로 선호도를 표시해주세요."
                  />
                )}
                <div className="flex items-center justify-between px-2 pt-5">
                  {ticketRatingOptions.map((option) => {
                    const selected = selectedTicketAnswer?.rating === option.value;
                    const edgeLabel =
                      option.value === "1"
                        ? "별로예요"
                        : option.value === "5"
                          ? "좋아요"
                          : null;

                    return (
                      <motion.button
                        key={option.value}
                        type="button"
                        whileTap={!saving ? { scale: 0.98 } : undefined}
                        disabled={saving}
                        onClick={() => void selectTicketRating(option.value)}
                        aria-label={`${option.value}점: ${option.label}`}
                        className={cn(
                          "relative flex h-10 w-10 items-center justify-center bg-transparent text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-55",
                          selected
                            ? "text-lg font-extrabold text-black after:absolute after:bottom-0 after:h-[2px] after:w-3 after:rounded-full after:bg-accent"
                            : "text-black/40 hover:text-black/65",
                        )}
                      >
                        {edgeLabel && (
                          <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-extrabold leading-none text-black/45">
                            {edgeLabel}
                          </span>
                        )}
                        <span aria-hidden>{option.value}</span>
                        <span className="sr-only">{option.label}</span>
                        <AnimatePresence>
                          {selectedFeedback === option.value && (
                            <TicketRatingReaction
                              key={`reaction-${option.value}`}
                              rating={option.value}
                            />
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
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

      <AnimatePresence>
        {shouldShowTicketCoachmark && (
          <TicketCoachmarkOverlay
            key="ticket-question-coachmark"
            onClose={dismissTicketCoachmark}
          />
        )}
      </AnimatePresence>

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

        {(question.type === "multi_choice" || question.type === "text") && (
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

        {question.type !== "multi_choice" && question.type !== "text" && (
          <div className="h-11 w-11" />
        )}
      </div>
    </section>
  );
}
