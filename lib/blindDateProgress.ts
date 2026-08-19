import "server-only";
import type { createAdminClient } from "./supabase/admin";
import { addBlindDateHours, blindDateStartAtFromParts } from "./blindDateTiming";

type AdminClient = ReturnType<typeof createAdminClient>;

export type BlindDateProgressOffer = {
  id: string;
  participant_a_id: string;
  participant_b_id: string;
  status: string;
  scheduled_date: string | null;
  time_label: string;
  actual_place_name: string | null;
  reservation_name: string | null;
};

export async function loadBlindDateProgressOffer(
  supabase: AdminClient,
  offerId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("blind_date_offers")
    .select(
      "id,participant_a_id,participant_b_id,status,scheduled_date,time_label,actual_place_name,reservation_name",
    )
    .eq("id", offerId)
    .or(`participant_a_id.eq.${userId},participant_b_id.eq.${userId}`)
    .maybeSingle<BlindDateProgressOffer>();
  if (error) throw error;
  return data ?? null;
}

export function blindDateOfferStartAt(
  offer: Pick<BlindDateProgressOffer, "scheduled_date" | "time_label">,
) {
  return blindDateStartAtFromParts(offer.scheduled_date, offer.time_label);
}

export { addBlindDateHours };
