import { NextResponse } from "next/server";
import { generateProfileText, publicProfileModel } from "@/lib/openai";
import {
  buildFallbackIntro,
  buildProfileInput,
  isValidGeneratedIntro,
  parseGeneratedProfileContent,
  profileInstructions,
  type PromptAnswerRow,
} from "@/lib/profilePrompt";
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
    profile.public_intro_model !== "fallback"
  ) {
    return NextResponse.json({
      intro: profile.public_intro,
      emoji: profile.public_emoji,
      model: profile.public_intro_model,
      source: "stored",
    });
  }

  const promptAnswers = (answers ?? []) as PromptAnswerRow[];
  const fallbackIntro = buildFallbackIntro(profile, promptAnswers);

  if (!process.env.OPENAI_API_KEY) {
    if (!storedIntroIsUsable || forceRegenerate) {
      const { error } = await supabase
        .from("profiles")
        .update({
          public_intro: fallbackIntro,
          public_intro_generated_at: new Date().toISOString(),
          public_intro_model: "fallback",
        })
        .eq("user_id", user.id);

      if (error) {
        console.error("Fallback profile save error:", error.message);
      }
    }

    return NextResponse.json({
      intro: forceRegenerate
        ? fallbackIntro
        : storedIntroIsUsable
          ? profile.public_intro
          : fallbackIntro,
      model: "fallback",
      source: "fallback",
      notice:
        "OPENAI_API_KEY가 없어 개발용 임시 공개 프로필을 표시하고 있어요.",
    });
  }

  try {
    const generatedRaw = await generateProfileText({
      instructions: profileInstructions,
      input: buildProfileInput(profile, promptAnswers),
    });
    const generatedProfile = parseGeneratedProfileContent(generatedRaw);
    const generatedIntro = generatedProfile?.publicIntro ?? null;

    if (
      !generatedIntro ||
      !isValidGeneratedIntro(generatedIntro, profile)
    ) {
      const { error: fallbackSaveError } = await supabase
        .from("profiles")
        .update({
          public_intro: fallbackIntro,
          public_intro_generated_at: new Date().toISOString(),
          public_intro_model: "fallback",
        })
        .eq("user_id", user.id);

      if (fallbackSaveError) {
        console.error(
          "Fallback profile save error:",
          fallbackSaveError.message,
        );
      }

      return NextResponse.json({
        intro: fallbackIntro,
        emoji: profile.public_emoji,
        model: "fallback",
        source: "fallback",
        notice: generatedRaw
          ? "생성 문장이 공개 프로필 형식과 맞지 않아 안전한 소개문으로 정리했어요."
          : undefined,
      });
    }

    const intro = generatedIntro.trim();
    const emoji = generatedProfile?.publicEmoji ?? null;
    const generatedAt = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({
        public_intro: intro,
        public_emoji: emoji || profile.public_emoji || null,
        public_intro_generated_at: generatedAt,
        public_intro_model: publicProfileModel,
      })
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      intro,
      emoji: emoji || profile.public_emoji,
      model: publicProfileModel,
      source: "generated",
    });
  } catch (error) {
    console.error("Public profile generation error:", error);
    const { error: fallbackSaveError } = await supabase
      .from("profiles")
      .update({
        public_intro: forceRegenerate
          ? fallbackIntro
          : storedIntroIsUsable
            ? profile.public_intro
            : fallbackIntro,
        public_intro_generated_at: new Date().toISOString(),
        public_intro_model: "fallback",
      })
      .eq("user_id", user.id);

    if (fallbackSaveError) {
      console.error(
        "Fallback profile save error:",
        fallbackSaveError.message,
      );
    }

    return NextResponse.json({
      intro: forceRegenerate
        ? fallbackIntro
        : storedIntroIsUsable
          ? profile.public_intro
          : fallbackIntro,
      model: "fallback",
      source: "fallback",
      notice:
        "공개 프로필 생성이 잠시 지연되어 임시 소개문을 표시하고 있어요.",
    });
  }
}
