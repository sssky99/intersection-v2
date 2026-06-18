"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TicketDrawingFrame } from "@/components/TicketDrawingFrame";
import { profileQuestions, questionCategories } from "@/data/profileQuestions";
import {
  parseTicketRatingAnswer,
  ticketRatingOptions,
} from "@/features/onboarding/ticketRating";
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

const SCALE_VALUES = ["1", "2", "3", "4", "5"];
const TICKET_QUESTION_BASE_ORDER = 9;

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

function scaleLabelParts(label?: string) {
  if (!label) return null;
  const parts = label
    .split(/\s*(?:↔|<->|←→|~)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;
  return { left: parts[0], right: parts[parts.length - 1] };
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
      drawn={drawn}
      imageVisible={imageVisible}
    />
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
      timeLabel: template.defaultTime ?? "",
      locationLabel: template.defaultRegion ?? "",
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

  return [
    ...profileQuestions.filter((question) => question.type !== "ticket_rating"),
    ...dynamicTicketQuestions,
  ].sort((left, right) => (left.order ?? left.id) - (right.order ?? right.id));
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
  mode?: "onboarding" | "preview";
  onPreviewComplete?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPreview = mode === "preview";
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
  const selectedScaleOption = usesNumericScale
    ? scaleOptions.find((option) => optionValue(option) === answer?.value)
    : undefined;
  const selectedTicketAnswer = ticketAnswer(answer?.value);
  const numericScaleLabel = usesNumericScale
    ? scaleLabelParts(question.scaleLabel)
    : null;

  const saveAnswer = async (
    targetQuestion: ProfileQuestion,
    nextAnswer: QuestionAnswer,
  ) => {
    if (isPreview) return;
    if (!userId) throw new Error("QuestionFlow requires userId in onboarding mode.");

    const { error: saveError } = await createClient()
      .from("user_answers")
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

    if (isPreview) {
      onPreviewComplete?.();
      return;
    }

    if (!userId) throw new Error("QuestionFlow requires userId in onboarding mode.");

    const { error: profileError } = await createClient()
      .from("profiles")
      .update({ questions_completed: true })
      .eq("user_id", userId);

    if (profileError) throw new Error(profileError.message);

    router.replace("/onboarding/profile");
    router.refresh();
  };

  const moveToNext = async (nextAnswers: AnswerMap) => {
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

  const selectSingle = async (value: string) => {
    if (saving) return;

    const nextAnswer = { questionId: question.id, value };
    const nextAnswers = answerMapWith(nextAnswer);
    updateLocalAnswer(nextAnswer);
    setSaving(true);
    setSelectedFeedback(value);
    setError(null);

    try {
      await saveAnswer(question, nextAnswer);
      window.setTimeout(() => {
        void moveToNext(nextAnswers).finally(() => {
          setSaving(false);
          setSelectedFeedback(null);
        });
      }, 420);
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

    try {
      await saveAnswer(question, nextAnswer);
      window.setTimeout(() => {
        void moveToNext(nextAnswers).finally(() => {
          setSaving(false);
          setSelectedFeedback(null);
        });
      }, 520);
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
    <section className="flex min-h-dvh flex-col px-5 pb-5 pt-7 md:min-h-[calc(100dvh-32px)]">
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
            <div className="space-y-3">
              {numericScaleLabel && (
                <div className="flex items-end justify-between px-2 text-[11px] font-semibold leading-4 text-black/35">
                  <span className="max-w-[120px] text-left">
                    {numericScaleLabel.left}
                  </span>
                  <span className="max-w-[120px] text-right">
                    {numericScaleLabel.right}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between px-2">
                {scaleOptions.map((option) => {
                  const value = optionValue(option);
                  const selected = answer?.value === value;

                  return (
                    <motion.button
                      key={value}
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      animate={{
                        scale: selected ? 1.16 : 1,
                        y: selected ? -1 : 0,
                      }}
                      transition={{ duration: 0.18 }}
                      disabled={saving}
                      onClick={() => void selectSingle(value)}
                      aria-label={`${value}점: ${optionLabel(option)}`}
                      className={cn(
                        "relative flex h-10 w-10 items-center justify-center bg-transparent transition-colors disabled:cursor-wait",
                        selected
                          ? "text-lg font-extrabold text-black"
                          : "text-sm font-semibold text-black/40 hover:text-black/65",
                      )}
                    >
                      {value}
                      {(selected || selectedFeedback === value) && (
                        <motion.span
                          layoutId="selected-scale-indicator"
                          className="absolute bottom-0 h-[2px] w-3 rounded-full bg-accent"
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {selectedScaleOption && (
                  <motion.div
                    key={optionValue(selectedScaleOption)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.2 }}
                    className="mx-auto max-w-[320px] px-3 pt-2 text-center"
                  >
                    <span className="block text-[10px] font-bold tracking-[0.12em] text-accent/70">
                      이런 모습에 가까워요
                    </span>
                    <p className="mt-1.5 text-[13px] font-medium leading-5 text-black/55">
                      “{optionLabel(selectedScaleOption)}”
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
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
              <OnboardingTicketPreview question={question} />

              <div className="mt-4">
                <div className="flex items-center justify-between px-2">
                  {ticketRatingOptions.map((option) => {
                  const selected = selectedTicketAnswer?.rating === option.value;

                  return (
                    <motion.button
                      key={option.value}
                      type="button"
                      whileTap={!saving ? { scale: 0.98 } : undefined}
                      disabled={saving}
                      onClick={() => void selectTicketRating(option.value)}
                      data-rating={option.value}
                      className={cn(
                        "relative flex h-10 w-10 items-center justify-center bg-transparent text-sm font-semibold transition-colors before:content-[attr(data-rating)] disabled:cursor-wait disabled:opacity-55 [&>span]:sr-only",
                        selected
                          ? "text-lg font-extrabold text-black after:absolute after:bottom-0 after:h-[2px] after:w-3 after:rounded-full after:bg-accent"
                          : "text-black/40 hover:text-black/65",
                      )}
                    >
                      <span>{option.label}</span>
                      <span className="text-[11px] font-bold">
                        {selectedFeedback === option.value ? "저장 중" : option.value}
                      </span>
                    </motion.button>
                  );
                  })}
                </div>
                <AnimatePresence mode="wait">
                  {selectedTicketAnswer && (
                    <motion.p
                      key={selectedTicketAnswer.rating}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: 0.2 }}
                      className="mx-auto max-w-[320px] px-3 pt-3 text-center text-[13px] font-semibold leading-5 text-black/55"
                    >
                      {
                        ticketRatingOptions.find(
                          (option) => option.value === selectedTicketAnswer.rating,
                        )?.label
                      }
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
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
                <div className="mt-3 space-y-1.5 text-[11px] font-medium leading-5 text-black/38">
                  {question.examples.map((example) => (
                    <p key={example}>{example}</p>
                  ))}
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
