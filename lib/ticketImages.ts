import type { GatheringTicket, TicketCourseStep } from "@/types/ticket";

type TicketImageValue = string | null | undefined;

export function uniqueTicketImageUrls(
  imageUrls: ReadonlyArray<TicketImageValue>,
) {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const imageUrl of imageUrls) {
    const url = imageUrl?.trim();
    if (!url || seen.has(url)) continue;

    seen.add(url);
    urls.push(url);
  }

  return urls;
}

export function ticketCourseStepImageUrls(
  courseSteps?: ReadonlyArray<TicketCourseStep> | null,
) {
  return uniqueTicketImageUrls(
    (courseSteps ?? []).map((step) => step.imageUrl),
  );
}

export function ticketBackgroundImageUrls(
  ticket: Pick<GatheringTicket, "imageUrl" | "courseSteps">,
) {
  return uniqueTicketImageUrls([
    ticket.imageUrl,
    ...ticketCourseStepImageUrls(ticket.courseSteps),
  ]);
}
