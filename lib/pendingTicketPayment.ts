import type { GatheringTicket } from "@/types/ticket";

const pendingTicketPaymentStorageKey =
  "intersection:pending-ticket-payment-return";
const pendingTicketPaymentMaxAgeMs = 12 * 60 * 60 * 1000;

type PendingTicketPayment = {
  userId: string;
  ticket: GatheringTicket;
  createdAt: number;
};

function isGatheringTicket(value: unknown): value is GatheringTicket {
  if (!value || typeof value !== "object") return false;

  const ticket = value as Partial<GatheringTicket>;
  return Boolean(
    ticket.id &&
      ticket.templateId &&
      ticket.title &&
      ticket.subtitle &&
      ticket.date &&
      ticket.time &&
      ticket.area &&
      Array.isArray(ticket.moodTags) &&
      ticket.peopleHint &&
      ticket.reason,
  );
}

export function rememberPendingTicketPayment(
  userId: string,
  ticket: GatheringTicket,
) {
  try {
    const value: PendingTicketPayment = {
      userId,
      ticket,
      createdAt: Date.now(),
    };
    window.sessionStorage.setItem(
      pendingTicketPaymentStorageKey,
      JSON.stringify(value),
    );
  } catch {
    // External payment navigation should continue even if storage is unavailable.
  }
}

export function takePendingTicketPayment(userId: string) {
  try {
    const raw = window.sessionStorage.getItem(pendingTicketPaymentStorageKey);
    if (!raw) return null;

    const value = JSON.parse(raw) as Partial<PendingTicketPayment>;
    window.sessionStorage.removeItem(pendingTicketPaymentStorageKey);

    if (
      value.userId !== userId ||
      typeof value.createdAt !== "number" ||
      Date.now() - value.createdAt > pendingTicketPaymentMaxAgeMs ||
      !isGatheringTicket(value.ticket)
    ) {
      return null;
    }

    return value.ticket;
  } catch {
    return null;
  }
}
