import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

function safeFilename(name: string) {
  const extension = name.includes(".") ? `.${name.split(".").pop()}` : "";
  const stem = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${stem || "image"}${extension.toLowerCase()}`;
}

export async function POST(request: NextRequest) {
  if (
    !isAdminSessionTokenValid(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)
  ) {
    return NextResponse.json(
      { error: "관리자 인증이 필요합니다." },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const templateId = formData.get("templateId");

    if (!(file instanceof File) || typeof templateId !== "string") {
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

    const path = `templates/${templateId}/${Date.now()}-${safeFilename(file.name)}`;
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
    console.error("Admin ticket image upload failed:", error);
    return NextResponse.json(
      { error: "이미지를 업로드하지 못했습니다." },
      { status: 500 },
    );
  }
}
