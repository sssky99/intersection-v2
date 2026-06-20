import { NextResponse } from "next/server";
import { blindDateSelectableDatesFrom } from "@/lib/blindDateDates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  BlindDateOfferStatus,
  BlindDatePublicTemplate,
  BlindDateResponseStatus,
  BlindDateStageCopy,
  BlindDateTemplate,
  BlindDateUserOffer,
} from "@/types/blindDate";

export const dynamic = "force-dynamic";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

type BlindDateOfferRow = {
  id: string;
  status: BlindDateOfferStatus;
  participant_a_id: string;
  participant_b_id: string;
  template_id: string | null;
  time_label: string;
  region: string;
  actual_place_name: string | null;
  actual_place_address: string | null;
  candidate_dates: unknown;
  a_response: BlindDateResponseStatus;
  b_response: BlindDateResponseStatus;
  a_available_dates: unknown;
  b_available_dates: unknown;
  scheduled_date: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

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
  "participant_a_id",
  "participant_b_id",
  "template_id",
  "time_label",
  "region",
  "actual_place_name",
  "actual_place_address",
  "candidate_dates",
  "a_response",
  "b_response",
  "a_available_dates",
  "b_available_dates",
  "scheduled_date",
  "expires_at",
  "created_at",
  "updated_at",
].join(",");

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
    .filter((item) => Number.isFinite(new Date(`${item}T00:00:00+09:00`).getTime()));

  return Array.from(new Set(values)).sort();
}

function copyText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stageCopy(value: unknown): BlindDateStageCopy {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  return {
    invite: copyText(source.invite),
    waiting: copyText(source.waiting),
    scheduled: copyText(source.scheduled),
    guidance: copyText(source.guidance),
    completed: copyText(source.completed),
  };
}

function publicTemplate(
  template: BlindDateTemplate | undefined,
  offer: BlindDateOfferRow,
): BlindDatePublicTemplate {
  return {
    id: template?.id ?? offer.template_id ?? "blind-date-template",
    title: template?.title ?? "블라인드 데이트",
    imageUrl: template?.image_url ?? null,
    shortDescription:
      template?.short_description ??
      "서로 다시 만나보고 싶다고 선택된 분과 단둘이 만나는 자리예요.",
    timeLabel: template?.time_label ?? offer.time_label,
    region: template?.region ?? offer.region,
    guideText:
      template?.guide_text ??
      "상대방은 현장에서 알 수 있어요. 정확한 장소는 운영진이 안내드릴게요.",
    stageCopy: stageCopy(template?.stage_copy),
  };
}

function isExpired(row: BlindDateOfferRow) {
  return (
    row.status === "expired" ||
    (["pending_admin", "offered", "waiting_response"].includes(row.status) &&
      new Date(row.expires_at).getTime() < Date.now())
  );
}

function sanitizeOffer(
  row: BlindDateOfferRow,
  userId: string,
  templateMap: Map<string, BlindDateTemplate>,
): BlindDateUserOffer {
  const isParticipantA = row.participant_a_id === userId;
  const ownResponse = isParticipantA ? row.a_response : row.b_response;
  const ownAvailableDates = isParticipantA
    ? dateList(row.a_available_dates)
    : dateList(row.b_available_dates);
  const template = row.template_id ? templateMap.get(row.template_id) : undefined;
  const storedCandidateDates = dateList(row.candidate_dates);
  const revealPlace = Boolean(row.scheduled_date) &&
    ["scheduled", "completed"].includes(row.status);

  return {
    id: row.id,
    status: row.status,
    template: publicTemplate(template, row),
    timeLabel: row.time_label,
    region: row.region,
    candidateDates: storedCandidateDates.length
      ? storedCandidateDates
      : blindDateSelectableDatesFrom(row.created_at),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    ownResponse,
    ownAvailableDates,
    scheduledDate: row.scheduled_date,
    actualPlaceName: revealPlace
      ? row.actual_place_name ?? template?.actual_place_name ?? null
      : null,
    actualPlaceAddress: revealPlace
      ? row.actual_place_address ?? template?.actual_place_address ?? null
      : null,
    isExpired: isExpired(row),
  };
}

function overlappingEarliestDate(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((date) => rightSet.has(date)).sort()[0] ?? null;
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
    .in("status", ["pending_admin", "offered", "waiting_response"]);

  if (error) throw error;
}

async function loadUserOffers(supabase: SupabaseAdminClient, userId: string) {
  await expireOldOffers(supabase);

  const { data: offersData, error: offersError } = await supabase
    .from("blind_date_offers")
    .select(offerSelect)
    .or(`participant_a_id.eq.${userId},participant_b_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .returns<BlindDateOfferRow[]>();
  if (offersError) throw offersError;

  const offers = offersData ?? [];
  const templateIds = Array.from(
    new Set(
      offers
        .map((offer) => offer.template_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const { data: templatesData, error: templatesError } = templateIds.length
    ? await supabase
        .from("blind_date_templates")
        .select(templateSelect)
        .in("id", templateIds)
        .returns<BlindDateTemplate[]>()
    : { data: [] as BlindDateTemplate[], error: null };
  if (templatesError) throw templatesError;

  const templateMap = new Map(
    (templatesData ?? []).map((template) => [template.id, template]),
  );
  return offers.map((offer) => sanitizeOffer(offer, userId, templateMap));
}

async function loadOfferForUser(
  supabase: SupabaseAdminClient,
  offerId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("blind_date_offers")
    .select(offerSelect)
    .eq("id", offerId)
    .or(`participant_a_id.eq.${userId},participant_b_id.eq.${userId}`)
    .maybeSingle<BlindDateOfferRow>();
  if (error) throw error;
  return data ?? null;
}

async function sanitizeSingleOffer(
  supabase: SupabaseAdminClient,
  offer: BlindDateOfferRow,
  userId: string,
) {
  const { data: templateData, error } = offer.template_id
    ? await supabase
        .from("blind_date_templates")
        .select(templateSelect)
        .eq("id", offer.template_id)
        .maybeSingle<BlindDateTemplate>()
    : { data: null, error: null };
  if (error) throw error;

  const templateMap = new Map<string, BlindDateTemplate>();
  if (templateData) templateMap.set(templateData.id, templateData);
  return sanitizeOffer(offer, userId, templateMap);
}

export async function GET() {
  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    return NextResponse.json({ offers: await loadUserOffers(supabase, user.id) });
  } catch (error) {
    console.error("[meetings blind dates GET]", error);
    return NextResponse.json(
      { error: "블라인드 데이트 초대장을 불러오지 못했어요." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    offerId?: unknown;
    action?: unknown;
    availableDates?: unknown;
  } | null;
  const offerId = typeof body?.offerId === "string" ? body.offerId.trim() : "";
  const action = body?.action;

  if (!offerId || (action !== "yes" && action !== "no")) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    await expireOldOffers(supabase);

    const offer = await loadOfferForUser(supabase, offerId, user.id);
    if (!offer) {
      return NextResponse.json(
        { error: "초대장을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (isExpired(offer)) {
      const now = new Date().toISOString();
      const { data: expiredOffer, error } = await supabase
        .from("blind_date_offers")
        .update({ status: "expired", expired_at: now, updated_at: now })
        .eq("id", offer.id)
        .select(offerSelect)
        .single<BlindDateOfferRow>();
      if (error) throw error;

      return NextResponse.json({
        offer: await sanitizeSingleOffer(supabase, expiredOffer, user.id),
      });
    }

    if (!["offered", "waiting_response"].includes(offer.status)) {
      return NextResponse.json(
        { error: "이미 처리된 초대장입니다." },
        { status: 400 },
      );
    }

    const isParticipantA = offer.participant_a_id === user.id;
    const ownResponse = isParticipantA ? offer.a_response : offer.b_response;
    if (ownResponse !== "pending") {
      return NextResponse.json(
        { error: "이미 응답한 초대장입니다." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };
    const ownResponseColumn = isParticipantA ? "a_response" : "b_response";
    const ownDatesColumn = isParticipantA
      ? "a_available_dates"
      : "b_available_dates";
    const ownRespondedAtColumn = isParticipantA
      ? "a_responded_at"
      : "b_responded_at";

    if (action === "no") {
      updates[ownResponseColumn] = "no";
      updates[ownDatesColumn] = [];
      updates[ownRespondedAtColumn] = now;
      updates.status = "declined";
      updates.declined_at = now;
    } else {
      const selectedDates = dateList(body?.availableDates);
      const storedCandidateDates = dateList(offer.candidate_dates);
      const candidateDates = storedCandidateDates.length
        ? storedCandidateDates
        : blindDateSelectableDatesFrom(offer.created_at);
      const candidateSet = new Set(candidateDates);
      const validDates = selectedDates.filter((date) => candidateSet.has(date));

      if (validDates.length === 0) {
        return NextResponse.json(
          { error: "가능한 날짜를 1개 이상 선택해주세요." },
          { status: 400 },
        );
      }

      const nextAResponse = isParticipantA ? "yes" : offer.a_response;
      const nextBResponse = isParticipantA ? offer.b_response : "yes";
      const nextAAvailableDates = isParticipantA
        ? validDates
        : dateList(offer.a_available_dates);
      const nextBAvailableDates = isParticipantA
        ? dateList(offer.b_available_dates)
        : validDates;
      const scheduledDate =
        nextAResponse === "yes" && nextBResponse === "yes"
          ? overlappingEarliestDate(nextAAvailableDates, nextBAvailableDates)
          : null;

      updates[ownResponseColumn] = "yes";
      updates[ownDatesColumn] = validDates;
      updates[ownRespondedAtColumn] = now;

      if (nextAResponse === "yes" && nextBResponse === "yes") {
        if (scheduledDate) {
          updates.status = "scheduled";
          updates.scheduled_date = scheduledDate;
          updates.scheduled_at = now;
        } else {
          updates.status = "needs_reschedule";
        }
      } else {
        updates.status = "waiting_response";
      }
    }

    const { data: updatedOffer, error: updateError } = await supabase
      .from("blind_date_offers")
      .update(updates)
      .eq("id", offer.id)
      .select(offerSelect)
      .single<BlindDateOfferRow>();
    if (updateError) throw updateError;

    return NextResponse.json({
      offer: await sanitizeSingleOffer(supabase, updatedOffer, user.id),
      offers: await loadUserOffers(supabase, user.id),
    });
  } catch (error) {
    console.error("[meetings blind dates POST]", error);
    return NextResponse.json(
      { error: "블라인드 데이트 응답을 저장하지 못했어요." },
      { status: 500 },
    );
  }
}
