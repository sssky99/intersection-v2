"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { mockQuestions, questionCategories } from "@/data/mockQuestions";
import {
  onboardingTicketSamples,
  parseTicketPreferenceResults,
  type TicketPreferenceAnswer,
  type TicketPreferenceResult,
} from "@/features/onboarding/onboardingTicketSamples";
import { createClient } from "@/lib/supabase/client";
import { uploadProfilePhoto } from "@/lib/profilePhoto";
import type {
  ProfileQuestion,
  QuestionAnswer,
  QuestionOption,
} from "@/types/question";

export type StoredAnswerRow = {
  question_order: number;
  answer_value: string | null;
  answer_values: string[] | null;
  answer_text: string | null;
  other_text: string | null;
};

type AnswerMap = Record<number, QuestionAnswer>;

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function optionValue(option: string | QuestionOption) {
  return typeof option === "string" ? option : option.value;
}

function optionLabel(option: string | QuestionOption) {
  return typeof option === "string" ? option : option.label;
}

const SCALE_VALUES = ["1", "2", "3", "4", "5"];

function optionMeta(question: ProfileQuestion, value: string) {
  return question.options
    ?.map((option) =>
      typeof option === "string" ? { value: option, label: option } : option,
    )
    .find((option) => option.value === value);
}

function rowToAnswer(row: StoredAnswerRow): QuestionAnswer {
  const question = mockQuestions.find(
    (item) => (item.order ?? item.id) === row.question_order,
  );
  const value = question
    ? question.type === "ticket_preference"
      ? row.answer_text ?? ""
      : question.type === "photo_upload"
        ? row.answer_value?.startsWith("http")
          ? row.answer_value
          : ""
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

  if (question.type === "ticket_preference") {
    return (
      typeof answer.value === "string" &&
      parseTicketPreferenceResults(answer.value).length ===
        onboardingTicketSamples.length
    );
  }

  const value = answer.value;
  const hasValue = Array.isArray(value)
    ? value.length > 0
    : Boolean(String(value).trim());

  if (!hasValue) return false;

  const needsOther = Array.isArray(value)
    ? value.some((item) => optionMeta(question, item)?.hasTextInput)
    : typeof value === "string" &&
      Boolean(optionMeta(question, value)?.hasTextInput);

  return !needsOther || Boolean(answer.otherText?.trim());
}

function toAnswerPayload(question: ProfileQuestion, answer: QuestionAnswer) {
  if (question.type === "ticket_preference") {
    return {
      answer_value: null,
      answer_values: null,
      answer_text: String(answer.value),
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

function questionCopy(question: ProfileQuestion) {
  const paragraphs = question.question
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (question.id !== 10 || paragraphs.length < 3) {
    return {
      main: question.question,
      supporting: [] as string[],
    };
  }

  return {
    main: paragraphs.at(-1) ?? question.question,
    supporting: paragraphs.slice(0, -1),
  };
}

export function QuestionFlow({
  userId,
  initialRows,
}: {
  userId: string;
  initialRows: StoredAnswerRow[];
}) {
  const router = useRouter();
  const initialAnswers = useMemo(
    () =>
      Object.fromEntries(
        initialRows.map((row) => {
          const answer = rowToAnswer(row);
          return [answer.questionId, answer];
        }),
      ) as AnswerMap,
    [initialRows],
  );
  const firstIncomplete = mockQuestions.findIndex(
    (question) => !isComplete(question, initialAnswers[question.id]),
  );
  const [questionIndex, setQuestionIndex] = useState(
    firstIncomplete === -1 ? mockQuestions.length - 1 : firstIncomplete,
  );
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);
  const initialTicketResults = useMemo(
    () =>
      parseTicketPreferenceResults(
        typeof initialAnswers[15]?.value === "string"
          ? initialAnswers[15].value
          : "",
      ),
    [initialAnswers],
  );
  const [ticketResults, setTicketResults] =
    useState<TicketPreferenceResult[]>(initialTicketResults);
  const [ticketIndex, setTicketIndex] = useState(
    Math.min(
      initialTicketResults.length,
      onboardingTicketSamples.length - 1,
    ),
  );
  const [ticketFeedback, setTicketFeedback] =
    useState<TicketPreferenceAnswer | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const question = mockQuestions[questionIndex];
  const answer = answers[question.id];
  const selectedValues = Array.isArray(answer?.value) ? answer.value : [];
  const progressPercent = ((questionIndex + 1) / mockQuestions.length) * 100;
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
  const extraScaleOptions = usesNumericScale
    ? (question.options ?? []).filter(
        (option) => !SCALE_VALUES.includes(optionValue(option)),
      )
    : [];
  const selectedScaleOption = usesNumericScale
    ? scaleOptions.find((option) => optionValue(option) === answer?.value)
    : undefined;
  const copy = questionCopy(question);
  const currentTicket = onboardingTicketSamples[ticketIndex];
  const [ticketDrawn, setTicketDrawn] = useState(false);

  useEffect(() => {
    if (question.type !== "ticket_preference" || !currentTicket) {
      setTicketDrawn(false);
      return;
    }

    setTicketDrawn(false);
    const timer = window.setTimeout(() => setTicketDrawn(true), 1350);
    return () => window.clearTimeout(timer);
  }, [currentTicket, question.type]);

  const saveAnswer = async (
    targetQuestion: ProfileQuestion,
    nextAnswer: QuestionAnswer,
  ) => {
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

  const updateLocalAnswer = (nextAnswer: QuestionAnswer) => {
    setAnswers((current) => ({
      ...current,
      [question.id]: nextAnswer,
    }));
  };

  const selectSingle = async (value: string) => {
    if (saving) return;

    const nextAnswer = { questionId: question.id, value };
    updateLocalAnswer(nextAnswer);
    setSaving(true);
    setError(null);

    try {
      await saveAnswer(question, nextAnswer);
      window.setTimeout(() => {
        setQuestionIndex((current) =>
          Math.min(mockQuestions.length - 1, current + 1),
        );
        setSaving(false);
      }, 600);
    } catch (saveError) {
      console.error("Failed to save onboarding answer:", saveError);
      setError("답변 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
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
      nextValues = withoutExclusive.includes(value)
        ? withoutExclusive.filter((item) => item !== value)
        : [...withoutExclusive, value];
    }

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

    setSaving(true);
    setError(null);
    try {
      await saveAnswer(question, answer);
      setQuestionIndex((current) =>
        Math.min(mockQuestions.length - 1, current + 1),
      );
    } catch {
      setError("답변 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const selectTicketPreference = async (
    choice: TicketPreferenceAnswer,
  ) => {
    if (
      question.type !== "ticket_preference" ||
      !currentTicket ||
      saving ||
      ticketFeedback
    ) {
      return;
    }

    const result: TicketPreferenceResult = {
      ticket_id: currentTicket.id,
      title: currentTicket.title,
      activity_type: currentTicket.activityType,
      answer: choice,
      tags: currentTicket.tags,
    };
    const nextResults = [
      ...ticketResults.slice(0, ticketIndex),
      result,
    ];

    setTicketResults(nextResults);
    setTicketFeedback(choice);
    setError(null);
    await new Promise((resolve) => window.setTimeout(resolve, 320));

    if (ticketIndex < onboardingTicketSamples.length - 1) {
      setTicketIndex((current) => current + 1);
      setTicketFeedback(null);
      return;
    }

    const nextAnswer: QuestionAnswer = {
      questionId: question.id,
      value: JSON.stringify(nextResults),
    };
    setSaving(true);

    try {
      await saveAnswer(question, nextAnswer);
      setAnswers((current) => ({
        ...current,
        [question.id]: nextAnswer,
      }));
      setQuestionIndex((current) =>
        Math.min(mockQuestions.length - 1, current + 1),
      );
      setTicketFeedback(null);
    } catch (saveError) {
      console.error("Failed to save ticket preferences:", saveError);
      setError(
        "티켓 취향을 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      setTicketFeedback(null);
    } finally {
      setSaving(false);
    }
  };

  const handlePhoto = async (file: File | null) => {
    if (!file || saving) return;

    setSaving(true);
    setError(null);
    try {
      const photoUrl = await uploadProfilePhoto(userId, file);
      const photoAnswer = { questionId: question.id, value: photoUrl };
      await saveAnswer(question, photoAnswer);

      const { error: profileError } = await createClient()
        .from("profiles")
        .update({
          photo_url: photoUrl,
          questions_completed: true,
        })
        .eq("user_id", userId);

      if (profileError) throw new Error(profileError.message);

      updateLocalAnswer(photoAnswer);
      router.replace("/onboarding/profile");
      router.refresh();
    } catch {
      setError(
        "사진 업로드에 실패했어요. 파일과 profile-photos 버킷 설정을 확인해주세요.",
      );
      setSaving(false);
    }
  };

  return (
    <section
      className={cn(
        "flex min-h-dvh flex-col px-5 md:min-h-[calc(100dvh-32px)]",
        question.type === "ticket_preference" ? "pb-3 pt-4" : "pb-5 pt-7",
      )}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className={cn(question.type === "ticket_preference" ? "mb-3" : "mb-5")}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                질문 진행도 {questionIndex + 1}/{mockQuestions.length}
              </span>
              <span className="text-[10px] font-semibold text-black/35">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/5">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={false}
                style={{ width: `${progressPercent}%` }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          <div className={cn(question.type === "ticket_preference" ? "mb-3" : "mb-6")}>
            {question.type !== "ticket_preference" && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                {questionCategories.find(
                  (category) => category.key === question.category,
                )?.label ?? question.category}
              </span>
            )}
            <h1
              className={cn(
                "whitespace-pre-line font-bold tracking-tight text-black",
                question.type === "ticket_preference"
                  ? "text-[18px] leading-6"
                  : "mt-2 text-xl leading-8",
              )}
            >
              {copy.main}
            </h1>
            {copy.supporting.length > 0 && (
              <div className="mt-3 space-y-1 text-[11px] leading-5 text-black/38">
                {copy.supporting.map((paragraph) => (
                  <p key={paragraph}>({paragraph})</p>
                ))}
              </div>
            )}
            {question.description && (
              <p className="mt-2 text-xs leading-5 text-black/45">
                {question.description}
              </p>
            )}
          </div>

          {question.type === "single_choice" && usesNumericScale && (
            <div className="space-y-3">
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
                      {selected && (
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

              {extraScaleOptions.length > 0 && (
                <div className="space-y-2 pt-1">
                  {extraScaleOptions.map((option) => {
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
                          "flex min-h-11 w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-all disabled:cursor-wait",
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
              <div className="flex flex-wrap gap-2">
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
                        "rounded-full border px-3.5 py-2 text-[10px] font-semibold transition-all",
                        selected
                          ? "border-black bg-black text-white shadow-sm"
                          : "border-black/10 bg-white text-black/60 hover:border-black/20",
                      )}
                    >
                      {optionLabel(option)}
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

          {question.type === "ticket_preference" && currentTicket && (
            <div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`ticket-card-${currentTicket.id}`}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.22 }}
                  className="relative mx-auto aspect-[1/1.62] w-[74%] min-w-[260px] max-w-[290px] overflow-hidden rounded-[28px]"
                >
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.55, duration: 0.35 }}
                    className="absolute inset-1 overflow-hidden rounded-[25px] bg-black"
                  >
                    <Image
                      src={currentTicket.imageUrl}
                      alt=""
                      fill
                      priority
                      sizes="290px"
                      className="object-cover"
                    />
                    <motion.div
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0.35 }}
                      transition={{ delay: 0.62, duration: 0.38 }}
                      className="absolute inset-0 bg-white"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/78" />
                  </motion.div>

                  <svg
                    viewBox="0 0 100 162"
                    className="absolute inset-0 z-10 h-full w-full text-black"
                  >
                    <motion.path
                      d="M 8,1 L 92,1 A 7,7 0 0,1 99,8 L 99,154 A 7,7 0 0,1 92,161 L 8,161 A 7,7 0 0,1 1,154 L 1,8 A 7,7 0 0,1 8,1 Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.58, ease: "easeInOut" }}
                    />
                  </svg>

                  <div className="absolute left-5 top-5 z-20 rounded-full border border-white/30 bg-black/18 px-2.5 py-1 text-[9px] font-bold text-white/82 backdrop-blur-sm">
                    {currentTicket.region}
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.95, duration: 0.28 }}
                    className="absolute inset-x-0 bottom-0 z-20 p-5 text-left text-white"
                  >
                    <h2 className="text-[23px] font-bold leading-7 tracking-tight">
                      {currentTicket.title}
                    </h2>
                    <p className="mt-2 text-[11px] font-medium leading-4 text-white/68">
                      {currentTicket.subtitle}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {currentTicket.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white/14 px-2 py-0.5 text-[9px] font-semibold text-white/66 backdrop-blur"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </motion.div>

                </motion.div>
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {ticketDrawn ? (
                  <motion.div
                    key="ticket-preference-actions"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 grid grid-cols-2 gap-2.5"
                  >
                    <motion.button
                      whileTap={
                        !saving && !ticketFeedback ? { scale: 0.98 } : undefined
                      }
                      type="button"
                      disabled={saving || Boolean(ticketFeedback)}
                      onClick={() => void selectTicketPreference("no")}
                      className="flex h-[54px] flex-col items-center justify-center rounded-[16px] border border-black/12 bg-white text-black transition disabled:opacity-40"
                    >
                      <span className="text-sm font-bold">
                        {ticketFeedback === "no" ? "NO 선택" : "No"}
                      </span>
                      <span className="mt-0.5 text-[10px] font-medium text-black/40">
                        다음 티켓 보기
                      </span>
                    </motion.button>
                    <motion.button
                      whileTap={
                        !saving && !ticketFeedback ? { scale: 0.98 } : undefined
                      }
                      type="button"
                      disabled={saving || Boolean(ticketFeedback)}
                      onClick={() => void selectTicketPreference("yes")}
                      className="flex h-[54px] flex-col items-center justify-center rounded-[16px] bg-black text-white shadow-sm transition disabled:bg-black/20"
                    >
                      <span className="text-sm font-bold">
                        {ticketFeedback === "yes" ? "YES 선택" : "Yes"}
                      </span>
                      <span className="mt-0.5 text-[10px] font-medium text-white/60">
                        {saving ? "저장 중..." : "끌려요"}
                      </span>
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.p
                    key="ticket-drawing-guide"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 text-center text-[11px] text-black/38"
                  >
                    취향에 맞는 티켓을 그려보고 있어요.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}

          {question.type === "text" && (
            <textarea
              value={
                typeof answer?.value === "string" ? answer.value : ""
              }
              placeholder={question.placeholder ?? "편하게 적어주세요."}
              onChange={(event) =>
                updateLocalAnswer({
                  questionId: question.id,
                  value: event.target.value,
                })
              }
              className="min-h-[210px] w-full resize-none rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm leading-6 outline-none placeholder:text-black/25 focus:border-accent"
            />
          )}

          {question.type === "photo_upload" && (
            <div>
              <p className="text-xs font-semibold text-black/45">사진</p>
              <input
                id="onboarding-profile-photo"
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={saving}
                onChange={(event) =>
                  void handlePhoto(event.target.files?.[0] ?? null)
                }
              />
              <label
                htmlFor="onboarding-profile-photo"
                className="mt-2 flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-black/16 bg-black/[0.02] px-4 py-4"
              >
                <span>
                  <span className="block text-sm font-semibold text-black">
                    {saving ? "사진을 올리고 있어요..." : "사진 선택하기"}
                  </span>
                  <span className="mt-1 block text-xs text-black/45">
                    얼굴과 이름을 알아보기 쉬운 사진을 골라주세요.
                  </span>
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black/45">
                  <Camera size={18} aria-hidden />
                </span>
              </label>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
          {error}
        </p>
      )}

      <div
        className={cn(
          "sticky bottom-0 mt-auto flex items-center justify-between bg-white/95 backdrop-blur",
          question.type === "ticket_preference"
            ? "pb-[env(safe-area-inset-bottom)] pt-2"
            : "pb-[calc(4px+env(safe-area-inset-bottom))] pt-5",
        )}
      >
        <button
          type="button"
          aria-label="이전 질문"
          disabled={questionIndex === 0 || saving}
          onClick={() =>
            setQuestionIndex((current) => Math.max(0, current - 1))
          }
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
