import { NextResponse } from "next/server";
import {
  safeMeetingProposalFilename,
  type MeetingProposalProfileRow,
} from "@/lib/meetingProposalAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureMeetingProposalEligibility } from "../eligibility";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id,name,nickname,public_intro,public_emoji,membership_status,membership_end_date,is_test_participant")
    .eq("user_id", user.id)
    .maybeSingle<MeetingProposalProfileRow>();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "프로필 정보를 확인하지 못했어요." },
      { status: 400 },
    );
  }

  const eligibilityResponse = await ensureMeetingProposalEligibility(
    supabase,
    user.id,
    profile,
  );
  if (eligibilityResponse) return eligibilityResponse;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "업로드할 이미지가 없습니다." },
        { status: 400 },
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "이미지 파일만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }

    const path = `proposals/${user.id}/${Date.now()}-${safeMeetingProposalFilename(
      file.name,
    )}`;
    const admin = createAdminClient();
    const { error } = await admin.storage
      .from("ticket-images")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
    if (error) throw error;

    const { data } = admin.storage.from("ticket-images").getPublicUrl(path);
    return NextResponse.json({
      imageUrl: data.publicUrl,
      imageSource: "user_upload",
      imageSelectionMethod: "manual",
    });
  } catch (error) {
    console.error("[meeting proposal upload]", error);
    return NextResponse.json(
      { error: "이미지를 업로드하지 못했어요." },
      { status: 500 },
    );
  }
}
