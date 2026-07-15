"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ExternalLink,
  Gift,
  Info,
  LogOut,
  PenLine,
  RotateCcw,
  Sparkles,
  UserRound,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { VibeGraph } from "@/components/vibe/VibeGraph";
import {
  type VibeAxis,
  type VibeScores,
} from "@/components/vibe/vibeGraphConfig";
import {
  conversationResultOverview,
  conversationResults,
  type ConversationResultCode,
} from "@/data/conversationResults";
import { calculateConversationResultCode } from "@/lib/conversationResult";
import type { ProfileRow } from "@/types/profile";
import type { QuestionAnswer } from "@/types/question";

type AnswerMap = Record<number, QuestionAnswer>;

const profileVibeAxes = [
  "temperature",
  "texture",
  "tone",
  "rhythm",
] as const satisfies readonly VibeAxis[];

type ProfileVibeAxis = (typeof profileVibeAxes)[number];

const profileScoreColumns = {
  temperature: "score_temperature",
  texture: "score_texture",
  tone: "score_tone",
  rhythm: "score_rhythm",
} as const satisfies Record<ProfileVibeAxis, keyof ProfileRow>;

const conversationAxisLabelOverrides = {
  temperature: {
    label: "낯선 자리의 시작",
    leftLabel: "천천히 살피는",
    rightLabel: "먼저 여는",
  },
  texture: {
    label: "대화를 여는 방식",
    leftLabel: "들으며 잇는",
    rightLabel: "질문으로 여는",
  },
  tone: {
    label: "차이를 다루는 방식",
    leftLabel: "조화를 찾는",
    rightLabel: "차이를 탐색하는",
  },
  rhythm: {
    label: "만남의 분위기",
    leftLabel: "편안한",
    rightLabel: "새로운 발견",
  },
} as const;

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function answerScore(answer?: QuestionAnswer) {
  const value =
    typeof answer?.value === "number"
      ? answer.value
      : typeof answer?.value === "string"
        ? Number.parseInt(answer.value, 10)
        : null;

  if (value === null || !Number.isFinite(value)) return null;
  return value >= 1 && value <= 5 ? value : null;
}

function clampInternalScore(value: number) {
  return Math.min(100, Math.max(-100, value));
}

function answerScoreToInternalScore(value: number | null) {
  return value === null ? null : clampInternalScore((value - 3) * 50);
}

function currentProfileScore(profile: ProfileRow, axis: ProfileVibeAxis) {
  const value = profile[profileScoreColumns[axis]];
  return typeof value === "number" && Number.isFinite(value)
    ? clampInternalScore(value)
    : null;
}

function profileAxisScore(
  profile: ProfileRow,
  answers: AnswerMap,
  axis: ProfileVibeAxis,
  answerOrder: number,
) {
  return (
    currentProfileScore(profile, axis) ??
    answerScoreToInternalScore(answerScore(answers[answerOrder])) ??
    0
  );
}

function profileVibeScores(profile: ProfileRow, answers: AnswerMap): VibeScores {
  return {
    temperature: profileAxisScore(profile, answers, "temperature", 1),
    texture: profileAxisScore(profile, answers, "texture", 2),
    tone: profileAxisScore(profile, answers, "tone", 3),
    rhythm: profileAxisScore(profile, answers, "rhythm", 4),
  };
}

function conversationAxisScore(
  answers: AnswerMap,
  orders: number[],
  left: string,
  right: string,
  fallback: string | undefined,
) {
  const values = orders.map((order) => answers[order]?.value);
  if (values.every((value) => value === left || value === right)) {
    const rightCount = values.filter((value) => value === right).length;
    const leftCount = values.length - rightCount;
    return ((rightCount - leftCount) / values.length) * 100;
  }
  if (fallback === left) return -65;
  if (fallback === right) return 65;
  return 0;
}

function conversationVibeScores(
  answers: AnswerMap,
  code: ConversationResultCode,
): VibeScores {
  return {
    temperature: conversationAxisScore(answers, [1, 2, 3, 4], "O", "I", code[0]),
    texture: conversationAxisScore(answers, [5, 6, 7, 8], "L", "Q", code[1]),
    tone: conversationAxisScore(answers, [9, 10, 11, 12], "H", "W", code[2]),
    rhythm: conversationAxisScore(answers, [13, 14, 15, 16], "C", "E", code[3]),
  };
}

function resolvedConversationResultCode(
  profile: ProfileRow,
  answers: AnswerMap,
): ConversationResultCode | null {
  const storedCode = profile.conversation_result_code;
  if (storedCode && storedCode in conversationResults) {
    return storedCode as ConversationResultCode;
  }

  return calculateConversationResultCode(
    Array.from({ length: 16 }, (_, index) => ({
      question_order: index + 1,
      answer_value:
        typeof answers[index + 1]?.value === "string"
          ? String(answers[index + 1].value)
          : null,
    })),
  );
}

function conversationResultTags(code: ConversationResultCode) {
  return [
    code[0] === "O" ? "천천히 살피는 시작" : "먼저 여는 시작",
    code[1] === "L" ? "들으며 잇는 대화" : "질문으로 여는 대화",
    code[2] === "H" ? "조화를 찾는 관점" : "차이를 탐색하는 관점",
    code[3] === "C" ? "편안한 만남" : "새로운 발견이 있는 만남",
  ];
}

function participationPrecisionLevel(count: number) {
  if (!Number.isFinite(count)) return 0;
  return Math.min(5, Math.max(0, Math.floor(count)));
}

function profileMatchingPrecisionCount(
  profile: Pick<ProfileRow, "matching_precision_bonus">,
  participationCount: number,
) {
  const bonus = profile.matching_precision_bonus ?? 0;
  return participationCount + bonus;
}

function fallbackNickname(name: string | null | undefined) {
  const korean = (name ?? "").replace(/[^가-힣]/g, "");
  return korean.length >= 2 ? korean.slice(-2) : korean || "??";
}

function profileNickname(profile: Pick<ProfileRow, "name" | "nickname">) {
  const nickname = profile.nickname?.trim();
  return nickname && /^[가-힣]{2}$/.test(nickname)
    ? nickname
    : fallbackNickname(profile.name);
}

function profileInitial(profile: ProfileRow) {
  return profileNickname(profile);
}

function profileEmoji(profile: Pick<ProfileRow, "public_emoji">) {
  return profile.public_emoji?.trim() || "💎";
}

function ParticipationDiamondNode({
  step,
  current,
  reached,
  showGift = false,
}: {
  step: number;
  current: boolean;
  reached: boolean;
  showGift?: boolean;
}) {
  const fill = reached ? "var(--accent)" : "#FFFFFF";
  const stroke = reached || current ? "var(--accent)" : "rgba(0,0,0,0.16)";
  const textFill = reached
    ? "#FFFFFF"
    : current
      ? "var(--accent)"
      : "rgba(0,0,0,0.34)";

  return (
    <span className="relative inline-flex h-10 w-10 items-center justify-center">
      <svg
        viewBox="0 0 32 42"
        className={cn(
          "h-10 w-8 shrink-0 overflow-visible transition",
          current && "drop-shadow-[0_5px_10px_rgba(126,179,199,0.24)]",
        )}
        aria-hidden
      >
        <path
          d="M16 2.5 29 21 16 39.5 3 21Z"
          fill={fill}
          stroke={stroke}
          strokeLinejoin="round"
          strokeWidth={current ? 2.6 : 2}
        />
        <text
          x="16"
          y="22"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textFill}
          fontSize="10.5"
          fontWeight="900"
        >
          {step}
        </text>
      </svg>
      {showGift && <ParticipationGiftButton />}
    </span>
  );
}

function ParticipationMilestoneProgress({
  precisionCount,
}: {
  precisionCount: number;
}) {
  const level = participationPrecisionLevel(precisionCount);
  const currentStep = level < 5 ? level + 1 : null;

  return (
    <div
      className="mt-4 w-full"
      title="참여할수록 추천과 분석이 5단계까지 정교해져요."
      aria-label={`참여 정교화 ${level}/5단계`}
    >
      <div className="grid grid-cols-5 place-items-center gap-3">
        {Array.from({ length: 5 }, (_, index) => {
          const step = index + 1;
          const reached = step <= level;
          const current = step === currentStep;

          return (
            <ParticipationDiamondNode
              key={step}
              step={step}
              current={current}
              reached={reached}
              showGift={step === 5}
            />
          );
        })}
      </div>
    </div>
  );
}

function ParticipationRecord({
  precisionCount,
}: {
  precisionCount: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[14px] font-black text-black">참여 기록</h3>
        <ParticipationRecordInfoButton />
      </div>
      <p className="mt-1 text-xs font-semibold leading-5 text-black/40">
        참여할수록 나의 대화결이 정교해져요.
      </p>
      <ParticipationMilestoneProgress precisionCount={precisionCount} />
    </div>
  );
}

function InfoTooltipButton({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        containerRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-black/18 bg-white text-black/45 transition hover:border-black/35 hover:text-black/70"
      >
        <Info size={12} strokeWidth={2.6} aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute left-0 top-[calc(100%+8px)] z-30 w-[258px] rounded-2xl border border-black/10 bg-white px-4 py-3 text-xs font-semibold leading-5 text-black/62 shadow-[0_14px_36px_rgba(0,0,0,0.14)]"
          >
            <span
              aria-hidden
              className="absolute -top-[6px] left-3 h-3 w-3 rotate-45 border-l border-t border-black/10 bg-white"
            />
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VibeGraphInfoButton() {
  return (
    <InfoTooltipButton ariaLabel="나의 대화결 설명 보기">
      나의 대화결은 질문 답변을 바탕으로 교집합이 자리를 제안할 때 참고하는
      대화 분위기예요. 참여와 피드백이 쌓일수록 추천이 더 정교해져요.
    </InfoTooltipButton>
  );
}

function ParticipationRecordInfoButton() {
  return (
    <InfoTooltipButton ariaLabel="참여 기록 설명 보기">
      참여와 피드백을 바탕으로 나의 대화결 점수를 정교하게 조정해요. 이를
      바탕으로 나에게 더 맞는 사람들과 장소가 추천돼요.
    </InfoTooltipButton>
  );
}

function ParticipationGiftButton() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        containerRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="absolute -right-2.5 -top-3 z-10">
      <motion.button
        type="button"
        aria-label="5번 참여 멤버십 혜택 보기"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        animate={
          shouldReduceMotion
            ? undefined
            : {
                scale: [1, 1.08, 1],
                boxShadow: [
                  "0 4px 10px rgba(126,179,199,0.24)",
                  "0 0 0 7px rgba(126,179,199,0.16), 0 8px 18px rgba(126,179,199,0.32)",
                  "0 4px 10px rgba(126,179,199,0.24)",
                ],
              }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : {
                duration: 2.2,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 0.45,
              }
        }
        whileTap={{ scale: 0.94 }}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/55 bg-white text-accent shadow-[0_4px_10px_rgba(126,179,199,0.24)] transition hover:-translate-y-0.5 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2"
      >
        <Gift size={16} strokeWidth={2.5} aria-hidden />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 top-[calc(100%+10px)] z-40 w-[224px] rounded-2xl border border-black/10 bg-white px-4 py-3 text-xs font-semibold leading-5 text-black/62 shadow-[0_14px_36px_rgba(0,0,0,0.14)]"
          >
            <span
              aria-hidden
              className="absolute -top-[6px] right-2 h-3 w-3 rotate-45 border-l border-t border-black/10 bg-white"
            />
            <strong className="font-black text-black/78">
              5번 참여 시 1개월 멤버십
            </strong>
            을
            <br />
            지급해드려요.
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

function TabMotion({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="h-full min-h-full"
    >
      {children}
    </motion.div>
  );
}

export function ProfileTab({
  profile,
  answers,
  participationCount,
  vibeAnimationKey,
  loggingOut,
  logoutError,
  onOpenQuestionReview,
  onOpenProfileCompletionReplay,
  onRequestProfileRegeneration,
  onLogout,
  operatorConversationPreview = false,
}: {
  profile: ProfileRow;
  answers: AnswerMap;
  participationCount: number;
  vibeAnimationKey: number;
  loggingOut: boolean;
  logoutError: string | null;
  onOpenQuestionReview: () => void;
  onOpenProfileCompletionReplay: () => void;
  onRequestProfileRegeneration: () => void;
  onLogout: () => Promise<void>;
  operatorConversationPreview?: boolean;
}) {
  const publicIntro = profile.public_intro?.trim();
  const storedConversationCode = useMemo(
    () => resolvedConversationResultCode(profile, answers),
    [answers, profile],
  );
  const usesNewConversationProfile =
    operatorConversationPreview ||
    (profile.conversation_result_version === "v1" &&
      Boolean(storedConversationCode));
  const conversationCode =
    storedConversationCode ?? (operatorConversationPreview ? "OQHC" : null);
  const conversationResult = conversationCode
    ? conversationResults[conversationCode]
    : null;
  const conversationTags = conversationCode
    ? conversationResultTags(conversationCode)
    : [];
  const matchingPrecisionCount = profileMatchingPrecisionCount(
    profile,
    participationCount,
  );
  const vibeScores = useMemo(
    () =>
      usesNewConversationProfile && conversationCode
        ? conversationVibeScores(answers, conversationCode)
        : profileVibeScores(profile, answers),
    [answers, conversationCode, profile, usesNewConversationProfile],
  );

  return (
    <TabMotion>
      <section className="px-5 pb-7 pt-7">
        <header className="pr-16">
          <h1 className="text-[27px] font-bold leading-9 tracking-tight text-black">
            {profileInitial(profile)}님의 프로필
          </h1>
        </header>

        {usesNewConversationProfile && conversationResult && conversationCode ? (
          <section className="mt-7 rounded-[24px] border border-black/[0.08] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(0,0,0,0.035)]">
            <p className="text-[11px] font-bold tracking-[-0.01em] text-black/38">
              {operatorConversationPreview && !storedConversationCode
                ? "운영자 미리보기"
                : "나의 대화 결과"}{" "}
              · {conversationCode}
            </p>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-black/88">
              {conversationResult.title}
            </h2>
            <p className="mt-2 break-keep text-[13px] font-semibold leading-5 tracking-[-0.02em] text-black/45">
              {conversationResult.subtitle}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {conversationTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-black/[0.07] bg-[#f7f7f5] px-3 py-2 text-[11px] font-bold tracking-[-0.02em] text-black/52"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-5 break-keep text-[14px] font-medium leading-6 tracking-[-0.02em] text-black/62">
              {conversationResultOverview(conversationResult.body)}
            </p>
          </section>
        ) : (
          <section className="mt-7 rounded-2xl border border-black/10 bg-white px-5 py-5 shadow-[0_10px_28px_rgba(0,0,0,0.035)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
              about me
            </p>
            <h2 className="mt-2 flex items-center gap-2 text-xl font-bold leading-7 text-black">
              <span>{profileNickname(profile)}</span>
              <span aria-hidden className="text-base leading-none">
                {profileEmoji(profile)}
              </span>
            </h2>
            <p className="mt-5 whitespace-pre-line text-sm font-medium leading-7 text-black/62">
              {publicIntro ?? "아직 소개가 준비 중이에요."}
            </p>
          </section>
        )}

        <VibeGraph
          title="나의 대화결"
          titleInlineAccessory={<VibeGraphInfoButton />}
          footer={
            <ParticipationRecord precisionCount={matchingPrecisionCount} />
          }
          description="교집합이 자리를 제안할 때 참고하는 분위기예요."
          scores={vibeScores}
          visibleAxes={profileVibeAxes}
          showAxisHeader={usesNewConversationProfile}
          axisLabelOverrides={
            usesNewConversationProfile
              ? conversationAxisLabelOverrides
              : undefined
          }
          scoreScale="internal"
          animationKey={vibeAnimationKey}
          monochrome={usesNewConversationProfile}
          className="mt-5"
        />

        <a
          href="/"
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-accent/35 bg-accent/[0.08] text-xs font-bold text-black/62 transition hover:border-accent/55 hover:bg-accent/[0.12] hover:text-black/75"
        >
          <ExternalLink size={15} aria-hidden />
          상세페이지 다시보기
        </a>

        {profile.is_test_participant && (
          <div className="mt-3 space-y-3">
            <button
              type="button"
              onClick={onOpenQuestionReview}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-xs font-semibold text-black/55 transition hover:border-black/18 hover:text-black/70"
            >
              <PenLine size={15} aria-hidden />
              질문 다시보기
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/onboarding/profile?from=profile";
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-xs font-semibold text-black/55 transition hover:border-black/18 hover:text-black/70"
            >
              <UserRound size={15} aria-hidden />
              기본정보 다시보기
            </button>
          </div>
        )}

        {profile.is_test_participant && (
          <button
            type="button"
            onClick={onOpenProfileCompletionReplay}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-xs font-semibold text-black/55 transition hover:border-black/18 hover:text-black/70"
          >
            <Sparkles size={15} aria-hidden />
            프로필 완성 다시보기
          </button>
        )}

        <button
          type="button"
          onClick={onRequestProfileRegeneration}
          className="mt-8 flex min-h-[58px] w-full items-center justify-between gap-3 rounded-[18px] border border-black/10 bg-white px-4 py-3 text-left transition hover:border-black/20 hover:bg-black/[0.015]"
        >
          <span>
            <span className="block text-xs font-black text-black/62">
              프로필 새로 만들기
            </span>
            <span className="mt-1 block text-[11px] font-semibold leading-4 text-black/38">
              질문을 다시 답하고 내 대화 결을 새로 만들어요.
            </span>
          </span>
          <RotateCcw size={16} className="shrink-0 text-black/35" aria-hidden />
        </button>

        <button
          type="button"
          disabled={loggingOut}
          onClick={() => void onLogout()}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-white text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
        >
          <LogOut size={15} aria-hidden />
          {loggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>

        <a
          href="http://pf.kakao.com/_xnweQn/chat"
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-xs font-semibold text-black/55 transition hover:border-black/18 hover:text-black/70"
        >
          <Info size={15} aria-hidden />
          문의하기
        </a>

        <a
          href="/privacy"
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-xs font-semibold text-black/55 transition hover:border-black/18 hover:text-black/70"
        >
          <Info size={15} aria-hidden />
          개인정보 처리방침
        </a>

        {logoutError && (
          <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-center text-xs font-semibold leading-5 text-red-600">
            {logoutError}
          </p>
        )}
      </section>
    </TabMotion>
  );
}
