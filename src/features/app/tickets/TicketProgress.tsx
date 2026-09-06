"use client";
import {
  formatTicketDateLabel,
  formatTicketTimeLabel,
} from "@/components/IntersectionTicketCard";
import { NaverMapPreview } from "@/components/NaverMapPreview";
import { ConversationCards } from "@/features/meetings/ConversationCards";
import {
  TicketDetailContent,
  type TicketDetailSectionKey,
} from "@/features/meetings/TicketDetailContent";
import { courseStepOpenOffsetMinutes } from "@/lib/ticketCourse";
import { ticketStageText } from "@/lib/ticketStageCopy";
import type {
  GatheringTicket,
  TicketArrivalStatus,
  TicketPlace,
  TicketProgressStep,
  UserTicket,
} from "@/types/ticket";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  MapPin,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ArrivalStatusPanel } from "./TicketArrival";

export const TicketFeedbackForm = dynamic(
  () =>
    import("@/features/feedback/TicketFeedbackForm").then(
      (module) => module.TicketFeedbackForm,
    ),
  {
    loading: () => (
      <p className="p-5 text-sm text-black/50">피드백을 불러오고 있어요.</p>
    ),
  },
);

export function StoredTicketDetailView({
  userTicket,
  onClose,
  onCancelApplication,
  previewMode = false,
  participantPhotoUrl = null,
  previewMatchPhotoUrls = [],
  previewOtherMemberPhotoUrls = [],
  selectedProgressStep: controlledProgressStep,
  onProgressStepChange,
}: {
  userTicket: UserTicket;
  onClose: () => void;
  onCancelApplication?: () => Promise<boolean>;
  previewMode?: boolean;
  participantPhotoUrl?: string | null;
  previewMatchPhotoUrls?: string[];
  previewOtherMemberPhotoUrls?: string[];
  selectedProgressStep?: TicketProgressViewStepKey;
  onProgressStepChange?: (step: TicketProgressViewStepKey) => void;
}) {
  const ticket = userTicket.ticket;
  const matchedMembers = userTicket.members.filter((member) => !member.isSelf);
  const matchedMemberPhotoUrls = matchedMembers
    .map((member) => member.photoUrl?.trim())
    .filter((photoUrl): photoUrl is string => Boolean(photoUrl));
  const hasAuthoritativeMembers = userTicket.members.length > 0;
  const displayedMatchPhotoUrls = hasAuthoritativeMembers
    ? matchedMemberPhotoUrls
    : previewMatchPhotoUrls;
  const displayedMatchMemberCount = hasAuthoritativeMembers
    ? matchedMembers.length
    : undefined;
  const currentGroupMemberIds = new Set(
    userTicket.members.map((member) => member.id),
  );
  const otherGroupMembers = (userTicket.feedbackMembers ?? []).filter(
    (member) => !member.isSelf && !currentGroupMemberIds.has(member.id),
  );
  const otherGroupPhotoUrls = otherGroupMembers
    .map((member) => member.photoUrl?.trim())
    .filter((photoUrl): photoUrl is string => Boolean(photoUrl));
  const displayedOtherMemberPhotoUrls =
    otherGroupMembers.length > 0
      ? otherGroupPhotoUrls.slice(0, 6)
      : previewOtherMemberPhotoUrls;
  const [progressNow, setProgressNow] = useState(() => new Date());
  const [statusOpen, setStatusOpen] = useState(true);
  const [internalProgressStep, setInternalProgressStep] =
    useState<TicketProgressViewStepKey>(() =>
      defaultProgressViewStepKey(
        ticket,
        userTicket.progressStep,
        userTicket.meetingStartAt,
      ),
    );
  const selectedProgressStep = controlledProgressStep ?? internalProgressStep;
  const activeProgressStep = defaultProgressViewStepKey(
    ticket,
    userTicket.progressStep,
    userTicket.meetingStartAt,
    progressNow,
  );

  useEffect(() => {
    const timer = window.setInterval(() => setProgressNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (controlledProgressStep) return;
    setInternalProgressStep(activeProgressStep);
  }, [
    activeProgressStep,
    controlledProgressStep,
    userTicket.id,
    userTicket.progressStep,
  ]);

  useEffect(() => {
    if (controlledProgressStep) return;
    setInternalProgressStep((current) => {
      const currentIndex = progressViewStepIndex(
        ticketProgressViewSteps(ticket),
        current,
      );
      const activeIndex = progressViewStepIndex(
        ticketProgressViewSteps(ticket),
        activeProgressStep,
      );
      return currentIndex < activeIndex ? activeProgressStep : current;
    });
  }, [activeProgressStep, controlledProgressStep, ticket]);

  const handleProgressStepChange = useCallback(
    (step: TicketProgressViewStepKey) => {
      if (!controlledProgressStep) setInternalProgressStep(step);
      onProgressStepChange?.(step);
    },
    [controlledProgressStep, onProgressStepChange],
  );

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="relative min-h-full overflow-hidden bg-[linear-gradient(180deg,#faf8f3_0%,#f7f4ee_48%,#f2eee6_100%)] px-5 pb-[calc(112px+env(safe-area-inset-bottom))] pt-[calc(72px+env(safe-area-inset-top))] text-[#24211d]"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="티켓 상세 닫기"
        className="absolute left-4 top-[calc(14px+env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center text-[#24211d]/58 transition hover:text-[#24211d]"
      >
        <X size={18} aria-hidden />
      </button>

      <motion.header
        initial={{ y: "32vh" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
        className="px-10 text-center"
      >
        <h1 className="font-ticket-latin whitespace-pre-line text-[30px] font-medium leading-[1.12] tracking-[-0.025em] text-[#24211d]">
          {ticket.title}
        </h1>
        <p className="font-ticket-latin mt-4 text-[13px] font-medium text-[#24211d]/58">
          {[
            formatTicketDateLabel(ticket.date),
            formatTicketTimeLabel(ticket.time),
          ]
            .filter(Boolean)
            .join(" · ")}
          {ticket.area ? ` · 서울 ${ticket.area}` : ""}
        </p>
        <button
          type="button"
          aria-expanded={statusOpen}
          onClick={() => setStatusOpen((current) => !current)}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#d0cbbc] px-4 py-2 text-[11px] font-semibold text-[#24211d]/58 transition hover:border-[#a9a294] hover:text-[#24211d]"
        >
          {userTicket.statusLabel}
          {statusOpen ? (
            <ChevronUp size={13} aria-hidden />
          ) : (
            <ChevronDown size={13} aria-hidden />
          )}
        </button>
      </motion.header>

      <motion.article
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34, duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
        className="ticket-detail-stone mt-8 border-t border-[#d0cbbc] px-1 pb-5 pt-1 text-[#24211d]"
      >
        <TicketStatusOverview
          userTicket={userTicket}
          now={progressNow}
          open={statusOpen}
          selectedProgressStep={selectedProgressStep}
          onSelectProgressStep={handleProgressStepChange}
        />
        <TicketStageContent
          userTicket={userTicket}
          progressStep={selectedProgressStep}
          previewMode={previewMode}
          participantPhotoUrl={participantPhotoUrl}
          previewMatchPhotoUrls={displayedMatchPhotoUrls}
          previewOtherMemberPhotoUrls={displayedOtherMemberPhotoUrls}
          matchMemberCount={displayedMatchMemberCount}
          onCancelApplication={onCancelApplication}
        />
      </motion.article>
    </motion.section>
  );
}

export type TicketActivityCourseStep = NonNullable<
  GatheringTicket["courseSteps"]
>[number];

export type TicketProgressViewStepKey =
  | TicketProgressStep
  | `activity:${string}`;

export type TicketProgressViewStep = {
  key: TicketProgressViewStepKey;
  label: string;
  baseStep: TicketProgressStep;
  courseStep?: TicketActivityCourseStep;
};

export const ticketBaseProgressSteps: Array<{
  key: Exclude<TicketProgressStep, "in_progress">;
  label: string;
}> = [
  { key: "applied", label: "신청 완료" },
  { key: "approved", label: "참여 확정" },
  { key: "pre_start", label: "시작 전 안내" },
  { key: "feedback", label: "피드백 작성" },
];

export const activityStepLabels = [
  "첫 활동",
  "두 번째 활동",
  "세 번째 활동",
  "네 번째 활동",
  "다섯 번째 활동",
] as const;

export function activityStepLabel(index: number) {
  return activityStepLabels[index] ?? `${index + 1}번째 활동`;
}

export function cleanActivityCourseSteps(ticket: GatheringTicket) {
  return (ticket.courseSteps ?? []).filter((step) =>
    Boolean(
      step.title?.trim() ||
        step.activityType?.trim() ||
        step.imageUrl?.trim() ||
        step.placeName?.trim() ||
        step.address?.trim() ||
        step.place,
    ),
  );
}

export function ticketProgressViewSteps(
  ticket: GatheringTicket,
): TicketProgressViewStep[] {
  const activitySteps = cleanActivityCourseSteps(ticket);
  const activities =
    activitySteps.length > 0
      ? activitySteps
      : [
          {
            id: "activity-1",
            order: 1,
            isMainActivity: true,
          } as TicketActivityCourseStep,
        ];

  return [
    {
      key: "applied",
      label: ticketBaseProgressSteps[0].label,
      baseStep: "applied",
    },
    {
      key: "approved",
      label: ticketBaseProgressSteps[1].label,
      baseStep: "approved",
    },
    {
      key: "pre_start",
      label: ticketBaseProgressSteps[2].label,
      baseStep: "pre_start",
    },
    ...activities.map((courseStep, index) => ({
      key: `activity:${courseStep.id || index + 1}` as TicketProgressViewStepKey,
      label: activityStepLabel(index),
      baseStep: "in_progress" as TicketProgressStep,
      courseStep,
    })),
    {
      key: "feedback",
      label: ticketBaseProgressSteps[3].label,
      baseStep: "feedback",
    },
  ];
}

export function progressViewBaseStep(
  step: TicketProgressViewStepKey,
): TicketProgressStep {
  return step.startsWith("activity:")
    ? "in_progress"
    : (step as TicketProgressStep);
}

export function progressViewStepIndex(
  steps: TicketProgressViewStep[],
  stepKey: TicketProgressViewStepKey,
) {
  const directIndex = steps.findIndex((step) => step.key === stepKey);
  if (directIndex >= 0) return directIndex;

  const baseStep = progressViewBaseStep(stepKey);
  return Math.max(
    steps.findIndex((step) => step.baseStep === baseStep),
    0,
  );
}

export function defaultProgressViewStepKey(
  ticket: GatheringTicket,
  progressStep: TicketProgressStep,
  meetingStartAt: string | null = null,
  now = new Date(),
): TicketProgressViewStepKey {
  if (progressStep === "in_progress") {
    return currentActivityProgressViewStepKey(ticket, meetingStartAt, now);
  }

  return progressStep;
}

export function currentActivityProgressViewStepKey(
  ticket: GatheringTicket,
  meetingStartAt: string | null,
  now: Date,
) {
  const activitySteps = ticketProgressViewSteps(ticket).filter(
    (step) => step.baseStep === "in_progress",
  );
  const firstActivity = activitySteps[0];
  if (!firstActivity) return "in_progress" as TicketProgressViewStepKey;

  const startAt = meetingStartAt ? new Date(meetingStartAt) : null;
  if (!startAt || !Number.isFinite(startAt.getTime())) return firstActivity.key;

  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - startAt.getTime()) / (60 * 1000)),
  );
  let activeActivity = firstActivity;

  for (const [index, activity] of activitySteps.entries()) {
    if (
      courseStepOpenOffsetMinutes(
        activity.courseStep?.openOffsetMinutes,
        index,
      ) <= elapsedMinutes
    ) {
      activeActivity = activity;
    }
  }

  return activeActivity.key;
}

export function reachedProgressViewStepIndex(
  ticket: GatheringTicket,
  progressStep: TicketProgressStep,
  meetingStartAt: string | null = null,
  now = new Date(),
) {
  const steps = ticketProgressViewSteps(ticket);

  if (progressStep === "in_progress") {
    return progressViewStepIndex(
      steps,
      currentActivityProgressViewStepKey(ticket, meetingStartAt, now),
    );
  }

  return progressViewStepIndex(
    steps,
    defaultProgressViewStepKey(ticket, progressStep, meetingStartAt, now),
  );
}

export const introDetailSections: TicketDetailSectionKey[] = [
  "summary",
  "course",
];

export const appliedDetailSections: TicketDetailSectionKey[] = [
  "summary",
  "course",
];

export const ticketGuidanceClass =
  "mt-4 rounded-2xl border border-[#d8d1c3]/80 bg-[#eee9df] px-4 py-3 text-xs font-bold leading-5 text-[#4b443b]";

export function countdownText(
  targetIso: string | null,
  label: string,
  now: Date,
) {
  if (!targetIso) return null;
  const target = new Date(targetIso);
  const remainingMs = target.getTime() - now.getTime();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeText = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;

  return `${label} ${timeText} 남았어요`;
}

export function ticketActivityOpensAt(
  ticket: GatheringTicket,
  meetingStartAt: string | null,
  activityIndex: number,
) {
  const startAt = meetingStartAt ? new Date(meetingStartAt) : null;
  if (!startAt || !Number.isFinite(startAt.getTime())) return null;

  const activity = ticketProgressViewSteps(ticket).filter(
    (step) => step.baseStep === "in_progress",
  )[activityIndex];
  if (!activity) return null;

  const openOffsetMinutes = courseStepOpenOffsetMinutes(
    activity.courseStep?.openOffsetMinutes,
    activityIndex,
  );
  return new Date(
    startAt.getTime() + openOffsetMinutes * 60 * 1000,
  ).toISOString();
}

export function useTicketCountdown(userTicket: UserTicket) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  if (userTicket.progressStep === "approved") {
    const text = countdownText(
      userTicket.arrivalOpensAt,
      "시작 전 안내까지",
      now,
    );
    return text ? { text } : null;
  }

  if (userTicket.progressStep === "pre_start") {
    const text = countdownText(
      ticketActivityOpensAt(userTicket.ticket, userTicket.meetingStartAt, 0) ??
        userTicket.meetingStartAt,
      "첫 활동까지",
      now,
    );
    return text ? { text } : null;
  }

  if (userTicket.progressStep === "in_progress") {
    const activitySteps = ticketProgressViewSteps(userTicket.ticket).filter(
      (step) => step.baseStep === "in_progress",
    );
    const activeActivityKey = currentActivityProgressViewStepKey(
      userTicket.ticket,
      userTicket.meetingStartAt,
      now,
    );
    const activeActivityIndex = Math.max(
      activitySteps.findIndex((step) => step.key === activeActivityKey),
      0,
    );
    const nextActivity = activitySteps[activeActivityIndex + 1];
    const targetIso = nextActivity
      ? ticketActivityOpensAt(
          userTicket.ticket,
          userTicket.meetingStartAt,
          activeActivityIndex + 1,
        )
      : userTicket.feedbackOpensAt;
    const label = nextActivity
      ? `${nextActivity.label}까지`
      : "피드백 작성까지";
    const text = countdownText(targetIso, label, now);
    return text ? { text } : null;
  }

  return null;
}

export function TicketStatusOverview({
  userTicket,
  now,
  open,
  selectedProgressStep,
  onSelectProgressStep,
}: {
  userTicket: UserTicket;
  now: Date;
  open: boolean;
  selectedProgressStep: TicketProgressViewStepKey;
  onSelectProgressStep: (step: TicketProgressViewStepKey) => void;
}) {
  const ticket = userTicket.ticket;
  const countdown = useTicketCountdown(userTicket);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.section
          key="ticket-status-overview"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="overflow-hidden border-b border-black/8"
        >
          <div className="py-5">
            <div className="flex w-full items-start justify-between gap-3 text-left">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-black/42">
                  current status
                </p>
                <h2 className="mt-1 text-[17px] font-black text-black">
                  {userTicket.statusLabel}
                </h2>
              </div>
              {countdown && (
                <motion.p
                  key={countdown.text}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-1 shrink-0 rounded-full border border-[#d0cbbc] bg-[#f7f4ed] px-3 py-1.5 text-right text-[11px] font-black leading-4 text-black/62 shadow-[0_8px_18px_rgba(66,57,44,0.08)]"
                >
                  {countdown.text}
                </motion.p>
              )}
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl bg-black/[0.03] px-4 py-3 text-xs font-bold text-black/58">
              <TicketMetaLine Icon={CalendarDays}>
                {formatTicketDateLabel(ticket.date)}{" "}
                {formatTicketTimeLabel(ticket.time)}
              </TicketMetaLine>
              <TicketMetaLine Icon={MapPin}>{ticket.area}</TicketMetaLine>
            </div>

            <TicketProgressSteps
              userTicket={userTicket}
              now={now}
              selectedProgressStep={selectedProgressStep}
              onSelectProgressStep={onSelectProgressStep}
            />
            <TicketStatusGuidance
              userTicket={userTicket}
              selectedProgressStep={selectedProgressStep}
            />
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

export function TicketMetaLine({
  Icon,
  children,
}: {
  Icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-center gap-2 text-sm font-black leading-5 text-black tabular-nums">
      <Icon size={14} className="shrink-0 text-black/35" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export function TicketProgressSteps({
  userTicket,
  now,
  selectedProgressStep,
  onSelectProgressStep,
}: {
  userTicket: UserTicket;
  now: Date;
  selectedProgressStep: TicketProgressViewStepKey;
  onSelectProgressStep: (step: TicketProgressViewStepKey) => void;
}) {
  const steps = ticketProgressViewSteps(userTicket.ticket);
  const visibleStepCount = Math.min(5, steps.length);
  const maxWindowStart = Math.max(0, steps.length - visibleStepCount);
  const [windowStart, setWindowStart] = useState(0);
  const progressViewportRef = useRef<HTMLDivElement | null>(null);
  const progressTrackRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const selectedIndex = progressViewStepIndex(steps, selectedProgressStep);
  const activeIndex = reachedProgressViewStepIndex(
    userTicket.ticket,
    userTicket.progressStep,
    userTicket.meetingStartAt,
    now,
  );
  const visibleSteps = steps.slice(windowStart, windowStart + visibleStepCount);
  const canMoveLeft = windowStart > 0;
  const feedbackVisible = visibleSteps.some(
    (step) => step.baseStep === "feedback",
  );
  const canMoveRight = windowStart < maxWindowStart && !feedbackVisible;
  const progressGapRem = 0.375;
  const visibleGapWidth = `${progressGapRem * Math.max(0, visibleStepCount - 1)}rem`;
  const progressTrackStyle: CSSProperties = {
    gridAutoColumns: `calc((100% - ${visibleGapWidth}) / ${visibleStepCount})`,
  };

  useEffect(() => {
    setWindowStart((current) => Math.min(current, maxWindowStart));
  }, [maxWindowStart, steps.length]);

  useEffect(() => {
    const viewport = progressViewportRef.current;
    const track = progressTrackRef.current;
    const firstStep = track?.firstElementChild as
      | HTMLElement
      | null
      | undefined;
    if (!viewport || !track || !firstStep) return;

    const columnGap = Number.parseFloat(
      window.getComputedStyle(track).columnGap || "0",
    );
    const stepWidth = firstStep.getBoundingClientRect().width + columnGap;

    viewport.scrollTo({
      left: Math.round(windowStart * stepWidth),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [prefersReducedMotion, steps.length, visibleStepCount, windowStart]);

  return (
    <div className="mt-5">
      <div className="grid grid-cols-[26px_minmax(0,1fr)_26px] items-start gap-1.5">
        <ProgressWindowButton
          direction="left"
          disabled={!canMoveLeft}
          onClick={() => setWindowStart((current) => Math.max(0, current - 1))}
        />
        <div ref={progressViewportRef} className="overflow-hidden">
          <div
            ref={progressTrackRef}
            className="grid grid-flow-col gap-1.5"
            style={progressTrackStyle}
          >
            {steps.map((step, index) => {
              const active = index <= activeIndex;
              const current = index === activeIndex;
              const selected = index === selectedIndex;
              const disabled = index > activeIndex;
              const visible =
                index >= windowStart && index < windowStart + visibleStepCount;

              return (
                <div key={step.key} className="min-w-0" aria-hidden={!visible}>
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition",
                      active ? "bg-[#8f877a]" : "bg-black/8",
                    )}
                  />
                  <div className="mt-2 flex min-h-10 flex-col items-center text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`${step.label} 단계 보기`}
                      aria-pressed={selected}
                      aria-current={current ? "step" : undefined}
                      tabIndex={visible ? undefined : -1}
                      onClick={() => onSelectProgressStep(step.key)}
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black transition",
                        selected
                          ? "bg-[#24211d] text-white shadow-[0_4px_12px_rgba(36,33,29,0.22)] ring-2 ring-[#d0cbbc] ring-offset-2 ring-offset-[#f7f4ed]"
                          : active
                            ? "bg-black text-white"
                            : "bg-black/[0.05] text-black/30",
                        active &&
                          !selected &&
                          "hover:-translate-y-0.5 hover:bg-black/[0.08]",
                        disabled && "cursor-default",
                      )}
                    >
                      {active ? <Check size={13} aria-hidden /> : index + 1}
                    </button>
                    <span
                      className={cn(
                        "mt-1 text-[10px] font-black leading-3",
                        selected
                          ? "text-black"
                          : current
                            ? "text-black/75"
                            : active
                              ? "text-black/52"
                              : "text-black/25",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <ProgressWindowButton
          direction="right"
          disabled={!canMoveRight}
          onClick={() =>
            setWindowStart((current) => Math.min(maxWindowStart, current + 1))
          }
        />
      </div>
    </div>
  );
}

export function ProgressWindowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={
        direction === "left" ? "이전 진행 단계 보기" : "다음 진행 단계 보기"
      }
      className={cn(
        "mt-[14px] flex h-6 w-6 items-center justify-center rounded-full border text-black/48 transition",
        disabled
          ? "cursor-default border-black/5 bg-black/[0.025] text-black/15"
          : "border-black/10 bg-[#faf8f2] shadow-sm hover:-translate-y-0.5 hover:border-black/25 hover:text-black",
      )}
    >
      <Icon size={14} aria-hidden />
    </button>
  );
}

export function TicketStatusGuidance({
  userTicket,
  selectedProgressStep,
}: {
  userTicket: UserTicket;
  selectedProgressStep: TicketProgressViewStepKey;
}) {
  const { stageCopy } = userTicket.ticket;
  const baseProgressStep = progressViewBaseStep(selectedProgressStep);

  if (
    baseProgressStep === "applied" &&
    userTicket.status === "payment_pending"
  ) {
    return (
      <p className={ticketGuidanceClass}>
        {ticketStageText(stageCopy, "paymentPending")}
      </p>
    );
  }

  if (baseProgressStep === "applied" && userTicket.status === "waitlisted") {
    return (
      <p className={ticketGuidanceClass}>
        {ticketStageText(stageCopy, "waitlisted")}
      </p>
    );
  }

  if (baseProgressStep === "applied") {
    return (
      <p className={ticketGuidanceClass}>
        {ticketStageText(stageCopy, "applied")}
      </p>
    );
  }

  if (baseProgressStep === "pre_start") {
    return (
      <p className={ticketGuidanceClass}>
        {ticketStageText(stageCopy, "preStart")}
      </p>
    );
  }

  if (baseProgressStep === "in_progress") {
    return (
      <p className={ticketGuidanceClass}>
        {ticketStageText(stageCopy, "inProgress")}
      </p>
    );
  }

  if (baseProgressStep === "feedback") {
    return (
      <p className={ticketGuidanceClass}>
        {ticketStageText(stageCopy, "feedbackOpen")}
      </p>
    );
  }

  return (
    <p className={ticketGuidanceClass}>
      {ticketStageText(stageCopy, "approved")}
    </p>
  );
}

export function selectedActivityCourseStep(
  ticket: GatheringTicket,
  stepKey: TicketProgressViewStepKey,
) {
  if (!stepKey.startsWith("activity:")) return null;

  return (
    ticketProgressViewSteps(ticket).find((step) => step.key === stepKey)
      ?.courseStep ?? null
  );
}

export function courseStepPlace(
  step: TicketActivityCourseStep | null,
): TicketPlace | null {
  if (!step) return null;

  const place = step.place ?? {
    name: step.placeName ?? null,
    address: step.address ?? null,
  };
  const hasPlaceDetails = Boolean(
    place.name?.trim() ||
      place.address?.trim() ||
      typeof place.mapx === "number" ||
      typeof place.mapy === "number",
  );

  return hasPlaceDetails ? place : null;
}

export function TicketStageContent({
  userTicket,
  progressStep,
  previewMode = false,
  participantPhotoUrl = null,
  previewMatchPhotoUrls = [],
  previewOtherMemberPhotoUrls = [],
  matchMemberCount,
  onCancelApplication,
}: {
  userTicket: UserTicket;
  progressStep: TicketProgressViewStepKey;
  previewMode?: boolean;
  participantPhotoUrl?: string | null;
  previewMatchPhotoUrls?: string[];
  previewOtherMemberPhotoUrls?: string[];
  matchMemberCount?: number;
  onCancelApplication?: () => Promise<boolean>;
}) {
  const ticket = userTicket.ticket;
  const baseProgressStep = progressViewBaseStep(progressStep);
  const selectedCourseStep = selectedActivityCourseStep(ticket, progressStep);
  const selectedPlace = courseStepPlace(selectedCourseStep) ?? userTicket.place;
  const reservationName =
    selectedCourseStep?.reservationName?.trim() ||
    ticket.courseSteps?.[0]?.reservationName?.trim() ||
    ticket.reservationName?.trim() ||
    null;
  const [arrivalStatus, setArrivalStatus] =
    useState<TicketArrivalStatus | null>(userTicket.arrivalStatus);

  useEffect(() => {
    setArrivalStatus(userTicket.arrivalStatus);
  }, [userTicket.arrivalStatus, userTicket.waitlistId]);

  if (baseProgressStep === "feedback") {
    return (
      <TicketFeedbackForm userTicket={userTicket} previewMode={previewMode} />
    );
  }

  if (baseProgressStep === "in_progress") {
    return (
      <>
        <ArrivalStatusPanel
          userTicket={userTicket}
          reservationName={reservationName}
          selectedArrivalStatus={arrivalStatus}
          onArrivalStatusChange={setArrivalStatus}
          previewMode={previewMode}
        />
        <TicketDetailContent
          ticket={ticket}
          participantPhotoUrl={participantPhotoUrl}
          participantArrivalStatus={arrivalStatus}
          previewMatchPhotoUrls={previewMatchPhotoUrls}
          previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
          matchMemberCount={matchMemberCount}
          sections={introDetailSections}
          className="mt-0"
          afterActivities={
            <PlaceSection
              userTicket={userTicket}
              place={selectedPlace}
              revealDetails
              onCancelApplication={onCancelApplication}
            />
          }
        />
        <ConversationCards />
        <FeedbackGuide userTicket={userTicket} />
      </>
    );
  }

  if (baseProgressStep === "pre_start") {
    return (
      <>
        <ArrivalStatusPanel
          userTicket={userTicket}
          reservationName={reservationName}
          selectedArrivalStatus={arrivalStatus}
          onArrivalStatusChange={setArrivalStatus}
          previewMode={previewMode}
        />
        <TicketDetailContent
          ticket={ticket}
          participantPhotoUrl={participantPhotoUrl}
          participantArrivalStatus={arrivalStatus}
          previewMatchPhotoUrls={previewMatchPhotoUrls}
          previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
          matchMemberCount={matchMemberCount}
          sections={introDetailSections}
          className="mt-0"
          afterActivities={
            <PlaceSection
              userTicket={userTicket}
              revealDetails
              onCancelApplication={onCancelApplication}
            />
          }
        />
      </>
    );
  }

  if (baseProgressStep === "approved") {
    return (
      <>
        <TicketDetailContent
          ticket={ticket}
          participantPhotoUrl={participantPhotoUrl}
          previewMatchPhotoUrls={previewMatchPhotoUrls}
          previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
          matchMemberCount={matchMemberCount}
          sections={introDetailSections}
          afterActivities={
            <PlaceSection
              userTicket={userTicket}
              revealDetails
              onCancelApplication={onCancelApplication}
            />
          }
        />
      </>
    );
  }

  return (
    <TicketDetailContent
      ticket={ticket}
      participantPhotoUrl={participantPhotoUrl}
      previewMatchPhotoUrls={previewMatchPhotoUrls}
      previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
      matchMemberCount={matchMemberCount}
      sections={appliedDetailSections}
      className="mt-0"
      afterActivities={
        <PlaceSection
          userTicket={userTicket}
          onCancelApplication={onCancelApplication}
        />
      }
    />
  );
}

export function PlaceSection({
  userTicket,
  place = userTicket.place,
  revealDetails = false,
  onCancelApplication,
}: {
  userTicket: UserTicket;
  place?: TicketPlace | null;
  revealDetails?: boolean;
  onCancelApplication?: () => Promise<boolean>;
}) {
  const hasPlace = Boolean(place?.name?.trim() || place?.address?.trim());
  const hasDetailedPlace = revealDetails && hasPlace;
  const hasMap =
    place?.source === "naver" &&
    typeof place.mapx === "number" &&
    typeof place.mapy === "number" &&
    Boolean(place.name);

  return (
    <section className="border-t border-black/8 py-5">
      <h2 className="text-[15px] font-black text-black">만나는 곳</h2>
      <div className="mt-4 rounded-2xl border border-[#d8d0c3] bg-[#f3eee5] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]">
        {hasDetailedPlace ? (
          <div className="space-y-3">
            {place?.name && (
              <TicketMetaLine Icon={MapPin}>{place.name}</TicketMetaLine>
            )}
            {place?.address && (
              <p className="text-sm font-semibold leading-6 text-black/62">
                {place.address}
              </p>
            )}
            <TicketMetaLine Icon={Clock3}>
              {formatTicketDateLabel(userTicket.ticket.date)}{" "}
              {formatTicketTimeLabel(userTicket.ticket.time)}
            </TicketMetaLine>
            {hasMap && (
              <NaverMapPreview
                place={{
                  name: place.name ?? "장소",
                  mapx: place.mapx!,
                  mapy: place.mapy!,
                }}
                className="mt-3 border-[#cec6b8] bg-[#e7e0d4] [&>div:first-child]:brightness-[0.96] [&>div:first-child]:saturate-[0.68] [&>div:first-child]:sepia-[0.08]"
                heightClassName="h-[172px]"
              />
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <TicketMetaLine Icon={MapPin}>
              {userTicket.ticket.area}
            </TicketMetaLine>
            <p className="text-sm font-semibold leading-6 text-black/50">
              상세 장소는 확정되면 공개돼요.
            </p>
          </div>
        )}
      </div>
      {onCancelApplication && (
        <DetailApplicationCancellationControl onCancel={onCancelApplication} />
      )}
    </section>
  );
}

export function DetailApplicationCancellationControl({
  onCancel,
}: {
  onCancel: () => Promise<boolean>;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const cancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    const cancelled = await onCancel().catch(() => false);
    if (!cancelled) setCancelling(false);
  };

  return (
    <>
      <button
        type="button"
        disabled={cancelling}
        onClick={() => setConfirmOpen(true)}
        className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl border border-[#d8d0c3] bg-[#faf8f3] text-[12px] font-bold text-[#24211d]/58 transition hover:border-[#bdb5a7] hover:text-[#24211d]/78 disabled:opacity-40"
      >
        신청 취소
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {confirmOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 px-5 backdrop-blur-[3px]"
                onClick={(event) => {
                  if (event.target === event.currentTarget && !cancelling) {
                    setConfirmOpen(false);
                  }
                }}
                role="presentation"
              >
                <motion.section
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="application-cancellation-title"
                  aria-describedby="application-cancellation-description"
                  className="w-full max-w-[350px] rounded-[28px] border border-black/10 bg-[#f7f4ed] p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.2)]"
                >
                  <h2
                    id="application-cancellation-title"
                    className="break-keep text-[20px] font-black tracking-[-0.04em] text-black"
                  >
                    정말 신청을 취소하시겠어요?
                  </h2>
                  <div
                    id="application-cancellation-description"
                    className="mt-4 space-y-2 break-keep text-[13px] font-semibold leading-6 text-black/52"
                  >
                    <p>이번 신청한 만남만 취소되고, 결제가 취소되진 않아요.</p>
                    <p>
                      결제 취소를 원하시면, 카카오톡 그로블을 통해서 직접
                      해주시거나 카카오톡 채널로 문의주세요!
                    </p>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={() => setConfirmOpen(false)}
                      className="h-12 rounded-full border border-black/10 bg-white/55 text-[13px] font-black text-black/55 transition hover:border-black/20 hover:text-black/75 disabled:opacity-40"
                    >
                      돌아가기
                    </button>
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={() => void cancel()}
                      className="h-12 rounded-full bg-black text-[13px] font-black text-white transition hover:bg-black/85 disabled:bg-black/25"
                    >
                      신청 취소
                    </button>
                  </div>
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

export function FeedbackGuide({ userTicket }: { userTicket: UserTicket }) {
  return (
    <section className="border-t border-black/8 py-5">
      <h2 className="text-[15px] font-black text-black">피드백 안내</h2>
      <p className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/55">
        피드백은 아래 안내된 시간에 열려요. 남겨주신 피드백은 다음 자리의
        큐레이션을 더 잘 맞추기 위한 참고로만 사용돼요.
      </p>
      {userTicket.feedbackOpensAt && (
        <p className="mt-2 text-xs font-bold text-black/35">
          오픈 예정: {formatKoreanDateTime(userTicket.feedbackOpensAt)}
        </p>
      )}
    </section>
  );
}

export function formatKoreanDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
export {
  arrivalCheckClass,
  arrivalOptionActiveClass,
  arrivalOptions,
  arrivalStatusLabel,
  ArrivalStatusPanel,
  arrivalStatusToneClass,
  MemberArrivalStatusAccordion,
} from "./TicketArrival";

import { cn } from "@/lib/cn";
