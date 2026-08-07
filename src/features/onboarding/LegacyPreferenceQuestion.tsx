"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import type { ProfileQuestion, QuestionAnswer } from "@/types/question";

type Choice = {
  value: string;
  label: string;
  emoji: string;
  description?: string;
  color?: string;
};

const movieChoices: Choice[] = [
  { value: "comedy", label: "코미디", emoji: "😂", color: "#F7C95D" },
  { value: "drama", label: "드라마", emoji: "🎭", color: "#E8A6A6" },
  { value: "adventure", label: "모험", emoji: "🗺️", color: "#8FC5AE" },
  { value: "romance", label: "로맨스", emoji: "💌", color: "#D9B4D8" },
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
  { value: "meal", label: "식사·카페", emoji: "🍽️", description: "맛있는 것을 먹으며 대화하기" },
  { value: "culture", label: "문화 콘텐츠", emoji: "🎨", description: "전시·영화·공연 함께 보기" },
  { value: "outdoor", label: "활동·체험", emoji: "🚶", description: "산책·운동·새로운 체험" },
  { value: "play", label: "오락", emoji: "🎲", description: "보드게임과 가벼운 놀이" },
  { value: "reading", label: "독서", emoji: "📚", description: "책과 콘텐츠로 이야기하기" },
  { value: "taste", label: "취향 탐색", emoji: "🛍️", description: "쇼핑·플리마켓 둘러보기" },
];

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
              <span className="block text-[13px] font-extrabold">{choice.label}</span>
              <span className="mt-0.5 block text-[10px] font-medium text-black/40">
                {disabled ? "하고 싶은 활동으로 선택했어요" : choice.description}
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

export function LegacyPreferenceQuestion({
  question,
  questionIndex,
  questionCount,
  answer,
  preferredValues,
  saving,
  canContinue,
  onBack,
  onContinue,
  onSelectSingle,
  onToggleMultiple,
}: {
  question: ProfileQuestion;
  questionIndex: number;
  questionCount: number;
  answer?: QuestionAnswer;
  preferredValues: string[];
  saving: boolean;
  canContinue: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSelectSingle: (value: string) => void;
  onToggleMultiple: (value: string) => void;
}) {
  const order = question.order ?? question.id;
  const singleValue = typeof answer?.value === "string" ? answer.value : "";
  const selectedValues = Array.isArray(answer?.value) ? answer.value : [];
  const noAvoidance = selectedValues.includes("no_avoidance");

  return (
    <div className="relative flex min-h-dvh flex-col bg-[#F7F5EF] md:min-h-[calc(100dvh-32px)]">
      <header className="px-5 pb-3 pt-5">
        <div className="flex items-center justify-center">
          <p className="text-[10px] font-extrabold tracking-[0.22em] text-black/55">
            {questionIndex + 1} / {questionCount}
          </p>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/[0.06]">
          <motion.div
            className="h-full rounded-full bg-[#171714]"
            animate={{ width: `${((questionIndex + 1) / questionCount) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </header>

      <div className="flex-1 px-5 pb-28 pt-7">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          <h1 className="whitespace-pre-line text-[27px] font-extrabold leading-[1.25] tracking-[-0.055em] text-[#171714]">
            {question.question}
          </h1>
          {question.prompt && (
            <p className="mt-2 text-[12px] font-medium leading-5 text-black/42">
              {question.prompt}
            </p>
          )}

          <div className="mt-6">
            {order === 1 && (
              <div className="grid grid-cols-2 gap-2.5">
                {movieChoices.map((choice) => {
                  const selected = singleValue === choice.value;
                  return (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      key={choice.value}
                      aria-pressed={selected}
                      onClick={() => onSelectSingle(choice.value)}
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
                      <span className="relative text-2xl" aria-hidden>{choice.emoji}</span>
                      <span className="relative mt-3 block text-[17px] font-extrabold">{choice.label}</span>
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

            {order === 2 && (
              <div className="flex flex-wrap gap-2">
                {interestChoices.map((choice) => (
                  <ChoiceChip
                    key={choice.value}
                    choice={choice}
                    selected={selectedValues.includes(choice.value)}
                    onClick={() => onToggleMultiple(choice.value)}
                  />
                ))}
              </div>
            )}

            {order === 3 && (
              <div className="grid grid-cols-2 gap-2">
                {qualityChoices.map((choice) => (
                  <ChoiceChip
                    key={choice.value}
                    choice={choice}
                    selected={selectedValues.includes(choice.value)}
                    onClick={() => onToggleMultiple(choice.value)}
                  />
                ))}
              </div>
            )}

            {order === 4 && (
              <ActivityGrid values={selectedValues} onToggle={onToggleMultiple} />
            )}

            {order === 5 && (
              <div>
                <ActivityGrid
                  values={selectedValues}
                  disabledValues={preferredValues}
                  muted
                  onToggle={onToggleMultiple}
                />
                <button
                  type="button"
                  aria-pressed={noAvoidance}
                  onClick={() => onToggleMultiple("no_avoidance")}
                  className={[
                    "mt-2 flex min-h-[72px] w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left transition",
                    noAvoidance
                      ? "border-[#171714] bg-[#171714] text-white"
                      : "border-black/[0.07] bg-white/70 text-black",
                  ].join(" ")}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-black/[0.04] text-xl">❌</span>
                  <span className="min-w-0 flex-1 text-[13px] font-extrabold">딱히 없어요</span>
                  <span className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                    noAvoidance
                      ? "border-white bg-white text-[#171714]"
                      : "border-black/12 text-transparent",
                  ].join(" ")}>
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex gap-2 border-t border-black/[0.05] bg-[#F7F5EF]/92 px-5 pb-5 pt-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-[58px] w-[104px] shrink-0 items-center justify-center gap-1.5 rounded-[19px] border border-black/[0.08] bg-white text-[13px] font-extrabold text-black/58"
        >
          <ArrowLeft className="h-4 w-4" />
          이전
        </button>
        <button
          type="button"
          disabled={!canContinue || saving}
          onClick={onContinue}
          className="flex min-h-[58px] flex-1 items-center justify-center gap-2 rounded-[19px] bg-[#171714] text-[14px] font-extrabold text-white transition disabled:bg-black/[0.08] disabled:text-black/25"
        >
          다음
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
