import type {
  GatheringTicket,
  TicketInteraction,
  TicketInteractionStatus,
} from "@/types/ticket";

const guestTicketInteractionsStorageKey =
  "intersection:guest-ticket-interactions:v1";

const interactionStatuses = new Set<TicketInteractionStatus>([
  "open",
  "no",
  "yes",
  "payment_pending",
  "payment_confirmed",
]);

export function ticketInteractionStatusLabel(status: TicketInteractionStatus) {
  if (status === "open") return "OPEN";
  if (status === "no") return "NO";
  if (status === "yes") return "YES";
  if (status === "payment_pending") return "결제 확인 중";
  return "결제 확인 완료";
}

export function nextTicketInteractionStatus(
  current: TicketInteractionStatus | null | undefined,
  requested: TicketInteractionStatus,
) {
  if (current === "payment_confirmed") return current;
  if (current === "payment_pending" && requested !== "payment_confirmed") {
    return current;
  }
  if (requested === "open" && current) return current;
  return requested;
}

function isTicketInteraction(value: unknown): value is TicketInteraction {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<TicketInteraction>;
  return Boolean(
    row.ticket &&
      typeof row.ticket === "object" &&
      typeof row.ticket.id === "string" &&
      typeof row.status === "string" &&
      interactionStatuses.has(row.status as TicketInteractionStatus) &&
      typeof row.updatedAt === "string",
  );
}

export function loadGuestTicketInteractions() {
  if (typeof window === "undefined") return [] as TicketInteraction[];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(guestTicketInteractionsStorageKey) ?? "[]",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(isTicketInteraction)
      : [];
  } catch {
    return [];
  }
}

export function clearGuestTicketInteractions() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(guestTicketInteractionsStorageKey);
  } catch {
    // Guest interaction history is best-effort when storage is unavailable.
  }
}

export function saveGuestTicketInteraction(
  ticket: GatheringTicket,
  requestedStatus: TicketInteractionStatus,
) {
  const currentRows = loadGuestTicketInteractions();
  const current = currentRows.find((row) => row.ticket.id === ticket.id);
  const now = new Date().toISOString();
  const status = nextTicketInteractionStatus(current?.status, requestedStatus);
  const transitionApplied = status === requestedStatus;
  const next: TicketInteraction = {
    ticket,
    status,
    openedAt: current?.openedAt ?? now,
    respondedAt:
      transitionApplied &&
      (requestedStatus === "yes" || requestedStatus === "no")
        ? now
        : current?.respondedAt ?? null,
    paymentStartedAt:
      transitionApplied && requestedStatus === "payment_pending"
        ? now
        : current?.paymentStartedAt ?? null,
    paymentConfirmedAt:
      transitionApplied && requestedStatus === "payment_confirmed"
        ? now
        : current?.paymentConfirmedAt ?? null,
    updatedAt: now,
  };
  const rows = [
    ...currentRows.filter((row) => row.ticket.id !== ticket.id),
    next,
  ];
  try {
    window.localStorage.setItem(
      guestTicketInteractionsStorageKey,
      JSON.stringify(rows),
    );
  } catch {
    // The current screen can still reflect the interaction in memory.
  }
  return next;
}
