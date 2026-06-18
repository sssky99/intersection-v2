"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  Coffee,
  Heart,
  LogOut,
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
import { IntersectionTicketCard } from "@/components/IntersectionTicketCard";
import { VibeGraph } from "@/components/vibe/VibeGraph";
import type { VibeScores } from "@/components/vibe/vibeGraphConfig";
import { profileQuestions, questionCategories } from "@/data/profileQuestions";
import {
  MeetingRecommendation,
} from "@/features/meetings/MeetingRecommendation";
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
import type { AvailableDate, GatheringTicket } from "@/types/ticket";
import type { Gender } from "@/types/user";
import type { LucideIcon } from "lucide-react";

export type AppTab = "browse" | "recommend" | "profile";

type WaitlistedTicket = {
  ticket: GatheringTicket;
  status: "waitlisted";
};

type WaitlistRow = {
  status: string | null;
  ticket_id: string | null;
  ticket_instance_id: string | null;
};

type AnswerRow = {
  question_order: number;
  answer_value: string | null;
  answer_values: string[] | null;
  answer_text: string | null;
  other_text: string | null;
};

type AnswerMap = Record<number, QuestionAnswer>;

type BasicInfoDraft = {
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
  const name = profileName(profile).replace(/\s/g, "");
  return name.length > 2 ? name.slice(-2) : name;
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

async function fetchWaitlistedTickets(userId: string) {
  const waitlistRequest = createClient()
    .from("meeting_waitlist")
    .select("status,ticket_id,ticket_instance_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<WaitlistRow[]>();
  const ticketRequest = fetch("/api/meetings/tickets?includeApplied=1", {
    cache: "no-store",
  })
    .then(async (response) => {
      const data = (await response.json().catch(() => null)) as
        | { dates?: AvailableDate[] }
        | null;

      return response.ok ? data?.dates ?? [] : [];
    })
    .catch(() => []);

  const [{ data, error }, availableDates] = await Promise.all([
    waitlistRequest,
    ticketRequest,
  ]);

  if (error || !data) return null;

  const ticketMap = new Map(
    availableDates.flatMap((date) =>
      date.tickets.map((ticket) => [ticket.id, ticket] as const),
    ),
  );

  return data.flatMap((row) =>
    ticketMap.get(row.ticket_instance_id ?? row.ticket_id ?? "")
      ? [
          {
            ticket: ticketMap.get(row.ticket_instance_id ?? row.ticket_id ?? "")!,
            status: "waitlisted" as const,
          },
        ]
      : [],
  );
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
  const [waitlistedTickets, setWaitlistedTickets] = useState<WaitlistedTicket[]>(
    [],
  );
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

    void fetchWaitlistedTickets(userId).then((tickets) => {
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

  const addWaitlistedTicket = (ticket: GatheringTicket) => {
    setWaitlistedTickets((current) =>
      current.some((item) => item.ticket.id === ticket.id)
        ? current
        : [...current, { ticket, status: "waitlisted" }],
    );
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
  tickets: WaitlistedTicket[];
  onGoRecommend: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const dragState = useRef({
    active: false,
    interacting: false,
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
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      startIndex: activeIndex,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDesktopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;

    event.preventDefault();
    event.currentTarget.scrollLeft =
      dragState.current.scrollLeft - (event.clientX - dragState.current.startX);
  };

  const finishDesktopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const wasActive = dragState.current.active;
    const dragDistance = event.clientX - dragState.current.startX;
    const threshold = event.pointerType === "touch" ? 54 : 22;
    dragState.current.active = false;
    dragState.current.interacting = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
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

  return (
    <TabMotion>
      <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white pb-2 pt-[calc(16px+env(safe-area-inset-top))] text-black">
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
              {tickets.map(({ ticket }) => (
                <div
                  key={ticket.id}
                  data-ticket-slide
                  className="w-[min(78vw,330px,calc(61.73dvh-121px))] shrink-0 snap-center snap-always"
                >
                  <StoredTicketCard ticket={ticket} />
                </div>
              ))}
            </div>

            {tickets.length > 1 && (
              <div
                className="mt-1.5 flex shrink-0 justify-center gap-1.5"
                aria-label={`티켓 ${activeIndex + 1}/${tickets.length}`}
              >
                {tickets.map(({ ticket }, index) => (
                  <span
                    key={ticket.id}
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
      </section>
    </TabMotion>
  );
}

function StoredTicketCard({ ticket }: { ticket: GatheringTicket }) {
  return (
    <IntersectionTicketCard
      title={ticket.title}
      imageUrl={ticket.imageUrl}
      date={ticket.date}
      time={ticket.time}
      location={`서울\n${ticket.area}`}
      tags={ticket.moodTags}
      remainingSeatCount={ticket.remainingSeatCount}
    />
  );
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
      draft.name.trim().length > 1 &&
      normalizePhone(draft.phone).length >= 10 &&
      (draft.gender === "여성" || draft.gender === "남성") &&
      /^\d{4}$/.test(draft.birthYear) &&
      mbtiOptions.includes(draft.mbti.toUpperCase()),
    [draft],
  );
  const fields = [
    { label: "닉네임", value: profileInitial(profile) },
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
              <span className="text-xs font-semibold text-black/45">MBTI</span>
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
  value,
  inputMode,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/45">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none focus:border-accent"
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
