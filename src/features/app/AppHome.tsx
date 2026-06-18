"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Coffee,
  Heart,
  LogOut,
  MapPin,
  MessageCircle,
  X,
  PenLine,
  Sparkles,
  Ticket as TicketIcon,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MbtiSelect, mbtiOptions } from "@/components/MbtiSelect";
import {
  formatTicketDateLabel,
  IntersectionTicketCard,
} from "@/components/IntersectionTicketCard";
import { VibeGraph } from "@/components/vibe/VibeGraph";
import type { VibeScores } from "@/components/vibe/vibeGraphConfig";
import { profileQuestions, questionCategories } from "@/data/profileQuestions";
import {
  MeetingRecommendation,
} from "@/features/meetings/MeetingRecommendation";
import { TicketDetailContent } from "@/features/meetings/TicketDetailContent";
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
  ProfileQuestion,
  QuestionAnswer,
  QuestionCategory,
  QuestionOption,
} from "@/types/question";
import type {
  GatheringTicket,
  TicketArrivalStatus,
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

const tabItems: Array<{ id: AppTab; label: string; Icon: LucideIcon }> = [
  { id: "browse", label: "티켓", Icon: TicketIcon },
  { id: "recommend", label: "추천", Icon: Sparkles },
  { id: "profile", label: "프로필", Icon: UserRound },
];

const categoryIcons: Partial<Record<QuestionCategory, LucideIcon>> = {
  온도: Coffee,
  결: MessageCircle,
  톤: Heart,
  리듬: Sparkles,
  "모임 역할": Users,
  "모임 역할 - 상대": Users,
  "관계 기대": Heart,
  "회피 조건": X,
  "나이 조건": Users,
  "모임 취향": TicketIcon,
  자기소개: PenLine,
};

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

function questionOptionValue(option: string | QuestionOption) {
  return typeof option === "string" ? option : option.value;
}

function questionOptionLabel(option: string | QuestionOption) {
  return typeof option === "string" ? option : option.label;
}

function questionOptionMeta(question: ProfileQuestion, value: string) {
  return question.options
    ?.map((option) =>
      typeof option === "string" ? { value: option, label: option } : option,
    )
    .find((option) => option.value === value);
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

function isAnswerComplete(question: ProfileQuestion, answer?: QuestionAnswer) {
  if (!answer) return false;
  if (question.type === "ticket_rating") {
    return (
      typeof answer.value === "object" &&
      !Array.isArray(answer.value) &&
      Boolean(answer.value.ticket_id && answer.value.rating)
    );
  }

  const value = answer.value;
  const hasValue = Array.isArray(value)
    ? value.length > 0
    : typeof value === "object"
      ? false
    : Boolean(String(value).trim());

  if (!hasValue) return false;

  const needsOther = Array.isArray(value)
    ? value.some((item) => questionOptionMeta(question, item)?.hasTextInput)
    : typeof value === "string" &&
      Boolean(questionOptionMeta(question, value)?.hasTextInput);

  return !needsOther || Boolean(answer.otherText?.trim());
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

function profileVibeScores(answers: AnswerMap): VibeScores {
  return {
    temperature: answerScore(answers[1]),
    texture: answerScore(answers[2]),
    tone: answerScore(answers[3]),
    rhythm: answerScore(answers[4]),
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
              key="profile"
              profile={currentProfile}
              answers={answers}
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
  const confirmed = userTicket.rawStatus === "approved";
  const [statusOpen, setStatusOpen] = useState(true);

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
          {userTicket.status === "feedback_open" ? (
            <TicketFeedbackPlaceholder userTicket={userTicket} />
          ) : (
            <>
              <TicketStatusOverview userTicket={userTicket} open={statusOpen} />
              <TicketDetailContent ticket={ticket} />
              {confirmed && <ConfirmedTicketSections userTicket={userTicket} />}
            </>
          )}
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

const ticketProgressSteps = [
  "신청 완료",
  "참여 확정",
  "시작 전 안내",
  "진행 중",
  "피드백 작성",
];

function TicketStatusOverview({
  userTicket,
  open,
}: {
  userTicket: UserTicket;
  open: boolean;
}) {
  const ticket = userTicket.ticket;

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
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl bg-black/[0.03] px-4 py-3 text-xs font-bold text-black/58">
              <TicketMetaLine Icon={CalendarDays}>
                {formatTicketDateLabel(ticket.date)} {ticket.time}
              </TicketMetaLine>
              <TicketMetaLine Icon={MapPin}>{ticket.area}</TicketMetaLine>
            </div>

            <TicketProgressSteps progressIndex={userTicket.progressIndex} />
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

function TicketProgressSteps({ progressIndex }: { progressIndex: number }) {
  return (
    <div className="mt-5">
      <div className="grid grid-cols-5 gap-1.5">
        {ticketProgressSteps.map((step, index) => {
          const active = index <= progressIndex;
          const current = index === progressIndex;

          return (
            <div key={step} className="min-w-0">
              <div
                className={cn(
                  "h-1.5 rounded-full transition",
                  active ? "bg-accent" : "bg-black/8",
                )}
              />
              <div className="mt-2 flex min-h-10 flex-col items-center text-center">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black",
                    active
                      ? "bg-black text-white"
                      : "bg-black/[0.05] text-black/30",
                  )}
                >
                  {active ? <Check size={13} aria-hidden /> : index + 1}
                </span>
                <span
                  className={cn(
                    "mt-1 text-[10px] font-black leading-3",
                    current
                      ? "text-black"
                      : active
                        ? "text-black/52"
                        : "text-black/25",
                  )}
                >
                  {step}
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
      <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800">
        결제 확인이 완료되면 대기열 등록 상태로 전환돼요. 운영자가 확인한 뒤
        참여 확정 여부를 안내합니다.
      </p>
    );
  }

  if (userTicket.status === "waitlisted") {
    return (
      <p className="mt-4 rounded-2xl bg-sky-50 px-4 py-3 text-xs font-bold leading-5 text-sky-800">
        대기열 등록이 완료됐어요. 운영자가 자리 구성을 확인한 뒤 참여 확정
        여부를 안내합니다.
      </p>
    );
  }

  return (
    <p className="mt-4 rounded-2xl bg-accent/[0.08] px-4 py-3 text-xs font-bold leading-5 text-black/62">
      참여가 확정되었어요. 이제 모임 안내와 함께 멤버 정보를 확인할 수 있어요.
    </p>
  );
}

function ConfirmedTicketSections({ userTicket }: { userTicket: UserTicket }) {
  return (
    <div className="border-t border-black/8 pt-5">
      <PlaceSection userTicket={userTicket} />
      <MemberIntroCarousel members={userTicket.members} />
      <ArrivalStatusPanel userTicket={userTicket} />
      <FeedbackGuide userTicket={userTicket} />
    </div>
  );
}

function PlaceSection({ userTicket }: { userTicket: UserTicket }) {
  const hasPlace = Boolean(
    userTicket.place?.name?.trim() || userTicket.place?.address?.trim(),
  );

  return (
    <section className="py-5 first:pt-0">
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

function ArrivalStatusPanel({ userTicket }: { userTicket: UserTicket }) {
  const [selected, setSelected] = useState<TicketArrivalStatus | null>(
    userTicket.arrivalStatus,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setSaving(false);
  };

  return (
    <section className="border-t border-black/8 py-5">
      <h2 className="text-[15px] font-black text-black">도착 상태</h2>
      {!userTicket.canSetArrival ? (
        <p className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/50">
          도착 상태는 모임 시작 2시간 전부터 선택할 수 있어요.
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
                    ? "border-accent bg-accent/12 text-black"
                    : "border-black/10 bg-white text-black/55 hover:border-black/20",
                )}
              >
                <span>{option.label}</span>
                {active && <Check size={16} className="text-accent" aria-hidden />}
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

function TicketFeedbackPlaceholder({
  userTicket,
}: {
  userTicket: UserTicket;
}) {
  return (
    <div className="py-5">
      <TicketProgressSteps progressIndex={userTicket.progressIndex} />
      <section className="mt-6 rounded-3xl border border-black/10 bg-white px-5 py-6 text-center">
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
  loggingOut,
  logoutError,
  onLogout,
}: {
  profile: ProfileRow;
  answers: AnswerMap;
  loggingOut: boolean;
  logoutError: string | null;
  onLogout: () => Promise<void>;
}) {
  const [editingCategory, setEditingCategory] =
    useState<QuestionCategory | null>(null);
  const questionGroups = useMemo(
    () =>
      profileQuestions
        .filter(
          (question) =>
            question.type !== "ticket_rating" &&
            question.category !== "모임 취향",
        )
        .reduce(
        (groups, question) => {
          groups[question.category] = groups[question.category] ?? [];
          groups[question.category].push(question);
          return groups;
        },
        {} as Record<QuestionCategory, ProfileQuestion[]>,
      ),
    [],
  );
  const categories = Object.keys(questionGroups) as QuestionCategory[];
  const publicIntro = profile.public_intro?.trim();
  const vibeScores = useMemo(() => profileVibeScores(answers), [answers]);

  return (
    <TabMotion>
      <section className="px-5 pb-7 pt-7">
        <header className="pr-16">
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
            question cards
          </p>
          <h1 className="mt-2 text-[27px] font-bold leading-9 tracking-tight text-black">
            {profileInitial(profile)}님의 질문 카드첩
          </h1>
          <p className="mt-2 text-sm leading-6 text-black/48">
            카드를 열어 내가 남긴 답변을 확인할 수 있어요.
          </p>
        </header>

        <section className="mt-7 rounded-2xl border border-black/10 bg-white px-4 py-4 shadow-[0_10px_28px_rgba(0,0,0,0.035)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
            about me
          </p>
          <h2 className="mt-1 text-lg font-bold leading-7 text-black">
            {profileInitial(profile)}
          </h2>
          <p className="mt-3 whitespace-pre-line text-xs leading-6 text-black/58">
            {publicIntro ?? "아직 작성된 자기소개가 없어요. 교집합 소개를 다시 만들면 이곳에서 확인할 수 있어요."}
          </p>
        </section>

        <VibeGraph
          title="나의 대화 결"
          description="교집합이 자리를 제안할 때 참고하는 분위기예요."
          scores={vibeScores}
          visibleAxes={["temperature", "texture", "tone", "rhythm"]}
          showAxisHeader={false}
          className="mt-5"
        />

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {categories.map((category) => {
            const Icon = categoryIcons[category] ?? Sparkles;
            const questions = questionGroups[category];
            const meta = questionCategories.find((item) => item.key === category);
            const label = meta?.label ?? category;
            const completeCount = questions.filter((question) =>
              isAnswerComplete(question, answers[question.id]),
            ).length;
            const selected = editingCategory === category;

            return (
              <button
                key={category}
                type="button"
                title={`${label} 답변 보기`}
                aria-label={`${label} 답변 보기`}
                onClick={() => setEditingCategory(selected ? null : category)}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border bg-white text-xs font-semibold transition-all",
                  selected
                    ? "border-black text-black shadow-[0_8px_26px_rgba(0,0,0,0.08)]"
                    : "border-black/10 text-black/55 hover:border-black/20",
                )}
              >
                <Icon size={19} aria-hidden />
                <span>{label}</span>
                <span className="text-[9px] font-medium text-black/45">
                  {completeCount}/{questions.length}
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {editingCategory && (
            <motion.section
              key={editingCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-7 border-t border-black/10 pt-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-black">
                  {questionCategories.find((item) => item.key === editingCategory)
                    ?.label ?? editingCategory}{" "}
                  카드 목록
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/55"
                >
                  목록 닫기
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {questionGroups[editingCategory].map((question, index) => (
                  <QuestionAnswerCard
                    key={question.id}
                    index={index}
                    question={question}
                    answer={answers[question.id]}
                  />
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

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

function answerDisplayItems(question: ProfileQuestion, answer?: QuestionAnswer) {
  if (!answer) return [];

  if (question.type === "text") {
    return typeof answer.value === "string" && answer.value.trim()
      ? [answer.value.trim()]
      : [];
  }

  if (question.type === "multi_choice") {
    if (!Array.isArray(answer.value)) return [];

    return answer.value
      .map((value) => {
        const option = questionOptionMeta(question, value);
        const label = option?.label ?? value;
        if (option?.hasTextInput && answer.otherText?.trim()) {
          return `${label}: ${answer.otherText.trim()}`;
        }
        return label;
      })
      .filter(Boolean);
  }

  if (question.type === "single_choice") {
    const value =
      typeof answer.value === "string" || typeof answer.value === "number"
        ? String(answer.value)
        : "";
    if (!value) return [];

    const option = questionOptionMeta(question, value);
    const label = option?.label ?? value;
    if (option?.hasTextInput && answer.otherText?.trim()) {
      return [`${label}: ${answer.otherText.trim()}`];
    }
    return [label];
  }

  return [];
}

function QuestionAnswerCard({
  question,
  answer,
  index,
}: {
  question: ProfileQuestion;
  answer?: QuestionAnswer;
  index: number;
}) {
  const categoryLabel =
    questionCategories.find((item) => item.key === question.category)?.label ??
    question.category;
  const items = answerDisplayItems(question, answer);

  return (
    <article className="rounded-[22px] border border-black/10 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.01)]">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-[9px] font-bold text-white">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-accent">
            {categoryLabel}
          </p>
          <h3 className="mt-0.5 whitespace-pre-line text-xs font-bold leading-5 text-black/85">
            {question.question}
          </h3>
        </div>
      </div>

      {items.length > 0 ? (
        question.type === "text" ? (
          <p className="whitespace-pre-line rounded-2xl bg-[#f7f7f5] px-4 py-3 text-xs font-medium leading-6 text-black/65">
            {items[0]}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => (
              <span
                key={item}
                className="rounded-full border border-black/10 bg-[#f7f7f5] px-3 py-1.5 text-[10px] font-semibold leading-4 text-black/65"
              >
                {item}
              </span>
            ))}
          </div>
        )
      ) : (
        <p className="rounded-2xl bg-[#f7f7f5] px-4 py-3 text-xs font-semibold text-black/35">
          아직 저장된 답변이 없어요.
        </p>
      )}
    </article>
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
