import { NextResponse } from "next/server";
import {
  preferenceProfileVersion,
  preferenceQuestions,
  usesPreferenceProfile,
} from "@/data/preferenceQuestions";
import { profileQuestions } from "@/data/profileQuestions";
import {
  calculateConversationResultCode,
  conversationResultVersion,
} from "@/lib/conversationResult";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/profile";

type AnswerRow = {
  question_order: number;
  answer_value: string | null;
  answer_values: string[] | null;
  answer_text: string | null;
};

function validPreferenceAnswer(
  question: (typeof preferenceQuestions)[number],
  answer: AnswerRow | undefined,
) {
  if (!answer) return false;
  const allowedValues = new Set(
    (question.options ?? []).map((option) =>
      typeof option === "string" ? option : option.value,
    ),
  );

  if (question.type === "single_choice") {
    return Boolean(answer.answer_value && allowedValues.has(answer.answer_value));
  }

  if (question.type === "text") {
    return Boolean(answer.answer_text?.trim());
  }

  const values = answer.answer_values ?? [];
  return (
    values.length >= (question.minSelections ?? 1) &&
    (!question.maxSelections || values.length <= question.maxSelections) &&
    values.every((value) => allowedValues.has(value))
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
  const isPreferenceRegeneration =
    body?.mode === "preferences-v2-regeneration";
  const isPreferenceUpgrade = body?.mode === "preferences-v2-upgrade";
  const isRegeneration =
    body?.mode === "regeneration" ||
    isPreferenceRegeneration ||
    isPreferenceUpgrade;
  const answerTable = isRegeneration ? "profile_regeneration_answers" : "user_answers";
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();
  const isPreferenceOnboarding =
    !isRegeneration &&
    body?.mode === "preferences-v2" &&
    Boolean(profile && usesPreferenceProfile(profile));
  const isPreferenceFlow =
    isPreferenceOnboarding ||
    isPreferenceUpgrade ||
    (isPreferenceRegeneration &&
      Boolean(profile && usesPreferenceProfile(profile)));
  const questions = isPreferenceFlow
    ? preferenceQuestions
    : profileQuestions;
  const { data, error } = await admin
    .from(answerTable)
    .select("question_order,answer_value,answer_values,answer_text")
    .eq("user_id", user.id)
    .returns<AnswerRow[]>();

  if (error) {
    console.error("Profile answer completion lookup failed:", error.message);
    return NextResponse.json({ error: "Answers could not be verified." }, { status: 500 });
  }

  const requiredOrders = new Set(questions.map((question) => question.order ?? question.id));
  const answers = data ?? [];
  const answeredOrders = new Set(answers.map((answer) => answer.question_order));
  if ([...requiredOrders].some((order) => !answeredOrders.has(order))) {
    return NextResponse.json({ error: "Answers are incomplete." }, { status: 409 });
  }
  if (
    isPreferenceFlow &&
    preferenceQuestions.some((question) =>
      !validPreferenceAnswer(
        question,
        answers.find(
          (answer) =>
            answer.question_order === (question.order ?? question.id),
        ),
      ),
    )
  ) {
    return NextResponse.json({ error: "Answers are invalid." }, { status: 409 });
  }

  if (isPreferenceRegeneration || isPreferenceUpgrade) {
    if (!profile?.profile_regeneration_started_at) {
      return NextResponse.json(
        { error: "Regeneration has not been started." },
        { status: 409 },
      );
    }

    const { error: completeError } = await admin.rpc(
      "complete_profile_regeneration",
      {
        p_user_id: user.id,
        p_basic_info: {
          name: profile.name,
          nickname: profile.nickname,
          phone: profile.phone,
          phone_normalized: profile.phone_normalized,
          gender: profile.gender,
          birth_year: profile.birth_year,
          mbti: profile.mbti,
          photo_url: profile.photo_url,
        },
        p_public_intro: profile.public_intro,
        p_public_emoji: profile.public_emoji,
        p_public_intro_model: profile.public_intro_model,
        p_public_intro_generated_at: profile.public_intro_generated_at,
        p_scores: {
          score_temperature: profile.score_temperature,
          score_texture: profile.score_texture,
          score_tone: profile.score_tone,
          score_rhythm: profile.score_rhythm,
        },
      },
    );

    if (completeError) {
      console.error(
        "Preference profile regeneration failed:",
        completeError.message,
      );
      return NextResponse.json(
        { error: "Regeneration could not be completed." },
        { status: 500 },
      );
    }

    const { error: resultResetError } = await admin
      .from("profiles")
      .update({
        ...(isPreferenceUpgrade
          ? { profile_experience_version: preferenceProfileVersion }
          : {}),
        conversation_result_code: null,
        conversation_result_version: null,
        conversation_result_calculated_at: null,
        conversation_result_source: null,
        conversation_result_confidence: null,
      })
      .eq("user_id", user.id);

    if (resultResetError) {
      console.error(
        "Preference conversation result reset failed:",
        resultResetError.message,
      );
    }

    return NextResponse.json({ ok: true });
  }

  const resultCode = isRegeneration || isPreferenceOnboarding
    ? null
    : calculateConversationResultCode(answers);
  if (!isRegeneration && !isPreferenceOnboarding && !resultCode) {
    return NextResponse.json(
      { error: "Conversation result could not be calculated." },
      { status: 409 },
    );
  }

  const update = isRegeneration
    ? { profile_regeneration_questions_completed_at: new Date().toISOString() }
    : isPreferenceOnboarding
      ? { questions_completed: true, questions_completed_at: new Date().toISOString() }
    : {
        questions_completed: true,
        questions_completed_at: new Date().toISOString(),
        conversation_result_code: resultCode,
        conversation_result_version: conversationResultVersion,
        conversation_result_calculated_at: new Date().toISOString(),
        conversation_result_source: "direct",
        conversation_result_confidence: 1,
      };
  const { error: updateError } = await admin.from("profiles").update(update).eq("user_id", user.id);

  if (updateError) {
    console.error("Profile answer completion save failed:", updateError.message);
    return NextResponse.json({ error: "Completion could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
