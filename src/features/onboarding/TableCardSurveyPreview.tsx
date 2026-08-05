"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { preferenceQuestions } from "@/data/preferenceQuestions";
import { trackEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import type { StoredAnswerRow } from "@/types/question";

type Choice = {
  value: string;
  label: string;
  emoji: string;
  description?: string;
  color?: string;
};

const movieChoices: Choice[] = [
  {
    value: "comedy",
    label: "코미디",
    emoji: "😂",
    color: "#F7C95D",
  },
  {
    value: "drama",
    label: "드라마",
    emoji: "🎭",
    color: "#E8A6A6",
  },
  {
    value: "adventure",
    label: "모험",
    emoji: "🗺️",
    color: "#8FC5AE",
  },
  {
    value: "romance",
    label: "로맨스",
    emoji: "💌",
    color: "#D9B4D8",
  },
];

const interestChoices: Choice[] = [
  { value: "travel", label: "여행", emoji: "✈️" },
  { value: "food", label: "맛집·요리", emoji: "🍳" },
  { value: "coffee", label: "카페·커피", emoji: "☕" },
  { value: "movie", label: "영화·드라마", emoji: "🎬" },
  { value: "music", label: "음악", emoji: "🎧" },
  { value: "book", label: "독서", emoji: "📚" },
  { value: "exhibition", label: "전시·디자인", emoji: "🎨" },
  { value: "fitness", label: "운동", emoji: "🏃" },
  { value: "nature", label: "자연·등산", emoji: "🌿" },
  { value: "game", label: "게임·보드게임", emoji: "🎮" },
  { value: "photo", label: "사진", emoji: "📸" },
  { value: "growth", label: "심리·성장", emoji: "🧠" },
];

const qualityChoices: Choice[] = [
  { value: "authentic", label: "진솔함", emoji: "🙂" },
  { value: "attentive", label: "세심한 배려", emoji: "🥹" },
  { value: "funny", label: "유머", emoji: "😆" },
  { value: "warm", label: "따뜻함", emoji: "😊" },
  { value: "intelligent", label: "지적인 자극", emoji: "🤓" },
  { value: "grounded", label: "차분한 안정감", emoji: "😌" },
  { value: "curious", label: "새로운 관점", emoji: "🤔" },
  { value: "positive", label: "긍정적인 태도", emoji: "😄" },
];

const activityChoices: Choice[] = [
  {
    value: "meal",
    label: "식사·카페",
    emoji: "🍽️",
    description: "맛있는 것을 먹으며 대화하기",
  },
  {
    value: "culture",
    label: "문화 콘텐츠",
    emoji: "🎨",
    description: "전시·영화·공연 함께 보기",
  },
  {
    value: "outdoor",
    label: "활동·체험",
    emoji: "🚶",
    description: "산책·운동·새로운 체험",
  },
  {
    value: "play",
    label: "오락",
    emoji: "🎲",
    description: "보드게임과 가벼운 놀이",
  },
  {
    value: "reading",
    label: "독서",
    emoji: "📚",
    description: "책과 콘텐츠로 이야기하기",
  },
  {
    value: "taste",
    label: "취향 탐색",
    emoji: "🛍️",
    description: "쇼핑·플리마켓 둘러보기",
  },
];

const steps = [
  {
    title: "내 삶을 영화로 만든다면\n어떤 장르에 가까울까요?",
    helper: "",
  },
  {
    title: "쉬는 시간에는\n무엇을 하며 보내나요?",
    helper: "최대 3개까지 골라주세요.",
  },
  {
    title: "친구 관계에서\n무엇이 가장 중요한가요?",
    helper: "함께 중요하게 여겼으면 하는 모습을 3개 골라주세요.",
  },
  {
    title: "교집합에서 어떤 시간을\n보내보고 싶나요?",
    helper: "마음이 가는 활동을 최대 3개 골라주세요.",
  },
  {
    title: "가능하면 피하고 싶은\n활동이 있나요?",
    helper: "부담스러운 활동을 골라주세요. 없어도 괜찮아요.",
  },
];

function toggleLimited(
  values: string[],
  value: string,
  limit: number,
): string[] {
  if (values.includes(value)) return values.filter((item) => item !== value);
  if (values.length >= limit) return values;
  return [...values, value];
}

function choiceLabel(choices: Choice[], value: string) {
  return choices.find((choice) => choice.value === value)?.label ?? value;
}

function ChoiceChip({
  choice,
  selected,
  onClick,
}: {
  choice: Choice;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "flex min-h-12 items-center gap-2 rounded-full border px-4 py-2.5 text-left text-[13px] font-bold transition",
        selected
          ? "border-[#171714] bg-[#171714] text-white shadow-[0_8px_18px_rgba(23,23,20,0.14)]"
          : "border-black/10 bg-white/80 text-black hover:border-black/25",
      ].join(" ")}
    >
      <span aria-hidden>{choice.emoji}</span>
      <span>{choice.label}</span>
      {selected && <Check className="ml-auto h-3.5 w-3.5" strokeWidth={3} />}
    </motion.button>
  );
}

type PreferenceQuestionFlowMode =
  | "preview"
  | "onboarding"
  | "regeneration"
  | "upgrade"
  | "guest";

function rowValues(initialRows: StoredAnswerRow[], order: number) {
  const row = initialRows.find((item) => item.question_order === order);
  return row?.answer_values ?? [];
}

function rowValue(initialRows: StoredAnswerRow[], order: number) {
  return (
    initialRows.find((item) => item.question_order === order)?.answer_value ?? ""
  );
}

export function PreferenceQuestionFlow({
  userId,
  initialRows = [],
  mode = "preview",
  onGuestDraftChange,
  onGuestComplete,
}: {
  userId?: string;
  initialRows?: StoredAnswerRow[];
  mode?: PreferenceQuestionFlowMode;
  onGuestDraftChange?: (rows: StoredAnswerRow[]) => void;
  onGuestComplete?: (rows: StoredAnswerRow[]) => void;
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<"questions" | "result">("questions");
  const [step, setStep] = useState(0);
  const [movie, setMovie] = useState(() => rowValue(initialRows, 1));
  const [interests, setInterests] = useState<string[]>(() =>
    rowValues(initialRows, 2).slice(0, 3),
  );
  const [qualities, setQualities] = useState<string[]>(() =>
    rowValues(initialRows, 3),
  );
  const initialPreferred = rowValues(initialRows, 4);
  const initialAvoided = rowValues(initialRows, 5);
  const [preferred, setPreferred] = useState<string[]>(() =>
    initialPreferred.filter((value) => value !== "any_activity"),
  );
  const [avoided, setAvoided] = useState<string[]>(() =>
    initialAvoided.filter((value) => value !== "no_avoidance"),
  );
  const [noAvoidance, setNoAvoidance] = useState(
    initialAvoided.includes("no_avoidance"),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questionStartTrackedRef = useRef(false);

  const storedRows = useMemo<StoredAnswerRow[]>(
    () =>
      [
        {
          question_order: 1,
          answer_value: movie || null,
          answer_values: null,
          answer_text: null,
          other_text: null,
        },
        {
          question_order: 2,
          answer_value: null,
          answer_values: interests.length > 0 ? interests : null,
          answer_text: null,
          other_text: null,
        },
        {
          question_order: 3,
          answer_value: null,
          answer_values: qualities.length > 0 ? qualities : null,
          answer_text: null,
          other_text: null,
        },
        {
          question_order: 4,
          answer_value: null,
          answer_values: preferred.length > 0 ? preferred : null,
          answer_text: null,
          other_text: null,
        },
        {
          question_order: 5,
          answer_value: null,
          answer_values: noAvoidance
            ? ["no_avoidance"]
            : avoided.length > 0
              ? avoided
              : null,
          answer_text: null,
          other_text: null,
        },
      ].filter(
        (row) => Boolean(row.answer_value) || Boolean(row.answer_values?.length),
      ),
    [
      avoided,
      interests,
      movie,
      noAvoidance,
      preferred,
      qualities,
    ],
  );

  useEffect(() => {
    if (mode === "guest") onGuestDraftChange?.(storedRows);
  }, [mode, onGuestDraftChange, storedRows]);

  useEffect(() => {
    if (
      (mode !== "guest" && mode !== "onboarding") ||
      questionStartTrackedRef.current
    ) {
      return;
    }

    questionStartTrackedRef.current = true;
    trackEvent("question_start", {
      question_count: preferenceQuestions.length,
      mode: mode === "guest" ? "guest" : "preferences-v2",
    });
  }, [mode]);

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(movie);
    if (step === 1) return interests.length > 0;
    if (step === 2) return qualities.length === 3;
    if (step === 3) return preferred.length > 0;
    return avoided.length > 0 || noAvoidance;
  }, [avoided.length, interests.length, movie, noAvoidance, preferred.length, qualities.length, step]);

  const reset = () => {
    setScreen("questions");
    setStep(0);
    setMovie("");
    setInterests([]);
    setQualities([]);
    setPreferred([]);
    setAvoided([]);
    setNoAvoidance(false);
    setError(null);
  };

  const persistAnswers = async () => {
    if (
      mode !== "onboarding" &&
      mode !== "regeneration" &&
      mode !== "upgrade"
    ) {
      return;
    }
    if (!userId) throw new Error("PreferenceQuestionFlow requires userId.");

    const rows = storedRows.map((row) => {
      const question = preferenceQuestions.find(
        (item) => (item.order ?? item.id) === row.question_order,
      )!;
      return {
        user_id: userId,
        question_order: row.question_order,
        category: question.category,
        question_type: question.type,
        answer_value: row.answer_value,
        answer_values: row.answer_values,
        answer_text: null,
        other_text: null,
        updated_at: new Date().toISOString(),
      };
    });

    const { error: saveError } = await createClient()
      .from(
        mode === "regeneration" || mode === "upgrade"
          ? "profile_regeneration_answers"
          : "user_answers",
      )
      .upsert(rows, { onConflict: "user_id,question_order" });
    if (saveError) throw saveError;
  };

  const completeQuestions = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      if (mode === "preview") {
        setScreen("result");
        return;
      }

      if (mode === "guest") {
        onGuestComplete?.(storedRows);
        return;
      }

      await persistAnswers();
      const response = await fetch("/api/profile/questions/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode:
            mode === "regeneration"
              ? "preferences-v2-regeneration"
              : mode === "upgrade"
                ? "preferences-v2-upgrade"
              : "preferences-v2",
        }),
      });
      if (!response.ok) throw new Error("Question completion failed.");

      trackEvent("questions_complete", {
        question_count: preferenceQuestions.length,
        mode:
          mode === "regeneration"
            ? "preferences-v2-regeneration"
            : mode === "upgrade"
              ? "preferences-v2-upgrade"
            : "preferences-v2",
      });
      router.replace(
        mode === "regeneration" || mode === "upgrade"
          ? "/meetings?tab=profile"
          : "/meetings?tab=recommend",
      );
      router.refresh();
    } catch (completionError) {
      console.error("Preference questions could not be completed:", completionError);
      setError("답변을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  if (screen === "result") {
    const selectedMovie = movieChoices.find((item) => item.value === movie);

    return (
      <div className="min-h-dvh bg-[#F3F0E8] px-5 pb-8 pt-6 md:min-h-[calc(100dvh-32px)]">
        <header className="flex items-center justify-between">
          <p className="text-[10px] font-extrabold tracking-[0.24em] text-black/70">
            INTERSECTION
          </p>
          <button
            type="button"
            onClick={reset}
            className="flex h-9 items-center gap-1.5 rounded-full border border-black/8 bg-white/60 px-3 text-[10px] font-bold text-black/55"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            다시 답하기
          </button>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-9"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.12em] text-[#5792A8]">
            <Check className="h-3.5 w-3.5" />
            PREFERENCES SAVED
          </p>
          <h1 className="mt-2 text-[30px] font-extrabold leading-[1.2] tracking-[-0.055em] text-[#171714]">
            좋아요, 취향을
            <br />
            저장했어요.
          </h1>
          <p className="mt-3 text-[13px] font-semibold leading-6 text-black/43">
            이 선택을 바탕으로 더 잘 맞는 사람들과의 자리를 준비할게요.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mt-7 rounded-[28px] border border-black/[0.06] bg-white/78 p-5 shadow-[0_20px_60px_rgba(24,24,20,0.07)]"
        >
          <p className="text-[11px] font-extrabold tracking-[0.12em] text-black/35">
            이번 선택
          </p>
          <p className="mt-3 text-[14px] font-bold leading-6 text-black/78">
            {selectedMovie?.label} 같은 일상을 좋아하고,{" "}
            {qualities
              .slice(0, 2)
              .map((value) => choiceLabel(qualityChoices, value))
              .join(" · ")}{" "}
            같은 가치를 중요하게 생각하는 사람들을 살펴볼게요.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <ResultDetail
              label="하고 싶은 것"
              value={
                preferred
                  .map((item) => choiceLabel(activityChoices, item))
                  .join(" · ")
              }
            />
            <ResultDetail
              label="피하고 싶은 것"
              value={
                noAvoidance
                  ? "딱히 없어요"
                  : avoided
                      .map((item) => choiceLabel(activityChoices, item))
                      .join(" · ")
              }
            />
          </div>
        </motion.div>

        <button
          type="button"
          className="mt-5 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[19px] bg-[#171714] text-[14px] font-extrabold text-white"
        >
          기본정보 입력하기
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#F7F5EF] md:min-h-[calc(100dvh-32px)]">
      <header className="px-5 pb-3 pt-5">
        <div className="flex items-center justify-center">
          <p className="text-[10px] font-extrabold tracking-[0.22em] text-black/55">
            {step + 1} / {steps.length}
          </p>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/[0.06]">
          <motion.div
            className="h-full rounded-full bg-[#171714]"
            animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </header>

      <div className="flex-1 px-5 pb-28 pt-7">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="whitespace-pre-line text-[27px] font-extrabold leading-[1.25] tracking-[-0.055em] text-[#171714]">
              {steps[step].title}
            </h1>
            {steps[step].helper && (
              <p className="mt-2 text-[12px] font-medium leading-5 text-black/42">
                {steps[step].helper}
              </p>
            )}

            <div className="mt-6">
              {step === 0 && (
                <div className="grid grid-cols-2 gap-2.5">
                  {movieChoices.map((choice) => {
                    const selected = movie === choice.value;
                    return (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        key={choice.value}
                        aria-pressed={selected}
                        onClick={() => setMovie(choice.value)}
                        className={[
                          "relative min-h-[104px] overflow-hidden rounded-[23px] border p-4 text-left transition",
                          selected
                            ? "border-[#171714] bg-white shadow-[inset_0_0_0_1px_#171714,0_12px_24px_rgba(20,20,16,0.08)]"
                            : "border-black/[0.07] bg-white/70",
                        ].join(" ")}
                      >
                        <span
                          className="absolute -right-6 -top-8 h-20 w-20 rounded-full opacity-50 blur-xl"
                          style={{ background: choice.color }}
                        />
                        <span className="relative text-2xl" aria-hidden>
                          {choice.emoji}
                        </span>
                        <span className="relative mt-3 block text-[17px] font-extrabold">
                          {choice.label}
                        </span>
                        {selected && (
                          <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#171714] text-white">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {step === 1 && (
                <div className="flex flex-wrap gap-2">
                  {interestChoices.map((choice) => (
                    <ChoiceChip
                      key={choice.value}
                      choice={choice}
                      selected={interests.includes(choice.value)}
                      onClick={() =>
                        setInterests((current) =>
                          toggleLimited(current, choice.value, 3),
                        )
                      }
                    />
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="grid grid-cols-2 gap-2">
                  {qualityChoices.map((choice) => (
                    <ChoiceChip
                      key={choice.value}
                      choice={choice}
                      selected={qualities.includes(choice.value)}
                      onClick={() =>
                        setQualities((current) =>
                          toggleLimited(current, choice.value, 3),
                        )
                      }
                    />
                  ))}
                </div>
              )}

              {step === 3 && (
                <div>
                  <ActivityGrid
                    values={preferred}
                    onToggle={(value) => {
                      setAvoided((current) =>
                        current.filter((item) => item !== value),
                      );
                      setPreferred((current) =>
                        toggleLimited(current, value, 3),
                      );
                    }}
                  />
                </div>
              )}

              {step === 4 && (
                <div>
                  <ActivityGrid
                    values={avoided}
                    disabledValues={preferred}
                    muted
                    onToggle={(value) => {
                      setNoAvoidance(false);
                      setAvoided((current) =>
                        toggleLimited(current, value, 3),
                      );
                    }}
                  />
                  <button
                    type="button"
                    aria-pressed={noAvoidance}
                    onClick={() => {
                      setNoAvoidance(true);
                      setAvoided([]);
                    }}
                    className={[
                      "mt-2 flex min-h-[72px] w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left transition",
                      noAvoidance
                        ? "border-[#171714] bg-[#171714] text-white"
                        : "border-black/[0.07] bg-white/70 text-black",
                    ].join(" ")}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-black/[0.04] text-xl">
                      ❌
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] font-extrabold">
                      딱히 없어요
                    </span>
                    <span
                      className={[
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                        noAvoidance
                          ? "border-white bg-white text-[#171714]"
                          : "border-black/12 text-transparent",
                      ].join(" ")}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex gap-2 border-t border-black/[0.05] bg-[#F7F5EF]/92 px-5 pb-5 pt-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => {
            if (step === 0) {
              router.push(
                mode === "regeneration" || mode === "upgrade"
                  ? "/meetings?tab=profile"
                  : "/",
              );
            }
            else setStep((current) => current - 1);
          }}
          className="flex min-h-[58px] w-[104px] shrink-0 items-center justify-center gap-1.5 rounded-[19px] border border-black/[0.08] bg-white text-[13px] font-extrabold text-black/58"
        >
          <ArrowLeft className="h-4 w-4" />
          이전
        </button>
        <button
          type="button"
          disabled={!canContinue || saving}
          onClick={() => {
            if (step === steps.length - 1) {
              void completeQuestions();
            } else {
              if (
                mode === "onboarding" ||
                mode === "regeneration" ||
                mode === "upgrade"
              ) {
                void persistAnswers().catch(() => {
                  setError("답변을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
                });
              }
              setStep((current) => current + 1);
            }
          }}
          className="flex min-h-[58px] flex-1 items-center justify-center gap-2 rounded-[19px] bg-[#171714] text-[14px] font-extrabold text-white transition disabled:bg-black/[0.08] disabled:text-black/25"
        >
          {saving
            ? "저장 중..."
            : step === steps.length - 1
              ? "선택 완료하기"
              : "다음"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {error && (
        <p className="absolute inset-x-5 bottom-24 rounded-[16px] bg-red-50 px-4 py-3 text-center text-[11px] font-bold text-red-600 shadow-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export function TableCardSurveyPreview() {
  return <PreferenceQuestionFlow mode="preview" />;
}

function ActivityGrid({
  values,
  onToggle,
  disabledValues = [],
  muted = false,
}: {
  values: string[];
  onToggle: (value: string) => void;
  disabledValues?: string[];
  muted?: boolean;
}) {
  return (
    <div className="space-y-2">
      {activityChoices.map((choice) => {
        const selected = values.includes(choice.value);
        const disabled = disabledValues.includes(choice.value);
        return (
          <button
            type="button"
            key={choice.value}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onToggle(choice.value)}
            className={[
              "flex min-h-[72px] w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left transition",
              disabled
                ? "cursor-not-allowed border-black/[0.04] bg-black/[0.025] text-black opacity-35 grayscale"
                : selected
                ? muted
                  ? "border-[#8A4F4A] bg-[#F8ECE9] text-[#6D3632] shadow-[inset_0_0_0_1px_#8A4F4A]"
                  : "border-[#171714] bg-white text-black shadow-[inset_0_0_0_1px_#171714]"
                : "border-black/[0.07] bg-white/70 text-black",
            ].join(" ")}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-black/[0.04] text-xl">
              {choice.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-extrabold">
                {choice.label}
              </span>
              <span className="mt-0.5 block text-[10px] font-medium text-black/40">
                {disabled
                  ? "하고 싶은 활동으로 선택했어요"
                  : choice.description}
              </span>
            </span>
            <span
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                selected
                  ? muted
                    ? "border-[#8A4F4A] bg-[#8A4F4A] text-white"
                    : "border-[#171714] bg-[#171714] text-white"
                  : "border-black/12 text-transparent",
              ].join(" ")}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ResultDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-black/[0.035] p-3">
      <p className="text-[9px] font-bold tracking-[0.08em] text-black/34">
        {label}
      </p>
      <p className="mt-1.5 text-[11px] font-bold leading-[1.55] text-black/70">
        {value}
      </p>
    </div>
  );
}
