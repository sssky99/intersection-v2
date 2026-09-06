import { normalizeMeetingPlace, ticketPlaceFromLegacyFields } from "./placePayload";
import type { GatheringTicket } from "@/types/ticket";

export type OperationalStage = {
  id: string; event_id: string; sequence: number; title: string | null;
  stage_type: string; starts_at: string | null;
  location_mode: "shared" | "group_specific" | "hidden";
  place_name: string | null; address: string | null; place_payload: unknown;
};
export type GroupStageLocation = { group_id: string; stage_id: string; place_name: string | null; address: string | null; place_payload: unknown };
export type GroupStageLocationOverride = {
  sequence: number; title: string | null; stageType: string;
  openOffsetMinutes?: number; hidden: boolean;
  placeName: string | null; address: string | null; place: GatheringTicket["place"];
};

export function scheduleOffsetMinutes(start: string, time: string | null) {
  const minutes = (value: string) => {
    const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const base = minutes(start), target = time ? minutes(time) : null;
  return base === null || target === null ? undefined : (target - base + 1440) % 1440;
}

export function resolveOperationalStage(stage: OperationalStage, start: string, location?: GroupStageLocation): GroupStageLocationOverride {
  const place = stage.location_mode === "shared" ? stage : stage.location_mode === "group_specific" ? location : undefined;
  return {
    sequence: stage.sequence, title: stage.title, stageType: stage.stage_type,
    openOffsetMinutes: scheduleOffsetMinutes(start, stage.starts_at), hidden: stage.location_mode === "hidden",
    placeName: place?.place_name ?? null, address: place?.address ?? null,
    place: ticketPlaceFromLegacyFields({ placeName: place?.place_name, address: place?.address, place: normalizeMeetingPlace(place?.place_payload) }),
  };
}

export function meetingFeedbackWindow(startAt: Date, stages: GroupStageLocationOverride[] = []) {
  const minutes = stages.find((stage) => stage.stageType === "feedback")?.openOffsetMinutes ?? 180;
  const opensAt = new Date(startAt.getTime() + minutes * 60_000);
  return { opensAt, closesAt: new Date(opensAt.getTime() + 24 * 60 * 60_000) };
}
