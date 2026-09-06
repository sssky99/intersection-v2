import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  isAdminSessionTokenValid,
} from "@/lib/adminAuth";
import { blindDateSelectableDatesFrom } from "@/lib/blindDateDates";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BlindDateAdminOffer,
  BlindDateAdminProfile,
  BlindDateOfferStatus,
  BlindDateResponseStatus,
  BlindDateSourceType,
  BlindDateTemplate,
} from "@/types/blindDate";

export const dynamic = "force-dynamic";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

const profilePageSize = 1000;

type BlindDateOfferRow = {
  id: string;
  status: BlindDateOfferStatus;
  source_type: BlindDateSourceType;
  participant_a_id: string;
  participant_b_id: string;
  template_id: string | null;
  time_label: string;
  region: string;
  actual_place_name: string | null;
  actual_place_address: string | null;
  reservation_name: string | null;
  candidate_dates: unknown;
  a_response: BlindDateResponseStatus;
  b_response: BlindDateResponseStatus;
  a_available_dates: unknown;
  b_available_dates: unknown;
  scheduled_date: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  feedback_a_id: string | null;
  feedback_b_id: string | null;
  ticket_instance_id: string | null;
  ticket_template_id: string | null;
};

const adminOfferStatuses: BlindDateOfferStatus[] = [
  "pending_admin",
  "offered",
  "waiting_response",
  "scheduled",
  "needs_reschedule",
  "declined",
  "expired",
  "cancelled",
  "completed",
];

const templateSelect = [
  "id",
  "title",
  "image_url",
  "short_description",
  "time_label",
  "region",
  "actual_place_name",
  "actual_place_address",
  "guide_text",
  "stage_copy",
  "active",
  "deleted_at",
  "created_at",
  "updated_at",
].join(",");

const offerSelect = [
  "id",
  "status",
  "source_type",
  "participant_a_id",
  "participant_b_id",
  "template_id",
  "time_label",
  "region",
  "actual_place_name",
  "actual_place_address",
  "reservation_name",
  "candidate_dates",
  "a_response",
  "b_response",
  "a_available_dates",
  "b_available_dates",
  "scheduled_date",
  "expires_at",
  "created_at",
  "updated_at",
  "feedback_a_id",
  "feedback_b_id",
  "ticket_instance_id",
  "ticket_template_id",
].join(",");

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

function unauthorized() {
  return NextResponse.json(
    { error: "관리자 인증이 필요합니다." },
    { status: 401 },
  );
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function uuid(value: unknown) {
  const candidate = text(value);
  return candidate && uuidPattern.test(candidate) ? candidate : null;
}

function dateList(value: unknown) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\s,]+/)
      : [];

  const values = rawItems
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))
    .filter((item) =>
      Number.isFinite(new Date(`${item}T00:00:00+09:00`).getTime()),
    );

  return Array.from(new Set(values)).sort();
}

function datesFromDb(value: unknown) {
  return dateList(value);
}

function defaultExpiresAt() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

function validExpiresAt(value: unknown) {
  const candidate = text(value);
  if (!candidate) return defaultExpiresAt();
  const date = new Date(candidate);
  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : defaultExpiresAt();
}

function normalizeOffer(
  row: BlindDateOfferRow,
  profileMap: Map<string, BlindDateAdminProfile>,
  templateMap: Map<string, BlindDateTemplate>,
): BlindDateAdminOffer {
  return {
    id: row.id,
    status: row.status,
    source_type: row.source_type,
    participant_a_id: row.participant_a_id,
    participant_b_id: row.participant_b_id,
    template_id: row.template_id,
    time_label: row.time_label,
    region: row.region,
    actual_place_name: row.actual_place_name,
    actual_place_address: row.actual_place_address,
    reservation_name: row.reservation_name,
    candidate_dates: datesFromDb(row.candidate_dates).length
      ? datesFromDb(row.candidate_dates)
      : blindDateSelectableDatesFrom(row.created_at),
    a_response: row.a_response,
    b_response: row.b_response,
    a_available_dates: datesFromDb(row.a_available_dates),
    b_available_dates: datesFromDb(row.b_available_dates),
    scheduled_date: row.scheduled_date,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    participantA: profileMap.get(row.participant_a_id) ?? null,
    participantB: profileMap.get(row.participant_b_id) ?? null,
    template: row.template_id
      ? (templateMap.get(row.template_id) ?? null)
      : null,
    is_test: row.source_type === "test",
  };
}

async function expireOldOffers(supabase: SupabaseAdminClient) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("blind_date_offers")
    .update({
      status: "expired",
      expired_at: now,
      updated_at: now,
    })
    .lt("expires_at", now)
    .in("status", ["pending_admin", "offered", "waiting_response"])
    .or("a_response.eq.pending,b_response.eq.pending");

  if (error) throw error;
}

async function loadAllProfiles(supabase: SupabaseAdminClient) {
  const profiles: BlindDateAdminProfile[] = [];

  for (let from = 0; ; from += profilePageSize) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,name,nickname,phone,is_test_participant")
      .order("name")
      .order("user_id")
      .range(from, from + profilePageSize - 1)
      .returns<BlindDateAdminProfile[]>();

    if (error) throw error;

    const page = data ?? [];
    profiles.push(...page);
    if (page.length < profilePageSize) return profiles;
  }
}

async function loadData(supabase: SupabaseAdminClient) {
  await expireOldOffers(supabase);
  const [templatesResult, offersResult, profiles] = await Promise.all([
    supabase
      .from("blind_date_templates")
      .select(templateSelect)
      .returns<BlindDateTemplate[]>(),
    supabase
      .from("blind_date_offers")
      .select(offerSelect)
      .order("created_at", { ascending: false })
      .returns<BlindDateOfferRow[]>(),
    loadAllProfiles(supabase),
  ]);
  if (templatesResult.error) throw templatesResult.error;
  if (offersResult.error) throw offersResult.error;
  const profileMap = new Map(
    profiles.map((profile) => [profile.user_id, profile]),
  );
  const templateMap = new Map(
    (templatesResult.data ?? []).map((template) => [template.id, template]),
  );
  return {
    offers: (offersResult.data ?? []).map((offer) =>
      normalizeOffer(offer, profileMap, templateMap),
    ),
    profiles,
  };
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const supabase = createAdminClient();
    return NextResponse.json(await loadData(supabase));
  } catch (error) {
    console.error("[admin blind dates GET]", error);
    return NextResponse.json(
      { error: "블라인드 데이트 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const action = body?.action;

  try {
    const supabase = createAdminClient();

    if (action === "create_offer") {
      const participantAId = uuid(body?.participantAId);
      const participantBId = uuid(body?.participantBId);

      const createdAt = new Date();
      const candidateDates = blindDateSelectableDatesFrom(createdAt);

      if (
        !participantAId ||
        !participantBId ||
        participantAId === participantBId
      ) {
        return NextResponse.json(
          { error: "서로 다른 참가자 2명을 선택해주세요." },
          { status: 400 },
        );
      }
      const { error } = await supabase.from("blind_date_offers").insert({
        template_id: null,
        participant_a_id: participantAId,
        participant_b_id: participantBId,
        source_type: "test",
        status: "offered",
        time_label: text(body?.timeLabel) ?? "저녁 7시",
        region: text(body?.region) ?? "지역 미정",
        actual_place_name: text(body?.actualPlaceName),
        actual_place_address: text(body?.actualPlaceAddress),
        reservation_name: text(body?.reservationName),
        candidate_dates: candidateDates,
        expires_at: validExpiresAt(body?.expiresAt),
        created_at: createdAt.toISOString(),
      });
      if (error) throw error;

      return NextResponse.json(await loadData(supabase));
    }

    return NextResponse.json(
      { error: "지원하지 않는 작업입니다." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[admin blind dates POST]", { action, error });
    return NextResponse.json(
      { error: "블라인드 데이트 작업을 처리하지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const entity = body?.entity;
  const id = uuid(body?.id);

  if (!id) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    if (entity === "offer") {
      const status = text(body?.status);
      const resetParticipant =
        body?.resetParticipant === "a" || body?.resetParticipant === "b"
          ? body.resetParticipant
          : null;
      const hasPlaceUpdate =
        Object.prototype.hasOwnProperty.call(body ?? {}, "actualPlaceName") ||
        Object.prototype.hasOwnProperty.call(
          body ?? {},
          "actualPlaceAddress",
        ) ||
        Object.prototype.hasOwnProperty.call(body ?? {}, "reservationName") ||
        Object.prototype.hasOwnProperty.call(body ?? {}, "scheduledDate");
      if (
        status &&
        !adminOfferStatuses.includes(status as BlindDateOfferStatus)
      ) {
        return NextResponse.json(
          { error: "상태 값이 올바르지 않습니다." },
          { status: 400 },
        );
      }
      if (!status && !hasPlaceUpdate && !resetParticipant) {
        return NextResponse.json(
          { error: "변경할 제안 정보가 없습니다." },
          { status: 400 },
        );
      }

      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {
        updated_at: now,
      };
      if (status) {
        updates.status = status;
        if (status === "cancelled") updates.cancelled_at = now;
        if (status === "completed") updates.completed_at = now;
        if (status === "expired") updates.expired_at = now;
      }
      if (resetParticipant) {
        updates.status = "waiting_response";
        updates[`${resetParticipant}_response`] = "pending";
        updates[`${resetParticipant}_available_dates`] = [];
        updates.scheduled_date = null;
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "actualPlaceName")) {
        updates.actual_place_name = text(body?.actualPlaceName);
      }
      if (
        Object.prototype.hasOwnProperty.call(body ?? {}, "actualPlaceAddress")
      ) {
        updates.actual_place_address = text(body?.actualPlaceAddress);
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "reservationName")) {
        updates.reservation_name = text(body?.reservationName);
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "scheduledDate")) {
        const scheduledDate = dateList(body?.scheduledDate)[0] ?? null;
        updates.scheduled_date = scheduledDate;
        updates.scheduled_at = scheduledDate ? now : null;
        if (scheduledDate && !status) updates.status = "scheduled";
      }

      const { error } = await supabase
        .from("blind_date_offers")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    } else {
      return NextResponse.json(
        { error: "지원하지 않는 작업입니다." },
        { status: 400 },
      );
    }

    return NextResponse.json(await loadData(supabase));
  } catch (error) {
    console.error("[admin blind dates PATCH]", { entity, id, error });
    return NextResponse.json(
      { error: "블라인드 데이트 정보를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
