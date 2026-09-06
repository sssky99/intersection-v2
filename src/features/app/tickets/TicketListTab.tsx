"use client";
import { MatchingLoader } from "@/features/meetings/MeetingRecommendation";
import { ticketFadeTransition } from "@/features/meetings/TicketDetailHero";
import {
  canCancelMeetingDateApplication,
  meetingDateApplicationMatchesTicket,
  type MeetingDateApplication,
} from "@/lib/meetingDateApplications";
import { ticketInteractionCanRespond } from "@/lib/ticketInteractions";
import type { BlindDateUserOffer } from "@/types/blindDate";
import type {
  GatheringTicket,
  TicketInteraction,
  UserTicket,
} from "@/types/ticket";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Ticket as TicketIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AssignedApplicationTicketDetailView,
  DeclinedTicketReview,
} from "./TicketApplicationDetail";
import {
  AssignedApplicationTicketCard,
  BlindDateTicketCard,
  InteractionTicketCard,
  StoredTicketCard,
} from "./TicketCards";
import { StoredTicketDetailView } from "./TicketProgress";

export type TicketListItem =
  | {
      kind: "date-application";
      id: string;
      application: MeetingDateApplication;
      ticket: GatheringTicket;
    }
  | { kind: "stored-ticket"; id: string; userTicket: UserTicket }
  | {
      kind: "interaction-ticket";
      id: string;
      interaction: TicketInteraction;
      application: MeetingDateApplication | null;
    }
  | { kind: "blind-date"; id: string; offer: BlindDateUserOffer };

export function ticketListItemUpdatedAt(item: TicketListItem) {
  const value =
    item.kind === "stored-ticket"
      ? item.userTicket.updatedAt
      : item.kind === "interaction-ticket"
        ? item.interaction.updatedAt
        : item.kind === "blind-date"
          ? item.offer.createdAt
          : (item.application.updatedAt ?? item.application.createdAt);
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function shouldShowBlindDateTicket(offer: BlindDateUserOffer) {
  if (
    offer.isExpired ||
    ["pending_admin", "declined", "expired", "cancelled", "completed"].includes(
      offer.status,
    )
  ) {
    return false;
  }

  if (offer.status !== "scheduled" || !offer.feedbackClosesAt) return true;
  const feedbackClosesAt = new Date(offer.feedbackClosesAt).getTime();
  return !Number.isFinite(feedbackClosesAt) || feedbackClosesAt > Date.now();
}

export function TicketListTab({
  readOnly,
  initialLoading,
  tickets,
  interactions,
  dateApplications,
  blindDateOffers,
  availableTickets,
  totalTicketCount,
  loadingMore,
  participantPhotoUrl,
  previewMatchPhotoUrls,
  previewOtherMemberPhotoUrls,
  onGoRecommend,
  onReapplyTicket,
  onDeclineTicket,
  onCancelApplication,
  onOpenBlindDate,
  onFocusModeChange,
  focusRequest,
  initialFeedbackParticipationId,
}: {
  readOnly: boolean;
  initialLoading: boolean;
  tickets: UserTicket[];
  interactions: TicketInteraction[];
  dateApplications: MeetingDateApplication[];
  blindDateOffers: BlindDateUserOffer[];
  availableTickets: GatheringTicket[];
  totalTicketCount: number;
  loadingMore: boolean;
  participantPhotoUrl?: string | null;
  previewMatchPhotoUrls: string[];
  previewOtherMemberPhotoUrls: string[];
  onGoRecommend: () => void;
  onReapplyTicket: (ticket: GatheringTicket) => void;
  onDeclineTicket: (ticket: GatheringTicket) => Promise<boolean>;
  onCancelApplication: (
    application: MeetingDateApplication,
    ticket: GatheringTicket,
  ) => Promise<boolean>;
  onOpenBlindDate: (offerId: string) => void;
  onFocusModeChange: (focused: boolean) => void;
  focusRequest: { id: number; ticketId: string } | null;
  initialFeedbackParticipationId: string | null;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const [selectedApplicationTicket, setSelectedApplicationTicket] =
    useState<GatheringTicket | null>(null);
  const [
    selectedApplicationTicketDeclined,
    setSelectedApplicationTicketDeclined,
  ] = useState(false);
  const [selectedApplicationTicketOpen, setSelectedApplicationTicketOpen] =
    useState(false);
  const [declinedViewOpen, setDeclinedViewOpen] = useState(false);
  const [declinedTickets, setDeclinedTickets] = useState<GatheringTicket[]>([]);
  const [declinedLoading, setDeclinedLoading] = useState(false);
  const [declinedError, setDeclinedError] = useState<string | null>(null);
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
  const feedbackDeepLinkOpenedRef = useRef(false);

  useEffect(() => {
    if (!initialFeedbackParticipationId || feedbackDeepLinkOpenedRef.current) {
      return;
    }

    const feedbackTicket = tickets.find(
      (ticket) => ticket.waitlistId === initialFeedbackParticipationId,
    );
    if (!feedbackTicket) return;

    feedbackDeepLinkOpenedRef.current = true;
    setSelectedTicket(feedbackTicket);
  }, [initialFeedbackParticipationId, tickets]);

  useEffect(() => {
    const focused = Boolean(
      selectedTicket ||
        (selectedApplicationTicket &&
          (selectedApplicationTicketDeclined || selectedApplicationTicketOpen)),
    );
    onFocusModeChange(focused);
    return () => onFocusModeChange(false);
  }, [
    onFocusModeChange,
    selectedTicket,
    selectedApplicationTicket,
    selectedApplicationTicketDeclined,
    selectedApplicationTicketOpen,
  ]);

  const availableTicketById = useMemo(
    () => new Map(availableTickets.map((ticket) => [ticket.id, ticket])),
    [availableTickets],
  );
  const applicationByEventId = useMemo(
    () =>
      new Map<string, MeetingDateApplication>(
        dateApplications.flatMap((application) =>
          application.eventId
            ? [[application.eventId, application] as const]
            : [],
        ),
      ),
    [dateApplications],
  );
  const selectedTicketApplication = useMemo(() => {
    if (!selectedTicket) return null;

    return (
      dateApplications.find(
        (application) =>
          meetingDateApplicationMatchesTicket(
            application,
            selectedTicket.ticket.id,
            selectedTicket.waitlistId,
          ) && canCancelMeetingDateApplication(application.status),
      ) ?? null
    );
  }, [dateApplications, selectedTicket]);
  const selectedApplicationDetailApplication = useMemo(() => {
    if (!selectedApplicationTicket) return null;

    return (
      dateApplications.find(
        (application) =>
          meetingDateApplicationMatchesTicket(
            application,
            selectedApplicationTicket.id,
          ) && canCancelMeetingDateApplication(application.status),
      ) ?? null
    );
  }, [dateApplications, selectedApplicationTicket]);
  const ticketItems = useMemo<TicketListItem[]>(() => {
    const applicationItems = dateApplications.flatMap(
      (application): TicketListItem[] => {
        if (
          ["cancelled", "not_selected", "feedback_done", "completed"].includes(
            application.status,
          )
        ) {
          return [];
        }

        if (!application.assignedTicketInstanceId) return [];

        const ticket =
          availableTicketById.get(application.assignedTicketInstanceId) ?? null;

        // Applications without a concrete program are legacy/incomplete data.
        // They must not create placeholder cards in the ticket tab.
        if (!ticket) return [];

        return [
          {
            kind: "date-application",
            id: `date-application:${application.id}`,
            application,
            ticket,
          },
        ];
      },
    );
    const authoritativeProgramDates = new Set(
      [
        ...applicationItems
          .filter(
            (item) =>
              item.kind === "date-application" &&
              Boolean(item.application.assignedTicketInstanceId),
          )
          .map((item) =>
            item.kind === "date-application"
              ? `${item.ticket.templateId}|${item.ticket.date}`
              : "",
          ),
        ...tickets.map(
          (userTicket) =>
            `${userTicket.ticket.templateId}|${userTicket.ticket.date}`,
        ),
      ].filter(Boolean),
    );
    const visibleInteractions = interactions.filter(
      (interaction) =>
        !authoritativeProgramDates.has(
          `${interaction.ticket.templateId}|${interaction.ticket.date}`,
        ),
    );
    const candidates: TicketListItem[] = [
      ...applicationItems,
      ...tickets.map(
        (userTicket): TicketListItem => ({
          kind: "stored-ticket" as const,
          id: `stored-ticket:${userTicket.id}`,
          userTicket,
        }),
      ),
      ...visibleInteractions.map(
        (interaction): TicketListItem => ({
          kind: "interaction-ticket",
          id: `interaction-ticket:${interaction.ticket.id}`,
          interaction,
          application: applicationByEventId.get(interaction.ticket.id) ?? null,
        }),
      ),
      ...blindDateOffers.filter(shouldShowBlindDateTicket).map(
        (offer): TicketListItem => ({
          kind: "blind-date",
          id: `blind-date:${offer.id}`,
          offer,
        }),
      ),
    ];
    const latestItemByTicket = new Map<string, TicketListItem>();
    for (const item of candidates) {
      if (item.kind === "blind-date") {
        latestItemByTicket.set(item.id, item);
        continue;
      }
      const ticketId =
        item.kind === "stored-ticket"
          ? item.userTicket.ticket.id
          : item.kind === "interaction-ticket"
            ? item.interaction.ticket.id
            : item.ticket.id;
      if (!ticketId) {
        latestItemByTicket.set(item.id, item);
        continue;
      }

      const current = latestItemByTicket.get(ticketId);
      if (
        !current ||
        ticketListItemUpdatedAt(item) > ticketListItemUpdatedAt(current)
      ) {
        latestItemByTicket.set(ticketId, item);
      }
    }
    const items = Array.from(latestItemByTicket.values());
    return items.sort((left, right) => {
      const leftDate =
        left.kind === "stored-ticket"
          ? left.userTicket.ticket.date
          : left.kind === "interaction-ticket"
            ? left.interaction.ticket.date
            : left.kind === "blind-date"
              ? (left.offer.scheduledDate ?? left.offer.createdAt.slice(0, 10))
              : left.application.meetingDate;
      const rightDate =
        right.kind === "stored-ticket"
          ? right.userTicket.ticket.date
          : right.kind === "interaction-ticket"
            ? right.interaction.ticket.date
            : right.kind === "blind-date"
              ? (right.offer.scheduledDate ??
                right.offer.createdAt.slice(0, 10))
              : right.application.meetingDate;
      return leftDate.localeCompare(rightDate);
    });
  }, [
    availableTicketById,
    applicationByEventId,
    interactions,
    dateApplications,
    blindDateOffers,
    tickets,
  ]);
  const itemCount = ticketItems.length;
  const carouselItemCount = itemCount;

  useEffect(() => {
    if (!focusRequest) return;
    const targetIndex = ticketItems.findIndex((item) => {
      const ticketId =
        item.kind === "stored-ticket"
          ? item.userTicket.ticket.id
          : item.kind === "interaction-ticket"
            ? item.interaction.ticket.id
            : item.kind === "blind-date"
              ? null
              : item.ticket.id;
      return ticketId === focusRequest.ticketId;
    });
    if (targetIndex < 0) return;

    setActiveIndex(targetIndex);
    window.requestAnimationFrame(() => {
      const viewport = carouselRef.current;
      const target = viewport?.querySelector<HTMLElement>(
        `[data-ticket-slide-index="${targetIndex}"]`,
      );
      if (!viewport || !target) return;

      const targetLeft =
        target.offsetLeft - (viewport.clientWidth - target.offsetWidth) / 2;
      viewport.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: "smooth",
      });
    });
  }, [focusRequest, ticketItems]);

  useEffect(() => {
    setActiveIndex((current) =>
      Math.min(current, Math.max(carouselItemCount - 1, 0)),
    );
    carouselRef.current?.scrollTo({ left: 0, behavior: "auto" });

    return () => {
      if (snapTimerRef.current !== null) {
        window.clearTimeout(snapTimerRef.current);
      }
    };
  }, [carouselItemCount]);

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

  const currentSlideIndex = (viewport: HTMLDivElement) =>
    closestSlide(viewport)?.index ?? activeIndex;

  const snapToClosestSlide = (
    viewport = carouselRef.current,
    behavior: ScrollBehavior = "smooth",
  ) => {
    if (!viewport || carouselItemCount === 0) return;

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
    if (!viewport || carouselItemCount === 0) return;

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
    if (carouselItemCount === 0) return;

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
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-drag-scroll-ignore]")) {
      return;
    }

    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }

    dragState.current = {
      active: true,
      interacting: true,
      moved: false,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      startIndex: currentSlideIndex(event.currentTarget),
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
    const threshold = 22;
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
    const tappedItem = Number.isInteger(tappedIndex)
      ? ticketItems[tappedIndex]
      : null;
    dragState.current.active = false;
    dragState.current.interacting = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (
      !dragState.current.moved &&
      Math.abs(dragDistance) <= 8 &&
      tappedItem?.kind === "blind-date"
    ) {
      onOpenBlindDate(tappedItem.offer.id);
      return;
    }

    if (
      !dragState.current.moved &&
      Math.abs(dragDistance) <= 8 &&
      tappedItem?.kind === "stored-ticket"
    ) {
      setSelectedTicket(tappedItem.userTicket);
      return;
    }

    if (
      !dragState.current.moved &&
      Math.abs(dragDistance) <= 8 &&
      tappedItem?.kind === "date-application" &&
      tappedItem.ticket
    ) {
      setSelectedApplicationTicketDeclined(false);
      setSelectedApplicationTicketOpen(false);
      setSelectedApplicationTicket(tappedItem.ticket);
      return;
    }

    if (
      !dragState.current.moved &&
      Math.abs(dragDistance) <= 8 &&
      tappedItem?.kind === "interaction-ticket"
    ) {
      setSelectedApplicationTicketDeclined(
        tappedItem.interaction.status === "no",
      );
      setSelectedApplicationTicketOpen(
        ticketInteractionCanRespond(tappedItem.interaction),
      );
      setSelectedApplicationTicket(tappedItem.interaction.ticket);
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

  const startTouchScroll = (event: React.TouchEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-drag-scroll-ignore]")) {
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;

    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }

    dragState.current = {
      active: false,
      interacting: true,
      moved: false,
      startX: touch.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      startIndex: currentSlideIndex(event.currentTarget),
    };
  };

  const moveTouchScroll = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch || !dragState.current.interacting) return;

    if (Math.abs(touch.clientX - dragState.current.startX) > 8) {
      dragState.current.moved = true;
    }
  };

  const finishTouchScroll = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!dragState.current.interacting) return;

    const touch = event.changedTouches[0];
    const dragDistance = touch ? touch.clientX - dragState.current.startX : 0;
    const moved = dragState.current.moved;
    dragState.current.interacting = false;

    if (moved) {
      if (Math.abs(dragDistance) > 54) {
        snapToSlideIndex(
          dragState.current.startIndex + (dragDistance < 0 ? 1 : -1),
          event.currentTarget,
        );
      } else {
        snapToClosestSlide(event.currentTarget);
      }

      window.setTimeout(() => {
        dragState.current.moved = false;
      }, 180);
    }
  };

  const openStoredTicket = (ticket: UserTicket) => {
    if (dragState.current.moved) return;
    setSelectedTicket(ticket);
  };

  const openDeclinedReview = async () => {
    setDeclinedViewOpen(true);
    setDeclinedLoading(true);
    setDeclinedError(null);
    const locallyDeclined = availableTickets.filter(
      (ticket) => ticket.rejected,
    );

    try {
      const response = await fetch(
        "/api/meetings/available-tickets?view=declined",
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => null)) as {
        tickets?: GatheringTicket[];
        error?: string;
      } | null;
      if (!response.ok || !data) {
        throw new Error(data?.error ?? "declined-tickets-load-failed");
      }
      const mergedTickets = new Map(
        [...locallyDeclined, ...(data.tickets ?? [])].map((ticket) => [
          ticket.id,
          ticket,
        ]),
      );
      setDeclinedTickets(Array.from(mergedTickets.values()));
    } catch (loadError) {
      setDeclinedError(
        loadError instanceof Error &&
          loadError.message !== "declined-tickets-load-failed"
          ? loadError.message
          : "거절한 티켓을 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setDeclinedLoading(false);
    }
  };

  return (
    <TabMotion>
      <AnimatePresence mode="wait" initial={false}>
        {selectedTicket ? (
          <StoredTicketDetailView
            key={`stored-ticket-detail-${selectedTicket.id}`}
            userTicket={selectedTicket}
            participantPhotoUrl={participantPhotoUrl}
            previewMatchPhotoUrls={previewMatchPhotoUrls}
            previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
            onClose={() => setSelectedTicket(null)}
            onCancelApplication={
              !readOnly && selectedTicketApplication
                ? async () => {
                    const cancelled = await onCancelApplication(
                      selectedTicketApplication,
                      selectedTicket.ticket,
                    );
                    if (cancelled) setSelectedTicket(null);
                    return cancelled;
                  }
                : undefined
            }
          />
        ) : selectedApplicationTicket ? (
          <AssignedApplicationTicketDetailView
            key={`assigned-application-ticket-${selectedApplicationTicket.id}`}
            ticket={selectedApplicationTicket}
            participantPhotoUrl={participantPhotoUrl}
            previewMatchPhotoUrls={previewMatchPhotoUrls}
            previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
            onClose={() => {
              setSelectedApplicationTicket(null);
              setSelectedApplicationTicketDeclined(false);
              setSelectedApplicationTicketOpen(false);
            }}
            onCancelApplication={
              !readOnly && selectedApplicationDetailApplication
                ? async () => {
                    const cancelled = await onCancelApplication(
                      selectedApplicationDetailApplication,
                      selectedApplicationTicket,
                    );
                    if (cancelled) {
                      setSelectedApplicationTicket(null);
                      setSelectedApplicationTicketDeclined(false);
                      setSelectedApplicationTicketOpen(false);
                    }
                    return cancelled;
                  }
                : undefined
            }
            onReapply={
              !readOnly && selectedApplicationTicketDeclined
                ? () => {
                    const ticket = selectedApplicationTicket;
                    setSelectedApplicationTicket(null);
                    setSelectedApplicationTicketDeclined(false);
                    setSelectedApplicationTicketOpen(false);
                    onReapplyTicket(ticket);
                  }
                : undefined
            }
            onAccept={
              !readOnly && selectedApplicationTicketOpen
                ? () => {
                    const ticket = selectedApplicationTicket;
                    setSelectedApplicationTicket(null);
                    setSelectedApplicationTicketOpen(false);
                    onReapplyTicket(ticket);
                  }
                : undefined
            }
            onDecline={
              !readOnly && selectedApplicationTicketOpen
                ? async () => {
                    const declined = await onDeclineTicket(
                      selectedApplicationTicket,
                    );
                    if (!declined) return false;
                    setSelectedApplicationTicket(null);
                    setSelectedApplicationTicketOpen(false);
                    return true;
                  }
                : undefined
            }
          />
        ) : declinedViewOpen ? (
          <DeclinedTicketReview
            key="declined-ticket-review"
            tickets={declinedTickets}
            loading={declinedLoading}
            error={declinedError}
            onBack={() => setDeclinedViewOpen(false)}
            onOpen={(ticket) => {
              setSelectedApplicationTicketDeclined(true);
              setSelectedApplicationTicketOpen(false);
              setSelectedApplicationTicket(ticket);
            }}
          />
        ) : (
          <motion.section
            key="stored-ticket-list"
            aria-busy={loadingMore}
            exit={{ opacity: 0, y: -8 }}
            transition={ticketFadeTransition}
            className="flex h-full min-h-full flex-col overflow-hidden bg-transparent pb-2 pt-[calc(16px+env(safe-area-inset-top))] text-[#24211d]"
          >
            {initialLoading ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-5 pb-24 pt-4">
                <MatchingLoader message="티켓을 준비중이에요." />
              </div>
            ) : itemCount === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-5 pb-3 pt-4">
                <div className="relative flex aspect-[1/1.618] w-full max-w-[340px] flex-col justify-center bg-[#f8f4eb] px-7 py-10 text-center shadow-[0_24px_60px_rgba(39,34,24,0.09)] before:pointer-events-none before:absolute before:inset-0 before:border before:border-black/[0.11] after:pointer-events-none after:absolute after:inset-2 after:border after:border-black/[0.055]">
                  <div className="relative">
                    <TicketIcon
                      size={22}
                      strokeWidth={1.35}
                      className="mx-auto text-black/38"
                      aria-hidden
                    />
                    <h2 className="mt-6 text-[22px] font-bold leading-[1.34] tracking-[-0.045em] text-black">
                      신청 탭에서 나에게 온
                      <br />
                      초대장을 확인해보세요.
                    </h2>
                    <button
                      type="button"
                      onClick={onGoRecommend}
                      className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-black/[0.88] px-5 text-[13px] font-bold text-white transition hover:bg-black active:scale-[0.99]"
                    >
                      이번 주 초대 보러 가기
                      <ChevronRight size={16} aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col justify-center pb-3 pt-4">
                <div
                  ref={carouselRef}
                  onScroll={updateActiveSlide}
                  onPointerDown={startDesktopDrag}
                  onPointerMove={moveDesktopDrag}
                  onPointerUp={finishDesktopDrag}
                  onPointerCancel={finishDesktopDrag}
                  onTouchStart={startTouchScroll}
                  onTouchMove={moveTouchScroll}
                  onTouchEnd={finishTouchScroll}
                  onTouchCancel={finishTouchScroll}
                  style={{
                    scrollBehavior: "smooth",
                    WebkitOverflowScrolling: "touch",
                  }}
                  className="-my-10 flex shrink-0 cursor-grab snap-x snap-mandatory select-none gap-4 overflow-x-auto px-[11%] py-10 scrollbar-none overscroll-x-contain touch-pan-x active:cursor-grabbing"
                >
                  {ticketItems.map((item, index) => (
                    <div
                      key={item.id}
                      data-ticket-slide
                      data-ticket-slide-index={index}
                      className="w-[min(78vw,340px)] shrink-0 snap-center snap-always"
                    >
                      {item.kind === "stored-ticket" ? (
                        <StoredTicketCard
                          userTicket={item.userTicket}
                          onOpen={() => openStoredTicket(item.userTicket)}
                        />
                      ) : item.kind === "interaction-ticket" ? (
                        <InteractionTicketCard
                          interaction={item.interaction}
                          application={item.application}
                          onOpen={() => {
                            setSelectedApplicationTicketDeclined(
                              item.interaction.status === "no",
                            );
                            setSelectedApplicationTicketOpen(
                              ticketInteractionCanRespond(item.interaction),
                            );
                            setSelectedApplicationTicket(
                              item.interaction.ticket,
                            );
                          }}
                        />
                      ) : item.kind === "blind-date" ? (
                        <BlindDateTicketCard
                          offer={item.offer}
                          onOpen={() => onOpenBlindDate(item.offer.id)}
                        />
                      ) : (
                        <AssignedApplicationTicketCard
                          application={item.application}
                          ticket={item.ticket}
                          onOpen={() => {
                            setSelectedApplicationTicketDeclined(false);
                            setSelectedApplicationTicketOpen(false);
                            setSelectedApplicationTicket(item.ticket);
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {carouselItemCount > 1 && (
                  <div
                    className="mt-1.5 flex shrink-0 justify-center gap-1.5"
                    aria-label={`티켓 ${activeIndex + 1}/${carouselItemCount}`}
                  >
                    {Array.from({ length: carouselItemCount }, (_, index) => (
                      <span
                        key={`ticket-page-${index}`}
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

export function TabMotion({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="h-full min-h-full"
    >
      {children}
    </motion.div>
  );
}
export {
  AssignedApplicationTicketDetailView,
  DeclinedTicketReview,
} from "./TicketApplicationDetail";
export {
  AssignedApplicationTicketCard,
  BlindDateTicketCard,
  dateApplicationBadgeClass,
  DeclinedTicketCard,
  InteractionTicketCard,
  statusBadgeClass,
  StoredTicketCard,
  ticketPaperFrameClass,
  ticketPaperImageClass,
  ticketResponseDeadline,
  ticketResponseRemainingTime,
  UnansweredTicketCountdown,
} from "./TicketCards";

import { cn } from "@/lib/cn";
