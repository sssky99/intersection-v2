"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Feather,
  LogOut,
  MapPin,
  X,
  PenLine,
  Sparkles,
  Ticket as TicketIcon,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MbtiSelect, mbtiOptions } from "@/components/MbtiSelect";
import {
  formatTicketDateLabel,
  IntersectionTicketCard,
} from "@/components/IntersectionTicketCard";
import { VibeAxisBar, VibeGraph } from "@/components/vibe/VibeGraph";
import {
  vibeAxisConfig,
  type VibeAxis,
  type VibeScores,
} from "@/components/vibe/vibeGraphConfig";
import { profileQuestions } from "@/data/profileQuestions";
import {
  MeetingRecommendation,
} from "@/features/meetings/MeetingRecommendation";
import {
  TicketDetailContent,
  type TicketDetailSectionKey,
} from "@/features/meetings/TicketDetailContent";
import {
  TicketDetailHero,
  ticketFadeTransition,
} from "@/features/meetings/TicketDetailHero";
import {
  parseTicketRatingAnswer,
} from "@/features/onboarding/ticketRating";
import {
  MembershipFloatingButton,
  MembershipModal,
  type CurrentMembership,
} from "@/features/membership/MembershipModal";
import {
  displayMembershipStatus,
  isMembershipPlan,
} from "@/features/membership/membershipTypes";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRow } from "@/types/profile";
import type {
  QuestionAnswer,
} from "@/types/question";
import type {
  GatheringTicket,
  TicketArrivalStatus,
  TicketProgressStep,
  UserTicket,
  UserTicketStatus,
} from "@/types/ticket";
import type { Gender } from "@/types/user";
import type { LucideIcon } from "lucide-react";

export type AppTab = "browse" | "recommend" | "profile";

type AnswerRow = {
  question_order: number;
  answer_value: string | null;
  answer_values: string[] | null;
  answer_text: string | null;
  other_text: string | null;
};

type AnswerMap = Record<number, QuestionAnswer>;

type BasicInfoDraft = {
  nickname: string;
  name: string;
  phone: string;
  gender: Gender;
  birthYear: string;
  mbti: string;
};

const feedbackPersonAxes = [
  "temperature",
  "texture",
  "tone",
  "rhythm",
] as const satisfies readonly VibeAxis[];
const profileVibeAxes = feedbackPersonAxes;
const feedbackPlaceAxes = [
  "temperature",
  "texture",
  "tone",
  "rhythm",
  "alcohol",
  "romance",
] as const satisfies readonly VibeAxis[];

type FeedbackPersonAxis = (typeof feedbackPersonAxes)[number];
type ProfileVibeAxis = (typeof profileVibeAxes)[number];
type FeedbackPlaceAxis = (typeof feedbackPlaceAxes)[number];

type MemberFeedbackDraft = {
  status: "pending" | "done" | "skipped";
  values: Record<FeedbackPersonAxis, number>;
  touchedAxes: FeedbackPersonAxis[];
};

const tabItems: Array<{ id: AppTab; label: string; Icon: LucideIcon }> = [
  { id: "browse", label: "티켓", Icon: TicketIcon },
  { id: "recommend", label: "추천", Icon: Sparkles },
  { id: "profile", label: "프로필", Icon: UserRound },
];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "미입력";
  return String(value);
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8210")) return `0${digits.slice(2)}`;
  if (digits.startsWith("82") && digits.length > 10) return `0${digits.slice(2)}`;
  return digits;
}

function rowToAnswer(row: AnswerRow): QuestionAnswer {
  const question = profileQuestions.find(
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

const profileScoreColumns = {
  temperature: "score_temperature",
  texture: "score_texture",
  tone: "score_tone",
  rhythm: "score_rhythm",
} as const satisfies Record<ProfileVibeAxis, keyof ProfileRow>;

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

function profileName(profile: ProfileRow) {
  return profile.name?.trim() || "나";
}

function profileInitial(profile: ProfileRow) {
  return profileNickname(profile);
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

function profileEmoji(profile: Pick<ProfileRow, "public_emoji">) {
  return profile.public_emoji?.trim() || "💎";
}

function isValidNickname(value: string) {
  return /^[가-힣]{2}$/.test(value.trim());
}

function setTabUrl(tab: AppTab) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (tab === "recommend") {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", tab);
  }
  window.history.replaceState(null, "", url.toString());
}

async function fetchUserTickets() {
  const response = await fetch("/api/meetings/my-tickets", {
    cache: "no-store",
  }).catch(() => null);
  if (!response) return null;

  const data = (await response.json().catch(() => null)) as
    | { tickets?: UserTicket[] }
    | null;

  return response.ok ? data?.tickets ?? [] : null;
}

function currentMembershipFromProfile(profile: ProfileRow): CurrentMembership {
  if (
    displayMembershipStatus({
      status: profile.membership_status,
      endDate: profile.membership_end_date,
    }) !== "active" ||
    !isMembershipPlan(profile.membership_plan)
  ) {
    return null;
  }

  return {
    planId: profile.membership_plan,
    startedAt: profile.membership_start_date,
    expiresAt: profile.membership_end_date,
  };
}

export function AppHome({
  userId,
  profile,
  initialTab = "recommend",
}: {
  userId: string;
  profile: ProfileRow;
  initialTab?: AppTab;
}) {
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);
  const [waitlistedTickets, setWaitlistedTickets] = useState<UserTicket[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentProfile, setCurrentProfile] = useState(profile);
  const [profileVibeAnimationKey, setProfileVibeAnimationKey] = useState(0);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [membershipModalOpen, setMembershipModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const currentMembership = useMemo(
    () => currentMembershipFromProfile(currentProfile),
    [currentProfile],
  );
  const recommendationMembershipStatus = useMemo(
    () =>
      displayMembershipStatus({
        status: currentProfile.membership_status,
        endDate: currentProfile.membership_end_date,
      }),
    [currentProfile.membership_end_date, currentProfile.membership_status],
  );

  useEffect(() => {
    setCurrentProfile(profile);
  }, [profile]);

  useEffect(() => {
    let cancelled = false;

    void fetchUserTickets().then((tickets) => {
      if (cancelled || !tickets) return;

      setWaitlistedTickets(tickets);
    });

    const supabase = createClient();

    supabase
      .from("user_answers")
      .select("question_order,answer_value,answer_values,answer_text,other_text")
      .eq("user_id", userId)
      .order("question_order")
      .returns<AnswerRow[]>()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;

        setAnswers(
          Object.fromEntries(
            data.map((row) => {
              const answer = rowToAnswer(row);
              return [answer.questionId, answer];
            }),
          ) as AnswerMap,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const switchTab = (tab: AppTab) => {
    if (tab === "profile") {
      setProfileVibeAnimationKey((current) => current + 1);
    }

    setActiveTab(tab);
    setProfilePanelOpen(false);
    setMembershipModalOpen(false);
    setTabUrl(tab);
  };

  const addWaitlistedTicket = (_ticket: GatheringTicket) => {
    void fetchUserTickets().then((tickets) => {
      if (tickets) setWaitlistedTickets(tickets);
    });
  };

  const logout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError(null);

    const { error } = await createClient().auth.signOut();

    if (error) {
      setLogoutError("로그아웃에 실패했어요. 잠시 후 다시 시도해주세요.");
      setLoggingOut(false);
      return;
    }

    window.location.replace("/");
  };

  return (
    <section className="flex h-dvh flex-col bg-white md:h-[calc(100dvh-32px)]">
      <MembershipFloatingButton
        onClick={() => {
          setProfilePanelOpen(false);
          setMembershipModalOpen(true);
        }}
      />

      <button
        type="button"
        onClick={() => {
          setMembershipModalOpen(false);
          setProfilePanelOpen((open) => !open);
        }}
        aria-label="기본정보 카드 열기"
        aria-expanded={profilePanelOpen}
        className="absolute right-4 top-[calc(14px+env(safe-area-inset-top))] z-30"
      >
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border bg-white text-xs font-bold shadow-sm transition",
            profilePanelOpen
              ? "border-black text-black"
              : "border-black/15 text-black/70",
          )}
        >
          {profileInitial(currentProfile)}
        </span>
      </button>

      <AnimatePresence>
        {profilePanelOpen && (
          <>
            <motion.button
              type="button"
              aria-label="기본정보 카드 닫기"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProfilePanelOpen(false)}
              className="absolute inset-0 z-20 bg-black/10"
            />
            <BasicInfoPanel
              key="basic-info-panel"
              profile={currentProfile}
              onProfileUpdated={setCurrentProfile}
              onClose={() => setProfilePanelOpen(false)}
            />
          </>
        )}
      </AnimatePresence>

      <MembershipModal
        open={membershipModalOpen}
        currentMembership={currentMembership}
        onClose={() => setMembershipModalOpen(false)}
      />

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
        <AnimatePresence mode="wait">
          {activeTab === "browse" && (
            <TicketListTab
              key="browse"
              tickets={waitlistedTickets}
              onGoRecommend={() => switchTab("recommend")}
            />
          )}
          {activeTab === "recommend" && (
            <MeetingRecommendation
              key="recommend"
              userId={userId}
              embedded
              membershipStatus={recommendationMembershipStatus}
              onWaitlisted={addWaitlistedTicket}
              onMembershipRequired={() => {
                setProfilePanelOpen(false);
                setMembershipModalOpen(true);
              }}
              onOpenList={() => switchTab("browse")}
            />
          )}
          {activeTab === "profile" && (
            <ProfileTab
              key={`profile-${profileVibeAnimationKey}`}
              profile={currentProfile}
              answers={answers}
              vibeAnimationKey={profileVibeAnimationKey}
              loggingOut={loggingOut}
              logoutError={logoutError}
              onLogout={logout}
            />
          )}
        </AnimatePresence>
      </div>

      <nav className="shrink-0 border-t border-black/10 bg-white px-4 pb-[calc(8px+env(safe-area-inset-bottom))] pt-1.5 shadow-lg">
        <div className="relative grid grid-cols-3 gap-1">
          {tabItems.map(({ id, label, Icon }) => {
            const selected = activeTab === id;

            return (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                aria-current={selected ? "page" : undefined}
                onClick={() => switchTab(id)}
                className={cn(
                  "relative z-10 flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-all duration-300",
                  selected
                    ? "text-white"
                    : "text-black/35 hover:text-black/55",
                )}
              >
                <motion.span
                  animate={selected ? { y: -1, scale: 1.05 } : { y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <Icon size={17} strokeWidth={selected ? 2.5 : 1.8} />
                  <span>{label}</span>
                </motion.span>

                {selected && (
                  <motion.div
                    layoutId="active-tab-bg"
                    className="absolute inset-x-1 bottom-1 top-0.5 -z-10 rounded-xl bg-[#7eb3c7]"
                    transition={{ type: "spring", stiffness: 350, damping: 24 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </section>
  );
}

function TicketListTab({
  tickets,
  onGoRecommend,
}: {
  tickets: UserTicket[];
  onGoRecommend: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const dragState = useRef({
    active: false,
    interacting: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
    startIndex: 0,
  });
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const snapTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveIndex((current) =>
      Math.min(current, Math.max(tickets.length - 1, 0)),
    );
    carouselRef.current?.scrollTo({ left: 0, behavior: "auto" });

    return () => {
      if (snapTimerRef.current !== null) {
        window.clearTimeout(snapTimerRef.current);
      }
    };
  }, [tickets.length]);

  const closestSlide = (viewport: HTMLDivElement) => {
    const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
    const slides = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-ticket-slide]"),
    );

    if (slides.length === 0) return null;

    return slides.reduce(
      (closest, slide, index) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.abs(viewportCenter - slideCenter);
        return distance < closest.distance
          ? { index, slide, distance }
          : closest;
      },
      {
        index: 0,
        slide: slides[0],
        distance: Number.POSITIVE_INFINITY,
      },
    );
  };

  const snapToClosestSlide = (
    viewport = carouselRef.current,
    behavior: ScrollBehavior = "smooth",
  ) => {
    if (!viewport || tickets.length === 0) return;

    const closest = closestSlide(viewport);
    if (!closest) return;

    const targetLeft =
      closest.slide.offsetLeft +
      closest.slide.offsetWidth / 2 -
      viewport.clientWidth / 2;

    setActiveIndex(closest.index);
    viewport.scrollTo({ left: targetLeft, behavior });
  };

  const snapToSlideIndex = (
    index: number,
    viewport = carouselRef.current,
    behavior: ScrollBehavior = "smooth",
  ) => {
    if (!viewport || tickets.length === 0) return;

    const slides = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-ticket-slide]"),
    );
    const nextIndex = Math.max(0, Math.min(index, slides.length - 1));
    const slide = slides[nextIndex];
    if (!slide) return;

    const targetLeft =
      slide.offsetLeft + slide.offsetWidth / 2 - viewport.clientWidth / 2;

    setActiveIndex(nextIndex);
    viewport.scrollTo({ left: targetLeft, behavior });
  };

  const updateActiveSlide = (event: React.UIEvent<HTMLDivElement>) => {
    if (tickets.length === 0) return;

    const viewport = event.currentTarget;
    const closest = closestSlide(viewport);
    if (closest) setActiveIndex(closest.index);

    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }

    snapTimerRef.current = window.setTimeout(() => {
      if (!dragState.current.interacting) {
        snapToClosestSlide(viewport);
      }
    }, 120);
  };

  const startDesktopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }

    dragState.current = {
      active: true,
      interacting: true,
      moved: false,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      startIndex: activeIndex,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDesktopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;

    event.preventDefault();
    if (Math.abs(event.clientX - dragState.current.startX) > 8) {
      dragState.current.moved = true;
    }
    event.currentTarget.scrollLeft =
      dragState.current.scrollLeft - (event.clientX - dragState.current.startX);
  };

  const finishDesktopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const wasActive = dragState.current.active;
    const dragDistance = event.clientX - dragState.current.startX;
    const threshold = event.pointerType === "touch" ? 54 : 22;
    const targetElement = document.elementFromPoint(
      event.clientX,
      event.clientY,
    );
    const tappedSlide = targetElement?.closest<HTMLElement>(
      "[data-ticket-slide-index]",
    );
    const tappedIndex =
      tappedSlide?.dataset.ticketSlideIndex !== undefined
        ? Number(tappedSlide.dataset.ticketSlideIndex)
        : Number.NaN;
    const tappedTicket = Number.isInteger(tappedIndex)
      ? tickets[tappedIndex]
      : null;
    dragState.current.active = false;
    dragState.current.interacting = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!dragState.current.moved && Math.abs(dragDistance) <= 8 && tappedTicket) {
      setSelectedTicket(tappedTicket);
      return;
    }

    if (dragState.current.moved) {
      window.setTimeout(() => {
        dragState.current.moved = false;
      }, 0);
    }

    if (!wasActive) return;

    if (Math.abs(dragDistance) > threshold) {
      snapToSlideIndex(
        dragState.current.startIndex + (dragDistance < 0 ? 1 : -1),
        event.currentTarget,
      );
    } else {
      snapToSlideIndex(dragState.current.startIndex, event.currentTarget);
    }
  };

  const openStoredTicket = (ticket: UserTicket) => {
    if (dragState.current.moved) return;
    setSelectedTicket(ticket);
  };

  return (
    <TabMotion>
      <AnimatePresence mode="wait" initial={false}>
        {selectedTicket ? (
          <StoredTicketDetailView
            key={`stored-ticket-detail-${selectedTicket.id}`}
            userTicket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
          />
        ) : (
          <motion.section
            key="stored-ticket-list"
            exit={{ opacity: 0, y: -8 }}
            transition={ticketFadeTransition}
            className="flex h-full min-h-0 flex-col overflow-hidden bg-white pb-2 pt-[calc(16px+env(safe-area-inset-top))] text-black"
          >
            <header className="shrink-0 px-5 pr-28">
              <p className="text-[13px] font-bold uppercase italic tracking-wide text-black">
                tickets {tickets.length}
              </p>
            </header>

            {tickets.length === 0 ? (
              <div className="mx-5 mt-16 rounded-[28px] border border-black/10 bg-white p-6 text-center shadow-[0_16px_44px_rgba(0,0,0,0.04)]">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/12 text-accent">
                  <CalendarDays size={20} aria-hidden />
                </div>
                <h2 className="mt-5 text-lg font-bold text-black">
                  아직 보관된 티켓이 없어요
                </h2>
                <p className="mt-2 text-xs leading-5 text-black/45">
                  추천 탭에서 날짜를 고르고 마음에 드는 모임에 Yes를 눌러보세요.
                </p>
                <button
                  type="button"
                  onClick={onGoRecommend}
                  className="mt-6 h-12 w-full rounded-full bg-black text-sm font-semibold text-white"
                >
                  추천 받으러 가기
                </button>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 -translate-y-3 flex-col justify-center pb-3 pt-4">
                <div
                  ref={carouselRef}
                  onScroll={updateActiveSlide}
                  onPointerDown={startDesktopDrag}
                  onPointerMove={moveDesktopDrag}
                  onPointerUp={finishDesktopDrag}
                  onPointerCancel={finishDesktopDrag}
                  style={{
                    scrollBehavior: "smooth",
                    WebkitOverflowScrolling: "touch",
                  }}
                  className="flex shrink-0 cursor-grab snap-x snap-mandatory select-none gap-4 overflow-x-auto px-[11%] pb-2 scrollbar-none overscroll-x-contain touch-pan-y active:cursor-grabbing"
                >
                  {tickets.map((userTicket, index) => (
                    <div
                      key={userTicket.id}
                      data-ticket-slide
                      data-ticket-slide-index={index}
                      className="w-[min(78vw,330px,calc(61.73dvh-121px))] shrink-0 snap-center snap-always"
                    >
                      <StoredTicketCard
                        userTicket={userTicket}
                        onOpen={() => openStoredTicket(userTicket)}
                      />
                    </div>
                  ))}
                </div>

                {tickets.length > 1 && (
                  <div
                    className="mt-1.5 flex shrink-0 justify-center gap-1.5"
                    aria-label={`티켓 ${activeIndex + 1}/${tickets.length}`}
                  >
                    {tickets.map((userTicket, index) => (
                      <span
                        key={userTicket.id}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition",
                          activeIndex === index ? "bg-black/70" : "bg-black/15",
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </TabMotion>
  );
}

function StoredTicketCard({
  userTicket,
  onOpen,
}: {
  userTicket: UserTicket;
  onOpen: () => void;
}) {
  const ticket = userTicket.ticket;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`${ticket.title} 자세히 보기`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      whileTap={{ scale: 0.99 }}
      className="relative rounded-[28px] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
    >
      <IntersectionTicketCard
        title={ticket.title}
        imageUrl={ticket.imageUrl}
        date={ticket.date}
        time={ticket.time}
        location={`서울\n${ticket.area}`}
        tags={ticket.moodTags}
        remainingSeatCount={ticket.remainingSeatCount}
        className="shadow-none"
      />
      <span
        className={cn(
          "absolute left-4 top-4 rounded-full border px-3 py-1.5 text-[11px] font-black backdrop-blur",
          statusBadgeClass(userTicket.status),
        )}
      >
        {userTicket.statusLabel}
      </span>
    </motion.div>
  );
}

function StoredTicketDetailView({
  userTicket,
  onClose,
}: {
  userTicket: UserTicket;
  onClose: () => void;
}) {
  const ticket = userTicket.ticket;
  const [statusOpen, setStatusOpen] = useState(true);
  const [selectedProgressStep, setSelectedProgressStep] =
    useState<TicketProgressStep>(userTicket.progressStep);

  useEffect(() => {
    setSelectedProgressStep(userTicket.progressStep);
  }, [userTicket.id, userTicket.progressStep]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={ticketFadeTransition}
      className="min-h-full bg-white px-5 pb-7 pt-[calc(72px+env(safe-area-inset-top))] text-black"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="티켓 상세 닫기"
        className="absolute left-4 top-[calc(14px+env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black/55 shadow-sm transition hover:-translate-y-0.5 hover:text-black hover:shadow-md"
      >
        <X size={18} aria-hidden />
      </button>

      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04, duration: 0.22, ease: "easeOut" }}
        className="overflow-hidden rounded-[28px] border border-black/12 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.08)]"
      >
        <TicketDetailHero
          ticket={ticket}
          badgeLabel={userTicket.statusLabel}
          statusExpanded={statusOpen}
          onToggleStatus={() => setStatusOpen((current) => !current)}
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.22, ease: "easeOut" }}
          className="bg-white px-5 pb-5 pt-1"
        >
          <TicketStatusOverview
            userTicket={userTicket}
            open={statusOpen}
            selectedProgressStep={selectedProgressStep}
            onSelectProgressStep={setSelectedProgressStep}
          />
          <TicketStageContent
            userTicket={userTicket}
            progressStep={selectedProgressStep}
          />
        </motion.div>
      </motion.article>

    </motion.section>
  );
}

function statusBadgeClass(_status: UserTicketStatus) {
  return "border-white/25 bg-white/20 text-white shadow-[0_10px_22px_rgba(0,0,0,0.2)]";
}

function detailStatusBadgeClass(status: UserTicketStatus) {
  if (status === "payment_pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "waitlisted") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (status === "feedback_open") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  if (status === "in_progress") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-black/10 bg-black/[0.04] text-black/65";
}

const ticketProgressSteps: Array<{ key: TicketProgressStep; label: string }> = [
  { key: "applied", label: "신청 완료" },
  { key: "approved", label: "참여 확정" },
  { key: "pre_start", label: "시작 전 안내" },
  { key: "in_progress", label: "진행 중" },
  { key: "feedback", label: "피드백 작성" },
];

const introDetailSections: TicketDetailSectionKey[] = ["summary", "activities"];
const ticketGuidanceClass =
  "mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold leading-5 text-emerald-800";

function progressStepIndex(step: TicketProgressStep) {
  return Math.max(
    ticketProgressSteps.findIndex((progressStep) => progressStep.key === step),
    0,
  );
}

function countdownText(targetIso: string | null, label: string, now: Date) {
  if (!targetIso) return null;
  const target = new Date(targetIso);
  const remainingMs = target.getTime() - now.getTime();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeText =
    hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;

  return `${label} ${timeText} 남았어요`;
}

function useTicketCountdown(userTicket: UserTicket) {
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
    const text = countdownText(userTicket.meetingStartAt, "진행 중까지", now);
    return text ? { text } : null;
  }

  if (userTicket.progressStep === "in_progress") {
    const text = countdownText(
      userTicket.feedbackOpensAt,
      "피드백 작성까지",
      now,
    );
    return text ? { text } : null;
  }

  return null;
}

function TicketStatusOverview({
  userTicket,
  open,
  selectedProgressStep,
  onSelectProgressStep,
}: {
  userTicket: UserTicket;
  open: boolean;
  selectedProgressStep: TicketProgressStep;
  onSelectProgressStep: (step: TicketProgressStep) => void;
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
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent">
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
                  className="mt-1 shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-right text-[11px] font-black leading-4 text-emerald-800 shadow-[0_8px_18px_rgba(16,185,129,0.12)]"
                >
                  {countdown.text}
                </motion.p>
              )}
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl bg-black/[0.03] px-4 py-3 text-xs font-bold text-black/58">
              <TicketMetaLine Icon={CalendarDays}>
                {formatTicketDateLabel(ticket.date)} {ticket.time}
              </TicketMetaLine>
              <TicketMetaLine Icon={MapPin}>{ticket.area}</TicketMetaLine>
            </div>

            <TicketProgressSteps
              progressIndex={userTicket.progressIndex}
              selectedProgressStep={selectedProgressStep}
              onSelectProgressStep={onSelectProgressStep}
            />
            <TicketStatusGuidance userTicket={userTicket} />
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function TicketMetaLine({
  Icon,
  children,
}: {
  Icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-center gap-2">
      <Icon size={14} className="text-black/35" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function TicketProgressSteps({
  progressIndex,
  selectedProgressStep,
  onSelectProgressStep,
}: {
  progressIndex: number;
  selectedProgressStep: TicketProgressStep;
  onSelectProgressStep: (step: TicketProgressStep) => void;
}) {
  const selectedIndex = progressStepIndex(selectedProgressStep);

  return (
    <div className="mt-5">
      <div className="grid grid-cols-5 gap-1.5">
        {ticketProgressSteps.map((step, index) => {
          const active = index <= progressIndex;
          const current = index === progressIndex;
          const selected = index === selectedIndex;
          const disabled = index > progressIndex;

          return (
            <div key={step.key} className="min-w-0">
              <div
                className={cn(
                  "h-1.5 rounded-full transition",
                  active ? "bg-accent" : "bg-black/8",
                )}
              />
              <div className="mt-2 flex min-h-10 flex-col items-center text-center">
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`${step.label} 단계 보기`}
                  aria-pressed={selected}
                  aria-current={current ? "step" : undefined}
                  onClick={() => onSelectProgressStep(step.key)}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black transition",
                    selected
                      ? "bg-accent text-white shadow-[0_4px_12px_rgba(126,179,199,0.42)]"
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
  );
}

function TicketStatusGuidance({ userTicket }: { userTicket: UserTicket }) {
  if (userTicket.status === "payment_pending") {
    return (
      <p className={ticketGuidanceClass}>
        결제 확인이 완료되면 대기열 등록 상태로 전환돼요. 운영자가 확인한 뒤
        참여 확정 여부를 안내합니다.
      </p>
    );
  }

  if (userTicket.status === "waitlisted") {
    return (
      <p className={ticketGuidanceClass}>
        신청이 완료됐어요. 참여 확정 안내는 모임 시작 24시간 전부터
        확인할 수 있어요.
      </p>
    );
  }

  if (userTicket.progressStep === "applied") {
    return (
      <p className={ticketGuidanceClass}>
        신청이 완료됐어요. 참여 확정 안내는 모임 시작 24시간 전부터
        확인할 수 있어요.
      </p>
    );
  }

  if (userTicket.progressStep === "pre_start") {
    return (
      <p className={ticketGuidanceClass}>
        모임 시작 3시간 전 안내가 열렸어요. 도착 상태와 오늘의 장소를
        확인할 수 있어요.
      </p>
    );
  }

  if (userTicket.status === "in_progress") {
    return (
      <p className={ticketGuidanceClass}>
        모임이 진행 중이에요. 도착 상태와 장소를 확인하고, 모임 후 피드백
        안내를 확인할 수 있어요.
      </p>
    );
  }

  if (userTicket.status === "feedback_open") {
    return (
      <p className={ticketGuidanceClass}>
        피드백 작성이 열렸어요. 남겨주신 피드백은 다음 자리의 큐레이션을
        더 잘 맞추는 데 참고돼요.
      </p>
    );
  }

  return (
    <p className={ticketGuidanceClass}>
      참여가 확정되었어요. 이제 모임 안내와 함께 멤버 정보를 확인할 수 있어요.
    </p>
  );
}

function TicketStageContent({
  userTicket,
  progressStep,
}: {
  userTicket: UserTicket;
  progressStep: TicketProgressStep;
}) {
  const ticket = userTicket.ticket;
  const [arrivalStatus, setArrivalStatus] = useState<TicketArrivalStatus | null>(
    userTicket.arrivalStatus,
  );
  const placeUnlocked = Boolean(arrivalStatus);

  useEffect(() => {
    setArrivalStatus(userTicket.arrivalStatus);
  }, [userTicket.arrivalStatus, userTicket.waitlistId]);

  if (progressStep === "feedback") {
    return <TicketFeedbackForm userTicket={userTicket} />;
  }

  if (progressStep === "in_progress") {
    return (
      <>
        <ArrivalStatusPanel
          userTicket={userTicket}
          selectedArrivalStatus={arrivalStatus}
          onArrivalStatusChange={setArrivalStatus}
        />
        {placeUnlocked ? (
          <PlaceSection userTicket={userTicket} />
        ) : (
          <PlaceLockedSection />
        )}
        <TicketDetailContent
          ticket={ticket}
          sections={introDetailSections}
          className="mt-0"
        />
        <TicketDetailContent
          ticket={ticket}
          sections={["flow"]}
          className="mt-0"
          startWithBorder
        />
        <FeedbackGuide userTicket={userTicket} />
      </>
    );
  }

  if (progressStep === "pre_start") {
    return (
      <>
        <ArrivalStatusPanel
          userTicket={userTicket}
          selectedArrivalStatus={arrivalStatus}
          onArrivalStatusChange={setArrivalStatus}
        />
        {placeUnlocked ? (
          <PlaceSection userTicket={userTicket} />
        ) : (
          <PlaceLockedSection />
        )}
        <TicketDetailContent
          ticket={ticket}
          sections={introDetailSections}
          className="mt-0"
        />
        <MemberIntroCarousel members={userTicket.members} />
        <TicketDetailContent
          ticket={ticket}
          sections={["flow"]}
          className="mt-0"
          startWithBorder
        />
      </>
    );
  }

  if (progressStep === "approved") {
    return (
      <>
        <TicketDetailContent ticket={ticket} sections={introDetailSections} />
        <MemberIntroCarousel members={userTicket.members} />
        <TicketDetailContent
          ticket={ticket}
          sections={["flow"]}
          className="mt-0"
          startWithBorder
        />
      </>
    );
  }

  return <TicketDetailContent ticket={ticket} />;
}

function PlaceSection({ userTicket }: { userTicket: UserTicket }) {
  const hasPlace = Boolean(
    userTicket.place?.name?.trim() || userTicket.place?.address?.trim(),
  );

  return (
    <section className="border-t border-black/8 py-5">
      <h2 className="text-[15px] font-black text-black">오늘의 장소</h2>
      <div className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-4">
        {hasPlace ? (
          <div className="space-y-3">
            {userTicket.place?.name && (
              <TicketMetaLine Icon={MapPin}>{userTicket.place.name}</TicketMetaLine>
            )}
            {userTicket.place?.address && (
              <p className="text-sm font-semibold leading-6 text-black/62">
                {userTicket.place.address}
              </p>
            )}
            <TicketMetaLine Icon={Clock3}>
              {formatTicketDateLabel(userTicket.ticket.date)} {userTicket.ticket.time}
            </TicketMetaLine>
          </div>
        ) : (
          <p className="text-sm font-semibold leading-6 text-black/50">
            상세 장소는 곧 안내될 예정이에요.
          </p>
        )}
      </div>
    </section>
  );
}

function PlaceLockedSection() {
  return (
    <section className="border-t border-black/8 py-5">
      <h2 className="text-[15px] font-black text-black">오늘의 장소</h2>
      <p className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm font-semibold leading-6 text-black/50">
        (도착 상태를 눌러야 오늘의 장소가 표시돼요.)
      </p>
    </section>
  );
}

function MemberIntroCarousel({
  members,
}: {
  members: UserTicket["members"];
}) {
  const [index, setIndex] = useState(0);
  const [progressCycle, setProgressCycle] = useState(0);
  const displayIndex = members.length ? index % members.length : 0;
  const current = members[displayIndex];
  const profileRotationMs = 4200;

  useEffect(() => {
    setIndex(0);
    setProgressCycle((currentCycle) => currentCycle + 1);
  }, [members.length]);

  const advanceMember = () => {
    if (!members.length) return;
    setIndex((currentIndex) => (currentIndex + 1) % members.length);
    setProgressCycle((currentCycle) => currentCycle + 1);
  };

  if (!members.length || !current) {
    return (
      <section className="border-t border-black/8 py-5">
        <h2 className="text-[15px] font-black text-black">함께할 멤버들</h2>
        <p className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/50">
          멤버 소개가 곧 준비될 예정이에요.
        </p>
      </section>
    );
  }

  return (
    <section className="border-t border-black/8 py-5">
      <div>
        <h2 className="text-[15px] font-black text-black">함께할 멤버들</h2>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-black/8" aria-hidden>
          <motion.div
            key={`${current.id}-${progressCycle}`}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{
              duration: profileRotationMs / 1000,
              ease: "linear",
            }}
            onAnimationComplete={advanceMember}
            className="h-full bg-black"
          />
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={ticketFadeTransition}
          className="mt-4 flex h-[460px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white px-4 py-4"
        >
          <div className="mb-4 shrink-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
              {current.isSelf ? "내 프로필" : "멤버 프로필"}
            </p>
            <h3 className="mt-1 flex items-center gap-2 text-lg font-black text-black">
              <span>{current.nickname?.trim() || "닉네임 미정"}</span>
              <span aria-hidden className="text-base leading-none">
                {current.emoji}
              </span>
            </h3>
          </div>
          <p className="min-h-0 flex-1 overflow-y-auto whitespace-pre-line pr-1 text-sm font-semibold leading-6 text-black/65 scrollbar-none">
            {current.publicIntro?.trim() || "아직 소개가 준비 중인 멤버예요."}
          </p>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

const arrivalOptions: Array<{
  value: TicketArrivalStatus;
  label: string;
}> = [
  { value: "on_time", label: "정상 도착 예정이에요" },
  { value: "late_10", label: "조금 늦어요 · 10분 정도" },
  { value: "late_20", label: "조금 늦어요 · 20분 정도" },
  { value: "late_30_plus", label: "조금 늦어요 · 30분 이상" },
];

function arrivalStatusLabel(status: TicketArrivalStatus | null) {
  return (
    arrivalOptions.find((option) => option.value === status)?.label ??
    "아직 선택 전"
  );
}

function arrivalStatusToneClass(status: TicketArrivalStatus | null) {
  if (status === "on_time") {
    return "border-emerald-300 bg-emerald-50/60 text-emerald-800";
  }
  if (status) {
    return "border-amber-300 bg-amber-50/70 text-amber-800";
  }
  return "border-black/10 bg-white text-black/45";
}

function arrivalOptionActiveClass(status: TicketArrivalStatus) {
  if (status === "on_time") {
    return "border-emerald-400 bg-emerald-50 text-emerald-900";
  }

  return "border-amber-400 bg-amber-50 text-amber-900";
}

function arrivalCheckClass(status: TicketArrivalStatus) {
  return status === "on_time" ? "text-emerald-600" : "text-amber-600";
}

function ArrivalStatusPanel({
  userTicket,
  selectedArrivalStatus,
  onArrivalStatusChange,
}: {
  userTicket: UserTicket;
  selectedArrivalStatus?: TicketArrivalStatus | null;
  onArrivalStatusChange?: (arrivalStatus: TicketArrivalStatus) => void;
}) {
  const [selected, setSelected] = useState<TicketArrivalStatus | null>(
    selectedArrivalStatus ?? userTicket.arrivalStatus,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(selectedArrivalStatus ?? userTicket.arrivalStatus);
  }, [selectedArrivalStatus, userTicket.arrivalStatus, userTicket.waitlistId]);

  const saveArrivalStatus = async (arrivalStatus: TicketArrivalStatus) => {
    if (saving || !userTicket.canSetArrival) return;
    setSaving(true);
    setError(null);

    const response = await fetch("/api/meetings/my-tickets/arrival", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        waitlistId: userTicket.waitlistId,
        arrivalStatus,
      }),
    });

    if (!response.ok) {
      setError("도착 상태를 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
      return;
    }

    setSelected(arrivalStatus);
    onArrivalStatusChange?.(arrivalStatus);
    setSaving(false);
  };

  return (
    <section className="border-t border-black/8 py-5">
      <h2 className="text-[15px] font-black text-black">도착 상태</h2>
      {!userTicket.canSetArrival ? (
        <p className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/50">
          도착 상태는 모임 시작 3시간 전부터 선택할 수 있어요.
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          {arrivalOptions.map((option) => {
            const active = selected === option.value;

            return (
              <button
                key={option.value}
                type="button"
                disabled={saving}
                onClick={() => void saveArrivalStatus(option.value)}
                className={cn(
                  "flex min-h-11 items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-bold transition disabled:opacity-45",
                  active
                    ? arrivalOptionActiveClass(option.value)
                    : "border-black/10 bg-white text-black/55 hover:border-black/20",
                )}
              >
                <span>{option.label}</span>
                {active && (
                  <Check
                    size={16}
                    className={arrivalCheckClass(option.value)}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
      <MemberArrivalStatusAccordion members={userTicket.members} />
    </section>
  );
}

function MemberArrivalStatusAccordion({
  members,
}: {
  members: UserTicket["members"];
}) {
  const [open, setOpen] = useState(false);
  const otherMembers = members.filter((member) => !member.isSelf);
  const ArrowIcon = open ? ChevronUp : ChevronDown;

  if (otherMembers.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-black/10 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-black text-black">
            다른 멤버 도착 상태
          </span>
          <span className="mt-0.5 block text-[11px] font-bold text-black/38">
            {otherMembers.length}명
          </span>
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-black/45">
          <ArrowIcon size={16} aria-hidden />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="member-arrival-statuses"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="grid gap-2 border-t border-black/8 px-3 py-3">
              {otherMembers.map((member) => (
                <div
                  key={member.id}
                  className={cn(
                    "flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-3 py-2.5",
                    arrivalStatusToneClass(member.arrivalStatus),
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-black text-black">
                      <span className="truncate">
                        {member.nickname?.trim() || member.name || "멤버"}
                      </span>
                      <span aria-hidden className="shrink-0 text-xs">
                        {member.emoji}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-black">
                    {arrivalStatusLabel(member.arrivalStatus)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FeedbackGuide({ userTicket }: { userTicket: UserTicket }) {
  return (
    <section className="border-t border-black/8 py-5">
      <h2 className="text-[15px] font-black text-black">피드백 안내</h2>
      <p className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/55">
        피드백은 모임 시작 3시간 후에 열려요. 남겨주신 피드백은 다음 자리의
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

function createMemberFeedbackDrafts(
  members: UserTicket["members"],
): Record<string, MemberFeedbackDraft> {
  return Object.fromEntries(
    members.map((member) => [
      member.id,
      {
        status: "pending",
        values: {
          temperature: 3,
          texture: 3,
          tone: 3,
          rhythm: 3,
        },
        touchedAxes: [],
      },
    ]),
  );
}

function placeFeedbackInitialScores(scores?: VibeScores | null) {
  return Object.fromEntries(
    feedbackPlaceAxes.map((axis) => {
      const value = scores?.[axis];
      return [
        axis,
        typeof value === "number" && value >= 1 && value <= 5 ? value : 3,
      ];
    }),
  ) as Record<FeedbackPlaceAxis, number>;
}

function scoreToInternal(score: number) {
  return (score - 3) * 50;
}

function memberRealName(member: UserTicket["members"][number]) {
  return member.name?.trim() || member.nickname?.trim() || "멤버";
}

function memberFeedbackStatusLabel(
  status: MemberFeedbackDraft["status"],
  active: boolean,
) {
  if (status === "done") return "완료";
  if (status === "skipped") return "건너뜀";
  return active ? "진행중" : "대기";
}

function TicketFeedbackForm({ userTicket }: { userTicket: UserTicket }) {
  const otherMembers = useMemo(
    () => userTicket.members.filter((member) => !member.isSelf),
    [userTicket.members],
  );
  const [selectedMeetAgainIds, setSelectedMeetAgainIds] = useState<string[]>([]);
  const [meetAgainUnknown, setMeetAgainUnknown] = useState(false);
  const [memberFeedback, setMemberFeedback] = useState<
    Record<string, MemberFeedbackDraft>
  >(() => createMemberFeedbackDrafts(otherMembers));
  const [activeMemberId, setActiveMemberId] = useState(otherMembers[0]?.id ?? "");
  const [placeFeedback, setPlaceFeedback] = useState<
    Record<FeedbackPlaceAxis, number>
  >(() => placeFeedbackInitialScores(userTicket.ticket.vibeScores));
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedMeetAgainIds([]);
    setMeetAgainUnknown(false);
    setMemberFeedback(createMemberFeedbackDrafts(otherMembers));
    setActiveMemberId(otherMembers[0]?.id ?? "");
    setPlaceFeedback(placeFeedbackInitialScores(userTicket.ticket.vibeScores));
    setSubmitting(false);
    setSubmitted(false);
    setSubmitError(null);
  }, [otherMembers, userTicket.ticket.vibeScores, userTicket.waitlistId]);

  const activeMember =
    otherMembers.find((member) => member.id === activeMemberId) ?? otherMembers[0];
  const activeDraft = activeMember ? memberFeedback[activeMember.id] : null;
  const allMembersHandled = otherMembers.every(
    (member) => memberFeedback[member.id]?.status !== "pending",
  );

  const toggleMeetAgain = (memberId: string) => {
    setMeetAgainUnknown(false);
    setSelectedMeetAgainIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  };

  const selectUnknownMeetAgain = () => {
    setSelectedMeetAgainIds([]);
    setMeetAgainUnknown(true);
  };

  const updateMemberAxis = (axis: FeedbackPersonAxis, value: number) => {
    if (!activeMember) return;
    setMemberFeedback((current) => {
      const draft = current[activeMember.id];
      if (!draft) return current;
      return {
        ...current,
        [activeMember.id]: {
          ...draft,
          values: { ...draft.values, [axis]: value },
          touchedAxes: draft.touchedAxes.includes(axis)
            ? draft.touchedAxes
            : [...draft.touchedAxes, axis],
        },
      };
    });
  };

  const moveToNextMember = (memberId: string) => {
    const currentIndex = otherMembers.findIndex((member) => member.id === memberId);
    const nextPending =
      otherMembers
        .slice(currentIndex + 1)
        .find((member) => memberFeedback[member.id]?.status === "pending") ??
      otherMembers.find((member) => memberFeedback[member.id]?.status === "pending");

    if (nextPending) setActiveMemberId(nextPending.id);
  };

  const completeActiveMember = () => {
    if (!activeMember || !activeDraft) return;
    setMemberFeedback((current) => ({
      ...current,
      [activeMember.id]: {
        ...activeDraft,
        status: activeDraft.touchedAxes.length > 0 ? "done" : "skipped",
      },
    }));
    moveToNextMember(activeMember.id);
  };

  const skipActiveMember = () => {
    if (!activeMember || !activeDraft) return;
    setMemberFeedback((current) => ({
      ...current,
      [activeMember.id]: {
        ...activeDraft,
        status: "skipped",
      },
    }));
    moveToNextMember(activeMember.id);
  };

  const submitFeedback = async () => {
    if (submitting || !allMembersHandled) return;
    setSubmitting(true);
    setSubmitError(null);

    const payloadMemberFeedback = Object.fromEntries(
      otherMembers.map((member) => {
        const draft = memberFeedback[member.id];
        const skipped = !draft || draft.status !== "done" || draft.touchedAxes.length === 0;
        const values = Object.fromEntries(
          feedbackPersonAxes.map((axis) => [
            axis,
            skipped || !draft.touchedAxes.includes(axis)
              ? null
              : scoreToInternal(draft.values[axis]),
          ]),
        );

        return [
          member.id,
          {
            status: skipped ? "skipped" : "done",
            ...values,
          },
        ];
      }),
    );

    try {
      const response = await fetch("/api/meetings/my-tickets/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waitlistId: userTicket.waitlistId,
          selectedMemberIds: selectedMeetAgainIds,
          memberFeedback: payloadMemberFeedback,
          placeFeedback,
        }),
      });

      if (!response.ok) throw new Error("feedback-submit-failed");

      setSubmitted(true);
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setSubmitError("피드백을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="py-5">
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-600">
            <Check size={20} aria-hidden />
          </div>
          <h2 className="mt-4 text-xl font-black text-emerald-950">
            피드백이 저장됐어요.
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800/70">
            이 티켓은 곧 목록에서 숨겨지고, 다음 자리 추천에 참고될 거예요.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-5">
      <section className="rounded-3xl border border-black/10 bg-white px-5 py-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
            <Feather size={19} aria-hidden />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent">
              feedback
            </p>
            <h2 className="mt-1 text-[22px] font-black text-black">피드백 작성</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-black/52">
              남겨주신 피드백은 원본으로 보관되고, 다음 자리의 사람 지표와 장소 분위기를 맞추는 데 참고돼요.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-black/8 py-5">
        <h3 className="text-[15px] font-black leading-6 text-black">
          이번 모임에서 단둘이 다시 만나보고 싶은 분이 있나요?
        </h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-black/42">
          중복 선택할 수 있어요.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {otherMembers.map((member) => {
            const selected = selectedMeetAgainIds.includes(member.id);
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => toggleMeetAgain(member.id)}
                className={cn(
                  "min-h-10 rounded-full border px-4 text-sm font-bold transition",
                  selected
                    ? "border-accent bg-accent text-white"
                    : "border-black/10 bg-white text-black/62 hover:border-accent/45",
                )}
              >
                {memberRealName(member)}
              </button>
            );
          })}
          <button
            type="button"
            onClick={selectUnknownMeetAgain}
            className={cn(
              "min-h-10 rounded-full border px-4 text-sm font-bold transition",
              meetAgainUnknown
                ? "border-black bg-black text-white"
                : "border-black/10 bg-black/[0.03] text-black/55 hover:border-black/25",
            )}
          >
            잘 모르겠어요
          </button>
        </div>
      </section>

      <section className="border-t border-black/8 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-black text-black">멤버 피드백</h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-black/42">
              각 멤버를 한 번씩 지나가며 느낀 분위기만 남겨주세요.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-black/[0.04] px-3 py-1 text-[11px] font-black text-black/45">
            {otherMembers.filter((member) => memberFeedback[member.id]?.status !== "pending").length}/
            {otherMembers.length}
          </span>
        </div>

        {otherMembers.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/50">
            함께한 멤버 정보가 없어 이 단계는 건너뛰어요.
          </p>
        ) : (
          <>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {otherMembers.map((member) => {
                const selected = activeMember?.id === member.id;
                const draft = memberFeedback[member.id];

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setActiveMemberId(member.id)}
                    className={cn(
                      "min-w-[104px] rounded-2xl border px-3 py-3 text-left transition",
                      selected
                        ? "border-accent bg-accent/8"
                        : "border-black/10 bg-white hover:border-black/20",
                    )}
                  >
                    <span className="block truncate text-sm font-black text-black">
                      {memberRealName(member)}
                    </span>
                    <span
                      className={cn(
                        "mt-1 block text-[11px] font-bold",
                        draft?.status === "done"
                          ? "text-emerald-600"
                          : draft?.status === "skipped"
                            ? "text-black/35"
                            : selected
                              ? "text-accent"
                              : "text-black/35",
                      )}
                    >
                      {memberFeedbackStatusLabel(draft?.status ?? "pending", selected)}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeMember && activeDraft && (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-base font-black text-black">
                    {memberRealName(activeMember)}
                  </h4>
                  <button
                    type="button"
                    onClick={skipActiveMember}
                    className="h-9 rounded-full border border-black/10 bg-white px-3 text-xs font-bold text-black/45"
                  >
                    잘 모르겠어요
                  </button>
                </div>
                <SharedFeedbackVibeGraphControl
                  className="border-t-0 pt-4"
                  axes={feedbackPersonAxes}
                  values={activeDraft.values}
                  onChange={updateMemberAxis}
                />
                <button
                  type="button"
                  onClick={completeActiveMember}
                  className="mt-5 h-12 w-full rounded-full bg-black text-sm font-black text-white"
                >
                  이 멤버 피드백 완료
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="border-t border-black/8 py-5">
        <h3 className="text-[15px] font-black text-black">장소 피드백</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-black/42">
          이 자리 자체의 분위기를 알려주세요.
        </p>
        <SharedFeedbackVibeGraphControl
          className="border-t-0 pt-5"
          axes={feedbackPlaceAxes}
          values={placeFeedback}
          onChange={(axis, value) =>
            setPlaceFeedback((current) => ({ ...current, [axis]: value }))
          }
        />
      </section>

      {submitError && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-600">
          {submitError}
        </p>
      )}

      <button
        type="button"
        disabled={submitting || !allMembersHandled}
        onClick={() => void submitFeedback()}
        className="h-12 w-full rounded-full bg-accent text-sm font-black text-white shadow-[0_10px_24px_rgba(126,179,199,0.28)] transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-black/20 disabled:shadow-none"
      >
        {submitting
          ? "저장 중이에요"
          : allMembersHandled
            ? "피드백 제출하기"
            : "멤버 피드백을 모두 지나가주세요"}
      </button>
    </div>
  );
}

const feedbackAxisLabelOverrides: Partial<
  Record<VibeAxis, { leftLabel: string; rightLabel: string }>
> = {
  alcohol: {
    leftLabel: "술이 없는",
    rightLabel: "술이 있는",
  },
  romance: {
    leftLabel: "편한",
    rightLabel: "설레는",
  },
};

function SharedFeedbackVibeGraphControl<TAxis extends VibeAxis>({
  title,
  description,
  axes,
  values,
  onChange,
  className,
}: {
  title?: string;
  description?: string;
  axes: readonly TAxis[];
  values: Record<TAxis, number>;
  onChange: (axis: TAxis, value: number) => void;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-black/8 py-5", className)}>
      {title && <h2 className="text-[15px] font-black text-black">{title}</h2>}
      {description && (
        <p className="mt-2 text-xs font-semibold leading-5 text-black/40">
          {description}
        </p>
      )}
      <div className="mt-5 space-y-5">
        {axes.map((axis) => (
          <VibeAxisBar
            key={axis}
            axis={axis}
            score={values[axis]}
            scoreScale="legacy"
            axisLabelOverrides={feedbackAxisLabelOverrides[axis]}
            showAxisHeader={false}
            animateBar={false}
            input={{
              value: values[axis],
              min: 1,
              max: 5,
              step: 1,
              onChange: (value) => onChange(axis, value),
            }}
          />
        ))}
      </div>
    </section>
  );
}

function TicketFeedbackPlaceholder() {
  return (
    <div className="py-5">
      <section className="rounded-3xl border border-black/10 bg-white px-5 py-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/12 text-accent">
          <PenLine size={20} aria-hidden />
        </div>
        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.14em] text-accent">
          feedback
        </p>
        <h2 className="mt-2 text-[23px] font-black text-black">피드백 작성</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-black/52">
          이 자리에 대한 피드백을 남기는 화면이에요.
          <br />
          입력 항목은 곧 준비될 예정입니다.
        </p>
      </section>
    </div>
  );
}

function formatKoreanDateTime(value: string) {
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

function ProfileTab({
  profile,
  answers,
  vibeAnimationKey,
  loggingOut,
  logoutError,
  onLogout,
}: {
  profile: ProfileRow;
  answers: AnswerMap;
  vibeAnimationKey: number;
  loggingOut: boolean;
  logoutError: string | null;
  onLogout: () => Promise<void>;
}) {
  const publicIntro = profile.public_intro?.trim();
  const vibeScores = useMemo(
    () => profileVibeScores(profile, answers),
    [answers, profile],
  );

  return (
    <TabMotion>
      <section className="px-5 pb-7 pt-7">
        <header className="pr-16">
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
            profile
          </p>
          <h1 className="mt-2 text-[27px] font-bold leading-9 tracking-tight text-black">
            {profileInitial(profile)}님의 프로필
          </h1>
        </header>

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

        <VibeGraph
          title="나의 대화 결"
          description="교집합이 자리를 제안할 때 참고하는 분위기예요."
          scores={vibeScores}
          visibleAxes={profileVibeAxes}
          showAxisHeader={false}
          scoreScale="internal"
          animationKey={vibeAnimationKey}
          className="mt-5"
        />

        <button
          type="button"
          onClick={() => {
            window.location.href = "/details?from=profile";
          }}
          className="mt-8 flex h-12 w-full items-center justify-center rounded-full border border-black/10 bg-white text-xs font-semibold text-black/55"
        >
          교집합 소개 다시 보기
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

        {logoutError && (
          <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-center text-xs font-semibold leading-5 text-red-600">
            {logoutError}
          </p>
        )}
      </section>
    </TabMotion>
  );
}

function BasicInfoPanel({
  profile,
  onProfileUpdated,
  onClose,
}: {
  profile: ProfileRow;
  onProfileUpdated: (profile: ProfileRow) => void;
  onClose: () => void;
}) {
  const initialDraft = useMemo<BasicInfoDraft>(
    () => ({
      nickname: profileNickname(profile),
      name: profile.name ?? "",
      phone: profile.phone ?? profile.phone_normalized ?? "",
      gender: profile.gender ?? "",
      birthYear: profile.birth_year == null ? "" : String(profile.birth_year),
      mbti: profile.mbti ?? "",
    }),
    [
      profile.birth_year,
      profile.gender,
      profile.mbti,
      profile.name,
      profile.nickname,
      profile.phone,
      profile.phone_normalized,
    ],
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = useMemo(
    () =>
      isValidNickname(draft.nickname) &&
      draft.name.trim().length > 1 &&
      normalizePhone(draft.phone).length >= 10 &&
      (draft.gender === "여성" || draft.gender === "남성") &&
      /^\d{4}$/.test(draft.birthYear) &&
      mbtiOptions.includes(draft.mbti.toUpperCase()),
    [draft],
  );
  const fields = [
    { label: "닉네임", value: profileNickname(profile) },
    { label: "이름", value: displayValue(profile.name) },
    {
      label: "전화번호",
      value: displayValue(profile.phone ?? profile.phone_normalized),
    },
    { label: "성별", value: displayValue(profile.gender) },
    { label: "출생연도", value: displayValue(profile.birth_year) },
    { label: "MBTI", value: displayValue(profile.mbti) },
  ];

  useEffect(() => {
    if (!editing) setDraft(initialDraft);
  }, [editing, initialDraft]);

  const save = async () => {
    if (!canSave || saving) return;

    setSaving(true);
    setSaved(false);
    setError(null);

    const normalizedPhone = normalizePhone(draft.phone);
    const nextProfile: ProfileRow = {
      ...profile,
      nickname: draft.nickname.trim(),
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      phone_normalized: normalizedPhone,
      gender: draft.gender,
      birth_year: draft.birthYear,
      mbti: draft.mbti.toUpperCase(),
    };

    const { error: saveError } = await createClient()
      .from("profiles")
      .update({
        nickname: nextProfile.nickname,
        name: nextProfile.name,
        phone: nextProfile.phone,
        phone_normalized: nextProfile.phone_normalized,
        gender: nextProfile.gender,
        birth_year: nextProfile.birth_year,
        mbti: nextProfile.mbti,
      })
      .eq("user_id", profile.user_id);

    if (saveError) {
      setError("기본정보 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
      return;
    }

    onProfileUpdated(nextProfile);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    window.setTimeout(() => setSaved(false), 1400);
  };

  const cancelEdit = () => {
    setDraft(initialDraft);
    setError(null);
    setEditing(false);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="absolute inset-x-4 top-[calc(64px+env(safe-area-inset-top))] z-40 max-h-[calc(100%_-_148px_-_env(safe-area-inset-top))] overflow-y-auto rounded-[20px] border border-black/10 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.16)] scrollbar-none"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase text-black/35">
            profile
          </p>
          <h2 className="mt-0.5 text-base font-bold text-black">
            기본정보 카드
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="h-8 rounded-full border border-black/10 px-3 text-[11px] font-semibold text-black/50"
            >
              취소
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={saving}
              title="기본정보 수정"
              aria-label="기본정보 수정"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-black/50 disabled:opacity-50"
            >
              <PenLine size={14} aria-hidden />
            </button>
          )}
          <button
            type="button"
            title="닫기"
            aria-label="닫기"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-black/45"
          >
            <X size={17} aria-hidden />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-4 space-y-4 border-t border-black/8 pt-4">
          <BasicInfoField
            label="닉네임"
            labelAside="두 글자로 입력해주세요."
            value={draft.nickname}
            maxLength={2}
            onChange={(nickname) =>
              setDraft((current) => ({
                ...current,
                nickname: nickname.replace(/[^가-힣]/g, "").slice(0, 2),
              }))
            }
          />
          <BasicInfoField
            label="이름"
            value={draft.name}
            onChange={(name) => setDraft((current) => ({ ...current, name }))}
          />
          <BasicInfoField
            label="전화번호"
            value={draft.phone}
            inputMode="tel"
            onChange={(phone) => setDraft((current) => ({ ...current, phone }))}
          />

          <fieldset>
            <legend className="text-xs font-semibold text-black/45">성별</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["여성", "남성"] as Gender[]).map((gender) => (
                <button
                  key={gender}
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({ ...current, gender }))
                  }
                  className={cn(
                    "h-11 rounded-2xl border text-xs font-semibold transition",
                    draft.gender === gender
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white text-black/50",
                  )}
                >
                  {gender}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <BasicInfoField
              label="출생연도"
              value={draft.birthYear}
              inputMode="numeric"
              maxLength={4}
              onChange={(birthYear) =>
                setDraft((current) => ({
                  ...current,
                  birthYear: birthYear.replace(/\D/g, "").slice(0, 4),
                }))
              }
            />
            <div>
              <span className="flex items-baseline gap-2 text-xs font-semibold text-black/45">
                <span>MBTI</span>
              </span>
              <MbtiSelect
                value={draft.mbti}
                onChange={(mbti) =>
                  setDraft((current) => ({
                    ...current,
                    mbti,
                  }))
                }
              />
            </div>
          </div>

          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
              {error}
            </p>
          )}

          <motion.button
            type="button"
            whileTap={canSave && !saving ? { scale: 0.98 } : undefined}
            disabled={!canSave || saving}
            onClick={() => void save()}
            title="변경사항 저장"
            aria-label="변경사항 저장"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-semibold text-white disabled:bg-black/[0.08] disabled:text-black/30"
          >
            <Check size={15} aria-hidden />
            {saving ? "저장 중..." : "변경사항 저장"}
          </motion.button>
        </div>
      ) : (
        <>
          <dl className="mt-4 space-y-2.5 border-t border-black/8 pt-4">
            {fields.map((field) => (
              <div
                key={field.label}
                className="flex items-center justify-between gap-4 py-1"
              >
                <dt className="shrink-0 text-xs font-semibold text-black/45">
                  {field.label}
                </dt>
                <dd className="text-right text-xs font-semibold text-black/70">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
          {saved && (
            <p className="mt-4 rounded-2xl bg-accent/10 px-4 py-3 text-xs font-semibold text-accent">
              기본정보가 저장됐어요.
            </p>
          )}
        </>
      )}
    </motion.section>
  );
}

function BasicInfoField({
  label,
  labelAside,
  value,
  inputMode,
  maxLength,
  onChange,
}: {
  label: string;
  labelAside?: string;
  value: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-2 text-xs font-semibold text-black/45">
        <span>{label}</span>
        {labelAside && (
          <span className="text-[10px] font-semibold text-black/32">
            {labelAside}
          </span>
        )}
      </span>
      <input
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none focus:border-accent"
      />
    </label>
  );
}

function TabMotion({ children }: { children: React.ReactNode }) {
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
