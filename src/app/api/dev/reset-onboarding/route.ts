import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error: answersError } = await admin
    .from("user_answers")
    .delete()
    .eq("user_id", user.id);

  if (answersError) {
    console.error("Development onboarding answers reset failed:", answersError);
    return NextResponse.json(
      { error: "질문 답변을 초기화하지 못했습니다." },
      { status: 500 },
    );
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      questions_completed: false,
      profile_completed: false,
      public_intro: null,
      public_intro_generated_at: null,
      public_intro_model: null,
      launch_notification_requested: false,
      launch_notification_requested_at: null,
    })
    .eq("user_id", user.id);

  if (profileError) {
    console.error("Development onboarding profile reset failed:", profileError);
    return NextResponse.json(
      { error: "온보딩 상태를 초기화하지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ reset: true });
}
