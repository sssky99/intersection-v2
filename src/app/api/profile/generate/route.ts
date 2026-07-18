import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "AI 프로필 생성 기능은 더 이상 사용하지 않습니다.",
      code: "AI_PROFILE_GENERATION_DISABLED",
    },
    { status: 410 },
  );
}
