import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { GatheringTicket } from "@/types/ticket";

export const dynamic = "force-dynamic";

type PersonAxis = "temperature" | "texture" | "tone" | "rhythm";
type PlaceAxis =
  | PersonAxis
  | "alcohol"
  | "romance";

type NegativeFeedbackReason =
  | "no_show"
  | "not_my_vibe"
  | "uncomfortable_conversation"
  | "rude_or_aggressive"
  | "romantic_pressure"
  | "religion_or_sales"
  | "other";

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
  ticket_snapshot: GatheringTicket | null;
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
const placeAxes: PlaceAxis[] = [
  "temperature",
  "texture",
  "tone",
  "rhythm",
  "alcohol",
  "romance",
];
const allowedPersonScores = new Set([-100, -50, 0, 50, 100]);
const allowedNegativeFeedbackReasons = new Set<NegativeFeedbackReason>([
  "no_show",
  "not_my_vibe",
  "uncomfortable_conversation",
  "rude_or_aggressive",
  "romantic_pressure",
  "religion_or_sales",
  "other",
]);

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

function normalizeNegativeMemberFeedback(value: unknown) {
  if (value === null || value === undefined) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;

  const result: Record<
    string,
    { reasons: NegativeFeedbackReason[]; otherText: string | null }
  > = {};

  for (const [memberId, rawFeedback] of Object.entries(value)) {
    if (!isUuid(memberId)) return null;
    if (!rawFeedback || typeof rawFeedback !== "object" || Array.isArray(rawFeedback)) {
      return null;
    }

    const entry = rawFeedback as Record<string, unknown>;
    if (!Array.isArray(entry.reasons)) return null;

    const reasons = Array.from(new Set(entry.reasons));
    if (
      reasons.length === 0 ||
      !reasons.every(
        (reason): reason is NegativeFeedbackReason =>
          typeof reason === "string" &&
          allowedNegativeFeedbackReasons.has(reason as NegativeFeedbackReason),
      )
    ) {
      return null;
    }

    const otherTextRaw = entry.otherText ?? entry.other_text;
    const otherText =
      typeof otherTextRaw === "string" ? otherTextRaw.trim() : "";
    if (reasons.includes("other") && !otherText) return null;

    result[memberId] = {
      reasons,
      otherText: otherText || null,
    };
  }

  return result;
}

function normalizePlaceFeedback(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const meetingRatings = raw.meeting_ratings;
  if (
    meetingRatings &&
    typeof meetingRatings === "object" &&
    !Array.isArray(meetingRatings)
  ) {
    const ratingRaw = meetingRatings as Record<string, unknown>;
    const overall = ratingRaw.overall;
    const expectationMatch = ratingRaw.expectation_match;
    const negativeMemberFeedback = normalizeNegativeMemberFeedback(
      raw.negative_member_feedback ?? {},
    );

    if (
      !isMeetingRating(overall) ||
      !isMeetingRating(expectationMatch) ||
      !negativeMemberFeedback
    ) {
      return null;
    }

    return {
      meeting_ratings: {
        overall,
        expectation_match: expectationMatch,
      },
      negative_member_feedback: negativeMemberFeedback,
    };
  }

  const result: Partial<Record<PlaceAxis, number>> = {};
  for (const axis of placeAxes) {
    const score = raw[axis];
    if (
      typeof score !== "number" ||
      !Number.isInteger(score) ||
      score < 1 ||
      score > 5
    ) {
      return null;
    }
    result[axis] = score;
  }
  return result;
}

function negativeFeedbackTargetIds(placeFeedback: Record<string, unknown>) {
  const negativeMemberFeedback = placeFeedback.negative_member_feedback;
  if (
    !negativeMemberFeedback ||
    typeof negativeMemberFeedback !== "object" ||
    Array.isArray(negativeMemberFeedback)
  ) {
    return [];
  }

  return Object.keys(negativeMemberFeedback);
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

  if (!waitlistId || !selectedMemberIds || !memberFeedback || !placeFeedback) {
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
      const { data, error } = await supabase
        .from("ticket_participations")
        .select("user_id")
        .eq("ticket_instance_id", instance.id)
        .in("status", ["approved", "completed", "feedback_done"])
        .returns<AssignmentRow[]>();
      if (error) throw error;
      assignedMemberIds = (data ?? []).map((assignment) => assignment.user_id);

      if (!assignedMemberIds.includes(user.id)) {
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
      ...negativeFeedbackTargetIds(placeFeedback),
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
