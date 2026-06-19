import { NextResponse } from "next/server";
import { profileQuestions } from "@/data/profileQuestions";
import { loadTicketQuestionTemplates } from "@/features/onboarding/loadTicketQuestionTemplates";
import { generateProfileText, publicProfileModel } from "@/lib/openai";
import {
  buildFallbackIntro,
  buildProfileInput,
  isValidGeneratedIntro,
  parseGeneratedProfileContent,
  profileInstructions,
  type PromptAnswerRow,
} from "@/lib/profilePrompt";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/profile";
import type { Gender } from "@/types/user";

const REGENERATION_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const BIRTH_YEAR_MIN = 1992;
const BIRTH_YEAR_MAX = 2007;

type DraftAnswerRow = PromptAnswerRow & {
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

type GeneratedProfileResult = {
  intro: string;
  emoji: string | null;
  generatedAt: string;
  model: string;
  notice?: string;
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

async function requiredQuestionOrders() {
  const ticketQuestionTemplates = await loadTicketQuestionTemplates();
  const staticOrders = profileQuestions
    .filter((question) => question.type !== "ticket_rating")
    .map((question) => question.order ?? question.id);
  const ticketOrders = ticketQuestionTemplates.map(
    (template) => 9 + template.questionOrder,
  );

  return Array.from(new Set([...staticOrders, ...ticketOrders])).sort(
    (left, right) => left - right,
  );
}

async function generateRegeneratedProfile(
  profile: ProfileRow,
  answers: DraftAnswerRow[],
): Promise<GeneratedProfileResult> {
  const generatedAt = new Date().toISOString();
  const promptAnswers = answers as PromptAnswerRow[];
  const fallbackIntro = buildFallbackIntro(profile, promptAnswers);

  if (!process.env.OPENAI_API_KEY) {
    return {
      intro: fallbackIntro,
      emoji: profile.public_emoji,
      generatedAt,
      model: "fallback",
      notice: "OPENAI_API_KEY가 없어 개발용 임시 공개 프로필을 저장했어요.",
    };
  }

  try {
    const generatedRaw = await generateProfileText({
      instructions: profileInstructions,
      input: buildProfileInput(profile, promptAnswers),
    });
    const generatedProfile = parseGeneratedProfileContent(generatedRaw);
    const generatedIntro = generatedProfile?.publicIntro ?? null;

    if (!generatedIntro || !isValidGeneratedIntro(generatedIntro, profile)) {
      return {
        intro: fallbackIntro,
        emoji: profile.public_emoji,
        generatedAt,
        model: "fallback",
        notice:
          "생성 문장이 공개 프로필 형식과 맞지 않아 안전한 소개문으로 정리했어요.",
      };
    }

    return {
      intro: generatedIntro.trim(),
      emoji: generatedProfile?.publicEmoji ?? profile.public_emoji,
      generatedAt,
      model: publicProfileModel,
    };
  } catch (error) {
    console.error("[profile regeneration complete] public profile generation failed", error);
    return {
      intro: fallbackIntro,
      emoji: profile.public_emoji,
      generatedAt,
      model: "fallback",
      notice: "공개 프로필 생성이 잠시 지연되어 임시 소개문을 저장했어요.",
    };
  }
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
  const missingOrders = (await requiredQuestionOrders()).filter(
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
  const nextProfile: ProfileRow = {
    ...profile,
    ...basicInfo,
    profile_completed: true,
    questions_completed: true,
  };
  const scores = profileScoresFromAnswers(answers);
  const generatedProfile = await generateRegeneratedProfile(nextProfile, answers);

  const { error: completeError } = await admin.rpc(
    "complete_profile_regeneration",
    {
      p_user_id: user.id,
      p_basic_info: basicInfo,
      p_public_intro: generatedProfile.intro,
      p_public_emoji: generatedProfile.emoji,
      p_public_intro_model: generatedProfile.model,
      p_public_intro_generated_at: generatedProfile.generatedAt,
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

  return NextResponse.json({
    ok: true,
    intro: generatedProfile.intro,
    emoji: generatedProfile.emoji,
    generatedAt: generatedProfile.generatedAt,
    model: generatedProfile.model,
    notice: generatedProfile.notice,
  });
}
