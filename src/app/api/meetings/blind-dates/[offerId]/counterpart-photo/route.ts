import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BlindDatePhotoOffer = {
  participant_a_id: string;
  participant_b_id: string;
  status: string;
};

type ProfilePhoto = {
  photo_url: string | null;
};

function errorResponse(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function safeProfilePhotoUrl(value: string | null) {
  if (!value) return null;

  try {
    const photoUrl = new URL(value);
    const storageUrl = new URL(supabaseUrl);
    if (
      photoUrl.protocol !== "https:" ||
      photoUrl.hostname !== storageUrl.hostname ||
      !photoUrl.pathname.startsWith("/storage/v1/object/public/")
    ) {
      return null;
    }
    return photoUrl;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ offerId: string }> },
) {
  const { offerId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return errorResponse("로그인이 필요합니다.", 401);

  const admin = createAdminClient();
  const { data: offer, error: offerError } = await admin
    .from("blind_date_offers")
    .select("participant_a_id,participant_b_id,status")
    .eq("id", offerId)
    .or(`participant_a_id.eq.${user.id},participant_b_id.eq.${user.id}`)
    .maybeSingle<BlindDatePhotoOffer>();

  if (offerError || !offer) {
    return errorResponse("블라인드 데이트 정보를 찾을 수 없습니다.", 404);
  }
  if (!["scheduled", "completed"].includes(offer.status)) {
    return errorResponse("일정이 확정된 뒤 확인할 수 있습니다.", 403);
  }

  const counterpartId =
    offer.participant_a_id === user.id
      ? offer.participant_b_id
      : offer.participant_a_id;
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("photo_url")
    .eq("user_id", counterpartId)
    .maybeSingle<ProfilePhoto>();
  const photoUrl = safeProfilePhotoUrl(profile?.photo_url ?? null);

  if (profileError || !photoUrl) {
    return errorResponse("상대 프로필 사진을 준비하지 못했습니다.", 404);
  }

  try {
    const sourceResponse = await fetch(photoUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!sourceResponse.ok) throw new Error("profile-photo-fetch-failed");

    const source = Buffer.from(await sourceResponse.arrayBuffer());
    if (source.byteLength === 0 || source.byteLength > 10 * 1024 * 1024) {
      throw new Error("profile-photo-size-invalid");
    }

    const mosaic = await sharp(source)
      .rotate()
      .resize(16, 16, { fit: "cover", position: "attention" })
      .jpeg({ quality: 55, chromaSubsampling: "4:2:0" })
      .toBuffer();

    return new Response(mosaic, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[blind date counterpart mosaic]", { offerId, error });
    return errorResponse("상대 프로필 사진을 준비하지 못했습니다.", 502);
  }
}
