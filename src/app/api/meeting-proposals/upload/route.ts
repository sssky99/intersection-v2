import { NextResponse } from "next/server";
import {
  hasActiveProposalMembership,
  safeMeetingProposalFilename,
  type MeetingProposalProfileRow,
} from "@/lib/meetingProposalAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
    .select("user_id,name,nickname,public_intro,public_emoji,membership_status,membership_end_date")
    .eq("user_id", user.id)
    .maybeSingle<MeetingProposalProfileRow>();

  if (profileError || !profile || !hasActiveProposalMembership(profile)) {
    return NextResponse.json(
      {
        error: "교집합 제안은 멤버십 사용자만 이용할 수 있어요.",
        code: "membership_required",
      },
      { status: 402 },
    );
  }

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
    return NextResponse.json({ imageUrl: data.publicUrl });
  } catch (error) {
    console.error("[meeting proposal upload]", error);
    return NextResponse.json(
      { error: "이미지를 업로드하지 못했어요." },
      { status: 500 },
    );
  }
}
