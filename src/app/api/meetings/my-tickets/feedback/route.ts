import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { GatheringTicket } from "@/types/ticket";

export const dynamic = "force-dynamic";

type PersonAxis = "temperature" | "texture" | "tone" | "rhythm";

type MemberFeedbackValue = {
  status?: "done" | "skipped";
} & Partial<Record<PersonAxis, number | null>>;

type FeedbackRequest = {
  waitlistId?: string;
  selectedMemberIds?: unknown;
  memberFeedback?: unknown;
  placeFeedback?: unknown;
};

type WaitlistRow = {
  id: number | string;
  user_id: string;
  status: string;
  ticket_id: string;
  ticket_template_id: string | null;
  ticket_instance_id: string | null;
  ticket_snapshot:
    | (GatheringTicket & { feedbackPreviewSourceInstanceId?: string | null })
    | null;
};

type InstanceRow = {
  id: string;
  template_id: string | null;
  event_date: string | null;
  event_time: string | null;
};

type AssignmentRow = {
  user_id: string;
};

const personAxes: PersonAxis[] = ["temperature", "texture", "tone", "rhythm"];
const allowedPersonScores = new Set([-100, -50, 0, 50, 100]);
function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim(),
    )
  );
}

function toStartAt(date: string | null | undefined, time: string | null | undefined) {
  if (!date) return null;
  const normalizedTime = time?.slice(0, 5) || "00:00";
  const start = new Date(`${date}T${normalizedTime}:00+09:00`);
  return Number.isFinite(start.getTime()) ? start : null;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function feedbackVenueGroup(code: string | null, title: string | null) {
  const match = `${title ?? ""} ${code ?? ""}`.match(
    /(?:^|\D)(\d+)\s*(?:그룹|$)/,
  );
  if (!match) return null;
  const groupNumber = Number(match[1]);
  return groupNumber <= 3 || groupNumber === 7 ? "123" : "456";
}

function normalizeSelectedMemberIds(value: unknown) {
  if (!Array.isArray(value)) return null;
  const ids = value.filter(isUuid);
  return ids.length === value.length ? Array.from(new Set(ids)) : null;
}

function normalizeMemberFeedback(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const result: Record<string, MemberFeedbackValue> = {};
  for (const [memberId, rawFeedback] of Object.entries(value)) {
    if (!isUuid(memberId)) return null;
    if (!rawFeedback || typeof rawFeedback !== "object" || Array.isArray(rawFeedback)) {
      return null;
    }

    const entry = rawFeedback as Record<string, unknown>;
    const normalized: MemberFeedbackValue = {
      status: entry.status === "done" ? "done" : "skipped",
    };

    for (const axis of personAxes) {
      const score = entry[axis];
      if (score === null || score === undefined) {
        normalized[axis] = null;
        continue;
      }

      if (
        typeof score !== "number" ||
        !Number.isInteger(score) ||
        !allowedPersonScores.has(score)
      ) {
        return null;
      }
      normalized[axis] = score;
    }

    result[memberId] = normalized;
  }

  return result;
}

function isMeetingRating(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

function normalizePlaceFeedback(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const placeRatings = raw.place_ratings;
  if (!placeRatings || typeof placeRatings !== "object" || Array.isArray(placeRatings)) {
    return null;
  }

  const ratings = placeRatings as Record<string, unknown>;
  const normalizePlaceRating = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const entry = value as Record<string, unknown>;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    return name && name.length <= 200 && isMeetingRating(entry.rating)
      ? { name, rating: entry.rating }
      : null;
  };
  const first = ratings.first == null ? null : normalizePlaceRating(ratings.first);
  const second = normalizePlaceRating(ratings.second);
  const dinnerMemberIds = normalizeSelectedMemberIds(raw.dinner_member_ids);
  const overallMemberIds = normalizeSelectedMemberIds(raw.overall_member_ids);
  const disruptiveMemberNote =
    raw.disruptive_member_note === null || raw.disruptive_member_note === undefined
      ? null
      : typeof raw.disruptive_member_note === "string"
        ? raw.disruptive_member_note.trim() || null
        : undefined;

  if (
    !second ||
    !dinnerMemberIds ||
    !overallMemberIds ||
    overallMemberIds.length > 3 ||
    disruptiveMemberNote === undefined ||
    (disruptiveMemberNote?.length ?? 0) > 500
  ) {
    return null;
  }

  return {
    place_ratings: { first, second },
    dinner_member_ids: dinnerMemberIds,
    overall_member_ids: overallMemberIds,
    disruptive_member_note: disruptiveMemberNote,
  };
}

function feedbackTargetIds(placeFeedback: Record<string, unknown>) {
  return [
    ...(Array.isArray(placeFeedback.dinner_member_ids)
      ? placeFeedback.dinner_member_ids.filter(isUuid)
      : []),
    ...(Array.isArray(placeFeedback.overall_member_ids)
      ? placeFeedback.overall_member_ids.filter(isUuid)
      : []),
  ];
}

export async function POST(request: Request) {
  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as FeedbackRequest | null;
  const waitlistId =
    typeof body?.waitlistId === "string" ? body.waitlistId.trim() : "";
  const selectedMemberIds = normalizeSelectedMemberIds(body?.selectedMemberIds);
  const memberFeedback = normalizeMemberFeedback(body?.memberFeedback);
  const placeFeedback = normalizePlaceFeedback(body?.placeFeedback);

  if (
    !waitlistId ||
    !selectedMemberIds ||
    !memberFeedback ||
    Object.keys(memberFeedback).length > 3 ||
    !placeFeedback
  ) {
    return NextResponse.json({ error: "Invalid feedback payload." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data: rowData, error: rowError } = await supabase
      .from("ticket_participations")
      .select(
        "id,user_id,status,ticket_id,ticket_template_id,ticket_instance_id,ticket_snapshot",
      )
      .eq("id", waitlistId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (rowError) throw rowError;

    const row = rowData as unknown as WaitlistRow | null;
    if (!row) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }

    if (row.status !== "approved") {
      return NextResponse.json(
        { error: "Feedback is only available for confirmed tickets." },
        { status: 400 },
      );
    }

    const instanceId = row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id;
    let instance: InstanceRow | null = null;
    if (isUuid(instanceId)) {
      const { data, error } = await supabase
        .from("ticket_instances")
        .select("id,template_id,event_date,event_time")
        .eq("id", instanceId)
        .maybeSingle();
      if (error) throw error;
      instance = data as unknown as InstanceRow | null;
    }

    const startAt = toStartAt(
      instance?.event_date ?? row.ticket_snapshot?.date,
      instance?.event_time ?? row.ticket_snapshot?.time,
    );
    if (startAt) {
      const now = new Date();
      if (now < addHours(startAt, 3)) {
        return NextResponse.json(
          { error: "Feedback opens three hours after the meeting starts." },
          { status: 403 },
        );
      }
      if (now >= addHours(startAt, 27)) {
        return NextResponse.json(
          { error: "Feedback is closed for this meeting." },
          { status: 403 },
        );
      }
    }

    let assignedMemberIds: string[] = [];
    if (instance?.id) {
      const feedbackPreviewSourceInstanceId =
        row.ticket_snapshot?.feedbackPreviewSourceInstanceId?.trim() || null;
      const feedbackReferenceInstanceId =
        feedbackPreviewSourceInstanceId ?? instance.id;
      let feedbackInstanceIds = [feedbackReferenceInstanceId];
      const { data: currentGroup, error: currentGroupError } = await supabase
        .from("meeting_groups")
        .select("event_id,code,title")
        .eq("legacy_ticket_instance_id", feedbackReferenceInstanceId)
        .maybeSingle<{ event_id: string; code: string; title: string }>();
      if (currentGroupError) throw currentGroupError;
      if (currentGroup?.event_id) {
        const { data: eventGroups, error: eventGroupsError } = await supabase
          .from("meeting_groups")
          .select("code,title,legacy_ticket_instance_id")
          .eq("event_id", currentGroup.event_id)
          .not("legacy_ticket_instance_id", "is", null)
          .returns<
            Array<{
              code: string;
              title: string;
              legacy_ticket_instance_id: string | null;
            }>
          >();
        if (eventGroupsError) throw eventGroupsError;
        const viewerVenueGroup = feedbackVenueGroup(
          currentGroup.code,
          currentGroup.title,
        );
        feedbackInstanceIds = Array.from(
          new Set(
            (eventGroups ?? [])
              .filter(
                (group) =>
                  !viewerVenueGroup ||
                  feedbackVenueGroup(group.code, group.title) === viewerVenueGroup,
              )
              .map((group) => group.legacy_ticket_instance_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );
      }

      const { data, error } = await supabase
        .from("ticket_participations")
        .select("user_id")
        .in("ticket_instance_id", feedbackInstanceIds)
        .in("status", ["approved", "completed", "feedback_done"])
        .returns<AssignmentRow[]>();
      if (error) throw error;
      assignedMemberIds = (data ?? []).map((assignment) => assignment.user_id);

      if (!feedbackPreviewSourceInstanceId && !assignedMemberIds.includes(user.id)) {
        return NextResponse.json(
          { error: "Feedback is only available for assigned members." },
          { status: 403 },
        );
      }
    }

    const allowedTargetIds = new Set(
      assignedMemberIds.filter((memberId) => memberId !== user.id),
    );
    const allSubmittedMemberIds = new Set([
      ...selectedMemberIds,
      ...Object.keys(memberFeedback),
      ...feedbackTargetIds(placeFeedback),
    ]);
    for (const memberId of allSubmittedMemberIds) {
      if (!allowedTargetIds.has(memberId)) {
        return NextResponse.json(
          { error: "Feedback target is not part of this meeting." },
          { status: 400 },
        );
      }
    }

    const now = new Date().toISOString();
    const { error: feedbackError } = await supabase
      .from("meeting_feedback")
      .upsert(
        {
          waitlist_id: row.id,
          user_id: user.id,
          ticket_instance_id: instance?.id ?? null,
          ticket_template_id:
            row.ticket_template_id ?? instance?.template_id ?? row.ticket_snapshot?.templateId ?? null,
          ticket_snapshot: row.ticket_snapshot ?? {},
          selected_member_ids: selectedMemberIds,
          member_feedback: memberFeedback,
          place_feedback: placeFeedback,
          updated_at: now,
        },
        { onConflict: "waitlist_id" },
      );
    if (feedbackError) throw feedbackError;

    const { error: updateError } = await supabase
      .from("ticket_participations")
      .update({
        status: "feedback_done",
        feedback_completed_at: now,
        updated_at: now,
      })
      .eq("id", waitlistId)
      .eq("user_id", user.id);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, feedbackCompletedAt: now });
  } catch (error) {
    console.error("[meetings my-tickets feedback]", error);
    return NextResponse.json(
      { error: "Feedback could not be saved." },
      { status: 500 },
    );
  }
}
