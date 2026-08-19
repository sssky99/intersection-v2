import { NextResponse } from "next/server";
import {
  addBlindDateHours,
  blindDateOfferStartAt,
  loadBlindDateProgressOffer,
} from "@/lib/blindDateProgress";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function rating(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5
    ? value
    : null;
}

function comment(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length <= 500 ? normalized || null : undefined;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ offerId: string }> },
) {
  const { offerId } = await context.params;
  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | {
        counterpartRating?: unknown;
        counterpartComment?: unknown;
        placeRating?: unknown;
        placeComment?: unknown;
      }
    | null;
  const counterpartRating = rating(body?.counterpartRating);
  const counterpartComment = comment(body?.counterpartComment);
  const placeRating = rating(body?.placeRating);
  const placeComment = comment(body?.placeComment);
  if (
    !counterpartRating ||
    !placeRating ||
    counterpartComment === undefined ||
    placeComment === undefined
  ) {
    return NextResponse.json({ error: "Invalid feedback." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const offer = await loadBlindDateProgressOffer(admin, offerId, user.id);
    if (!offer) return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    if (!["scheduled", "completed"].includes(offer.status)) {
      return NextResponse.json({ error: "The date is not confirmed." }, { status: 403 });
    }
    const startAt = blindDateOfferStartAt(offer);
    if (!startAt) {
      return NextResponse.json({ error: "Start time is unavailable." }, { status: 400 });
    }
    const now = new Date();
    if (now < addBlindDateHours(startAt, 3) || now >= addBlindDateHours(startAt, 27)) {
      return NextResponse.json({ error: "Feedback is not open." }, { status: 403 });
    }

    const { data: existing, error: existingError } = await admin
      .from("blind_date_participations")
      .select("feedback_completed_at")
      .eq("offer_id", offer.id)
      .eq("user_id", user.id)
      .maybeSingle<{ feedback_completed_at: string | null }>();
    if (existingError) throw existingError;
    if (existing?.feedback_completed_at) {
      return NextResponse.json({ error: "Feedback is already complete." }, { status: 409 });
    }

    const completedAt = now.toISOString();
    const { error: saveError } = await admin.from("blind_date_participations").upsert(
      {
        offer_id: offer.id,
        user_id: user.id,
        counterpart_rating: counterpartRating,
        counterpart_comment: counterpartComment,
        place_rating: placeRating,
        place_comment: placeComment,
        feedback_completed_at: completedAt,
        updated_at: completedAt,
      },
      { onConflict: "offer_id,user_id" },
    );
    if (saveError) throw saveError;

    const { count, error: countError } = await admin
      .from("blind_date_participations")
      .select("id", { count: "exact", head: true })
      .eq("offer_id", offer.id)
      .not("feedback_completed_at", "is", null);
    if (countError) throw countError;
    if ((count ?? 0) >= 2) {
      const { error: completeError } = await admin
        .from("blind_date_offers")
        .update({ status: "completed", completed_at: completedAt, updated_at: completedAt })
        .eq("id", offer.id);
      if (completeError) throw completeError;
    }

    return NextResponse.json({ ok: true, feedbackCompletedAt: completedAt });
  } catch (error) {
    console.error("[blind date feedback]", { offerId, error });
    return NextResponse.json(
      { error: "피드백을 저장하지 못했어요." },
      { status: 500 },
    );
  }
}
