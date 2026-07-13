import { NextResponse } from "next/server";
import { publicProfileModel } from "@/lib/openai";
import {
  buildFallbackIntro,
  type PromptAnswerRow,
} from "@/lib/profilePrompt";
import {
  fallbackPublicProfileModel,
  generatePublicProfile,
  isFallbackPublicProfileModel,
} from "@/lib/profileGeneration";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasUsablePublicIntro } from "@/lib/textQuality";
import type { ProfileRow } from "@/types/profile";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: profile }, { data: answers }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single<ProfileRow>(),
    supabase
      .from("user_answers")
      .select(
        "question_order,answer_value,answer_values,answer_text,other_text",
      )
      .eq("user_id", user.id)
      .order("question_order"),
  ]);

  if (!profile || !profile.profile_completed) {
    return NextResponse.json(
      { error: "Profile information is incomplete." },
      { status: 409 },
    );
  }

  const requestBody = (await request.json().catch(() => ({}))) as {
    force?: boolean;
  };
  const forceRegenerate =
    process.env.NODE_ENV === "development" && requestBody.force === true;
  const storedIntroIsUsable = hasUsablePublicIntro(profile.public_intro);

  if (
    !forceRegenerate &&
    storedIntroIsUsable &&
    !isFallbackPublicProfileModel(profile.public_intro_model)
  ) {
    return NextResponse.json({
      intro: profile.public_intro,
      emoji: profile.public_emoji,
      generatedAt: profile.public_intro_generated_at,
      model: profile.public_intro_model,
      source: "stored",
    });
  }

  const promptAnswers = (answers ?? []) as PromptAnswerRow[];
  const fallbackIntro = buildFallbackIntro(profile, promptAnswers);
  const generation = await generatePublicProfile(profile, promptAnswers);
  const generatedAt = new Date().toISOString();
  const admin = createAdminClient();

  if (generation.kind === "fallback") {
    const fallbackModel = fallbackPublicProfileModel(generation.reason);
    const { error } = await admin
      .from("profiles")
      .update({
        public_intro: fallbackIntro,
        public_emoji: null,
        public_intro_generated_at: generatedAt,
        public_intro_model: fallbackModel,
      })
      .eq("user_id", user.id);

    if (error) {
      console.error("Fallback profile save error:", error.message);
      return NextResponse.json(
        { error: "Profile generation could not be saved." },
        { status: 500 },
      );
    }

    console.warn("[profile.generate] fallback saved", {
      userId: user.id,
      reason: generation.reason,
      attempts: generation.attempts,
    });

    return NextResponse.json({
      intro: fallbackIntro,
      emoji: null,
      generatedAt,
      model: fallbackModel,
      source: "fallback",
      notice:
        generation.reason === "missing_api_key"
          ? "OPENAI_API_KEY가 없어 임시 공개 프로필을 표시하고 있어요."
          : "공개 프로필 생성이 잠시 지연되어 임시 소개문을 표시하고 있어요.",
    });
  }

  const { error } = await admin
    .from("profiles")
    .update({
      public_intro: generation.intro,
      public_emoji: generation.emoji || null,
      public_intro_generated_at: generatedAt,
      public_intro_model: publicProfileModel,
    })
    .eq("user_id", user.id);

  if (error) {
    console.error("Generated profile save error:", error.message);
    return NextResponse.json(
      { error: "Profile generation could not be saved." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    intro: generation.intro,
    emoji: generation.emoji,
    generatedAt,
    model: publicProfileModel,
    source: "generated",
  });
}
