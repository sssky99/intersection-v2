import type { TicketRatingAnswer } from "@/types/question";

export const ticketRatingOptions = [
  { value: "1", label: "별로 끌리지 않아요" },
  { value: "2", label: "조금 애매해요" },
  { value: "3", label: "괜찮을 것 같아요" },
  { value: "4", label: "꽤 좋아요" },
  { value: "5", label: "너무 좋아요" },
] as const;

export function parseTicketRatingAnswer(
  value: string | null | undefined,
): TicketRatingAnswer | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as TicketRatingAnswer).ticket_id === "string" &&
      typeof (parsed as TicketRatingAnswer).rating === "string" &&
      typeof (parsed as TicketRatingAnswer).title === "string" &&
      Array.isArray((parsed as TicketRatingAnswer).signal_tags)
    ) {
      return parsed as TicketRatingAnswer;
    }
  } catch {
    return null;
  }

  return null;
}
