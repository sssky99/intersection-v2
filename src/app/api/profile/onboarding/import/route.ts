import { NextResponse } from "next/server";
import { profileQuestions } from "@/data/profileQuestions";
import {
  calculateConversationResultCode,
  conversationResultVersion,
} from "@/lib/conversationResult";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProfileQuestion, StoredAnswerRow } from "@/types/question";
import type { ProfileRow } from "@/types/profile";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8210")) return `0${digits.slice(2)}`;
  if (digits.startsWith("82") && digits.length > 10) return `0${digits.slice(2)}`;
  return digits;
}

function optionValues(question: ProfileQuestion) {
  return new Set(
    (question.options ?? []).map((option) =>
      typeof option === "string" ? option : option.value,
    ),
  );
}

function validAnswer(question: ProfileQuestion, row: StoredAnswerRow) {
  const allowedValues = optionValues(question);
  if (question.type === "text") return Boolean(row.answer_text?.trim());
  if (question.type === "multi_choice") {
    const values = row.answer_values ?? [];
    return (
      values.length > 0 &&
      (!question.maxSelections || values.length <= question.maxSelections) &&
      values.every((value) => allowedValues.has(value))
    );
  }
  return Boolean(row.answer_value && allowedValues.has(row.answer_value));
}

function isStoredAnswerRow(value: unknown): value is StoredAnswerRow {
  return Boolean(
    value &&
      typeof value === "object" &&
      Number.isInteger((value as Partial<StoredAnswerRow>).question_order),
  );
}

function answerScore(value: string | null | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) return 0;
  return Math.min(100, Math.max(-100, (parsed - 3) * 50));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | {
        answers?: unknown;
        profile?: Record<string, unknown>;
        photoUrl?: unknown;
      }
    | null;
  const rows = Array.isArray(body?.answers)
    ? body.answers.filter(isStoredAnswerRow)
    : [];
  const rowsByOrder = new Map(rows.map((row) => [row.question_order, row]));
  const answersValid = profileQuestions.every((question) => {
    const order = question.order ?? question.id;
    const row = rowsByOrder.get(order);
    return Boolean(row && validAnswer(question, row));
  });

  if (!answersValid) {
    return NextResponse.json({ error: "Answers are incomplete." }, { status: 400 });
  }

  const name = text(body?.profile?.name);
  const phone = text(body?.profile?.phone);
  const phoneNormalized = normalizePhone(phone);
  const gender = text(body?.profile?.gender);
  const birthYear = text(body?.profile?.birthYear);
  const mbti = text(body?.profile?.mbti).toUpperCase();
  const photoUrl = text(body?.photoUrl);
  const year = Number(birthYear);

  if (
    name.length <= 1 ||
    phoneNormalized.length !== 11 ||
    (gender !== "여성" && gender !== "남성") ||
    !/^\d{4}$/.test(birthYear) ||
    year < 1992 ||
    year > 2007 ||
    !mbti ||
    mbti.length > 20 ||
    !photoUrl
  ) {
    return NextResponse.json(
      { error: "Profile information is incomplete." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();

  if (!existingProfile) {
    return NextResponse.json({ error: "Profile is unavailable." }, { status: 409 });
  }

  if (existingProfile.questions_completed || existingProfile.profile_completed) {
    return NextResponse.json(
      { error: "Existing profile must not be overwritten.", existing: true },
      { status: 409 },
    );
  }

  const answerRows = profileQuestions.map((question) => {
    const order = question.order ?? question.id;
    const row = rowsByOrder.get(order)!;
    return {
      user_id: user.id,
      question_order: order,
      category: question.category,
      question_type: question.type,
      answer_value: question.type === "single_choice" ? row.answer_value : null,
      answer_values: question.type === "multi_choice" ? row.answer_values : null,
      answer_text: question.type === "text" ? row.answer_text?.trim() : null,
      other_text: row.other_text?.trim() || null,
      updated_at: new Date().toISOString(),
    };
  });
  const resultCode = calculateConversationResultCode(answerRows);
  if (!resultCode) {
    return NextResponse.json(
      { error: "Conversation result could not be calculated." },
      { status: 400 },
    );
  }

  const { error: answersError } = await admin
    .from("user_answers")
    .upsert(answerRows, { onConflict: "user_id,question_order" });
  if (answersError) {
    console.error("Guest onboarding answers import failed:", answersError.message);
    return NextResponse.json({ error: "Answers could not be saved." }, { status: 500 });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      name,
      phone,
      phone_normalized: phoneNormalized,
      gender,
      birth_year: birthYear,
      mbti,
      photo_url: photoUrl,
      questions_completed: true,
      profile_completed: true,
      conversation_result_code: resultCode,
      conversation_result_version: conversationResultVersion,
      conversation_result_calculated_at: new Date().toISOString(),
      conversation_result_source: "direct",
      conversation_result_confidence: 1,
    })
    .eq("user_id", user.id);

  if (profileError) {
    console.error("Guest onboarding profile import failed:", profileError.message);
    return NextResponse.json({ error: "Profile could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
