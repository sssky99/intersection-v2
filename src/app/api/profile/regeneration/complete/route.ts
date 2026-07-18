import { NextResponse } from "next/server";
import { profileQuestions } from "@/data/profileQuestions";
import {
  calculateConversationResultCode,
  conversationResultVersion,
} from "@/lib/conversationResult";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/profile";
import type { Gender } from "@/types/user";

const REGENERATION_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const BIRTH_YEAR_MIN = 1992;
const BIRTH_YEAR_MAX = 2007;

type DraftAnswerRow = {
  question_order: number;
  answer_value: string | null;
  answer_values: string[] | null;
  answer_text: string | null;
  other_text: string | null;
  category: string;
  question_type: string;
  created_at?: string;
  updated_at?: string;
};

type CompleteRequestBody = {
  name?: unknown;
  phone?: unknown;
  gender?: unknown;
  birthYear?: unknown;
  mbti?: unknown;
  photoUrl?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8210")) return `0${digits.slice(2)}`;
  if (digits.startsWith("82") && digits.length > 10) return `0${digits.slice(2)}`;
  return digits;
}

function isGender(value: string): value is Gender {
  return value === "여성" || value === "남성";
}

function isValidBirthYear(value: string) {
  if (!/^\d{4}$/.test(value)) return false;
  const year = Number(value);
  return year >= BIRTH_YEAR_MIN && year <= BIRTH_YEAR_MAX;
}

function nextRegenerationDate(lastRegeneratedAt: string | null) {
  if (!lastRegeneratedAt) return null;
  const last = new Date(lastRegeneratedAt);
  if (!Number.isFinite(last.getTime())) return null;
  return new Date(last.getTime() + REGENERATION_COOLDOWN_MS);
}

function clampInternalScore(value: number) {
  return Math.min(100, Math.max(-100, value));
}

function answerScoreToInternalScore(value: string | null | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) return 0;
  return clampInternalScore((parsed - 3) * 50);
}

function scoreFromAnswer(answers: DraftAnswerRow[], order: number) {
  return answerScoreToInternalScore(
    answers.find((answer) => answer.question_order === order)?.answer_value,
  );
}

function profileScoresFromAnswers(answers: DraftAnswerRow[]) {
  return {
    score_temperature: scoreFromAnswer(answers, 1),
    score_texture: scoreFromAnswer(answers, 2),
    score_tone: scoreFromAnswer(answers, 3),
    score_rhythm: scoreFromAnswer(answers, 4),
  };
}

function requiredQuestionOrders() {
  return Array.from(
    new Set(profileQuestions.map((question) => question.order ?? question.id)),
  ).sort(
    (left, right) => left - right,
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CompleteRequestBody;
  const name = text(body.name);
  const phone = text(body.phone);
  const normalizedPhone = normalizePhone(phone);
  const gender = text(body.gender);
  const birthYear = text(body.birthYear);
  const mbti = text(body.mbti).toUpperCase();
  const photoUrl = text(body.photoUrl);

  if (
    name.length <= 1 ||
    normalizedPhone.length !== 11 ||
    !isGender(gender) ||
    !isValidBirthYear(birthYear) ||
    !mbti ||
    !photoUrl
  ) {
    return NextResponse.json(
      { error: "Profile information is incomplete." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single<ProfileRow>();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  if (!profile.profile_regeneration_started_at) {
    return NextResponse.json(
      { error: "Regeneration has not been started." },
      { status: 409 },
    );
  }
  if (!profile.profile_regeneration_questions_completed_at) {
    return NextResponse.json(
      { error: "Regeneration questions are incomplete." },
      { status: 409 },
    );
  }

  const nextAvailableAt = nextRegenerationDate(profile.last_profile_regenerated_at);
  if (
    profile.is_test_participant !== true &&
    nextAvailableAt &&
    nextAvailableAt.getTime() > Date.now()
  ) {
    return NextResponse.json(
      {
        error: "프로필 새로 만들기는 한 달에 한 번만 가능해요.",
        nextAvailableAt: nextAvailableAt.toISOString(),
      },
      { status: 429 },
    );
  }

  const { data: draftAnswers, error: answersError } = await admin
    .from("profile_regeneration_answers")
    .select(
      "question_order,category,question_type,answer_value,answer_values,answer_text,other_text,created_at,updated_at",
    )
    .eq("user_id", user.id)
    .order("question_order")
    .returns<DraftAnswerRow[]>();

  if (answersError) {
    console.error("[profile regeneration complete] draft answers failed", answersError);
    return NextResponse.json(
      { error: "Regeneration answers could not be loaded." },
      { status: 500 },
    );
  }

  const answers = draftAnswers ?? [];
  const answeredOrders = new Set(answers.map((answer) => answer.question_order));
  const missingOrders = requiredQuestionOrders().filter(
    (order) => !answeredOrders.has(order),
  );

  if (missingOrders.length > 0) {
    return NextResponse.json(
      {
        error: "Regeneration answers are incomplete.",
        missingOrders,
      },
      { status: 409 },
    );
  }

  const basicInfo = {
    name,
    nickname: profile.nickname ?? null,
    phone,
    phone_normalized: normalizedPhone,
    gender,
    birth_year: birthYear,
    mbti,
    photo_url: photoUrl,
  };
  const scores = profileScoresFromAnswers(answers);
  const resultCode = calculateConversationResultCode(answers);
  const calculatedAt = new Date().toISOString();

  const { error: completeError } = await admin.rpc(
    "complete_profile_regeneration",
    {
      p_user_id: user.id,
      p_basic_info: basicInfo,
      p_public_intro: profile.public_intro,
      p_public_emoji: profile.public_emoji,
      p_public_intro_model: profile.public_intro_model,
      p_public_intro_generated_at: profile.public_intro_generated_at,
      p_scores: scores,
    },
  );

  if (completeError) {
    console.error("[profile regeneration complete] commit failed", completeError);
    return NextResponse.json(
      { error: "Regeneration could not be completed." },
      { status: 500 },
    );
  }

  if (resultCode) {
    const { error: resultError } = await admin
      .from("profiles")
      .update({
        conversation_result_code: resultCode,
        conversation_result_version: conversationResultVersion,
        conversation_result_calculated_at: calculatedAt,
        conversation_result_source: "direct",
        conversation_result_confidence: 1,
      })
      .eq("user_id", user.id);

    if (resultError) {
      console.error("[profile regeneration complete] result save failed", resultError);
      return NextResponse.json(
        { error: "Conversation type could not be saved." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    conversationResultCode: resultCode,
    conversationResultVersion: resultCode ? conversationResultVersion : null,
  });
}
