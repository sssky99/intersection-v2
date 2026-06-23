import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { safeMeetingProposalFilename } from "@/lib/meetingProposalAccess";
import { createAdminClient } from "@/lib/supabase/admin";

const maxImageSize = 10 * 1024 * 1024;

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
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

    if (file.size > maxImageSize) {
      return NextResponse.json(
        { error: "이미지는 10MB 이하로 업로드해주세요." },
        { status: 400 },
      );
    }

    const path = `proposals/admin/${Date.now()}-${safeMeetingProposalFilename(
      file.name,
    )}`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from("ticket-images")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
    if (error) throw error;

    const { data } = supabase.storage.from("ticket-images").getPublicUrl(path);
    return NextResponse.json({ imageUrl: data.publicUrl });
  } catch (error) {
    console.error("[admin proposal image upload]", error);
    return NextResponse.json(
      { error: "이미지를 업로드하지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
