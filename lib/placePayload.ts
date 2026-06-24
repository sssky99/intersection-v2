import type { MeetingPlace, NaverPlace } from "@/types/place";
import type { TicketPlace } from "@/types/ticket";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown) {
  return text(value) || null;
}

function coordinate(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : NaN;
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

export function normalizeMeetingPlace(value: unknown): MeetingPlace | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  if (payload.source !== "naver") return null;

  const name = text(payload.name);
  const mapx = coordinate(payload.mapx);
  const mapy = coordinate(payload.mapy);
  if (!name || mapx === null || mapy === null) return null;

  const place: NaverPlace = {
    source: "naver",
    name,
    category: nullableText(payload.category),
    roadAddress: nullableText(payload.roadAddress),
    jibunAddress: nullableText(payload.jibunAddress),
    mapx,
    mapy,
    link: nullableText(payload.link),
  };

  return place;
}

export function meetingPlaceAddress(place: MeetingPlace | null | undefined) {
  return place?.roadAddress ?? place?.jibunAddress ?? null;
}

export function ticketPlaceFromMeetingPlace(
  place: MeetingPlace | null | undefined,
): TicketPlace | null {
  if (!place) return null;
  return {
    name: place.name,
    category: place.category,
    roadAddress: place.roadAddress,
    jibunAddress: place.jibunAddress,
    address: meetingPlaceAddress(place),
    mapx: place.mapx,
    mapy: place.mapy,
    link: place.link,
    source: place.source,
  };
}

export function ticketPlaceFromLegacyFields({
  placeName,
  address,
  place,
}: {
  placeName?: string | null;
  address?: string | null;
  place?: MeetingPlace | null;
}): TicketPlace | null {
  const naverPlace = ticketPlaceFromMeetingPlace(place);
  if (naverPlace) {
    return {
      ...naverPlace,
      name: naverPlace.name ?? placeName ?? null,
      address: naverPlace.address ?? address ?? null,
    };
  }

  const name = placeName?.trim() || null;
  const legacyAddress = address?.trim() || null;
  if (!name && !legacyAddress) return null;
  return {
    name,
    address: legacyAddress,
  };
}
