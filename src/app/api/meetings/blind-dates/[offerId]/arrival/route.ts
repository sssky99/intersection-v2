import { NextResponse } from "next/server";
import {
  addBlindDateHours,
  blindDateOfferStartAt,
  loadBlindDateProgressOffer,
} from "@/lib/blindDateProgress";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BlindDateArrivalStatus } from "@/types/blindDate";

const arrivalStatuses = new Set<BlindDateArrivalStatus>([
  "on_time",
  "late_10",
  "late_20",
  "late_30_plus",
]);

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
    | { arrivalStatus?: unknown }
    | null;
  const arrivalStatus = body?.arrivalStatus;
  if (
    typeof arrivalStatus !== "string" ||
    !arrivalStatuses.has(arrivalStatus as BlindDateArrivalStatus)
  ) {
    return NextResponse.json({ error: "Invalid arrival status." }, { status: 400 });
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
    if (now < addBlindDateHours(startAt, -3) || now >= addBlindDateHours(startAt, 3)) {
      return NextResponse.json({ error: "Arrival status is not open." }, { status: 403 });
    }

    const updatedAt = now.toISOString();
    const { error } = await admin.from("blind_date_participations").upsert(
      {
        offer_id: offer.id,
        user_id: user.id,
        arrival_status: arrivalStatus,
        arrival_status_updated_at: updatedAt,
        updated_at: updatedAt,
      },
      { onConflict: "offer_id,user_id" },
    );
    if (error) throw error;

    return NextResponse.json({
      arrivalStatus,
      reservationName: offer.reservation_name ?? "이소윤",
      arrivalStatusUpdatedAt: updatedAt,
    });
  } catch (error) {
    console.error("[blind date arrival]", { offerId, error });
    return NextResponse.json(
      { error: "도착 상태를 저장하지 못했어요." },
      { status: 500 },
    );
  }
}
