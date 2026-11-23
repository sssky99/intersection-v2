import { NextResponse } from "next/server";
import { localSignupQuestions, signupQuestionnaireVersion } from "@/data/localSignupQuestions";
import { classifyLocalSignup } from "@/data/localSignupArchetype";
import { safelyRecordServerFunnelEvent } from "@/lib/funnelAnalytics";
import { validQuestionAnswer } from "@/lib/questionAnswerValidation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { StoredAnswerRow } from "@/types/question";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const phone = (user.phone ?? "").replace(/\D/g, "").replace(/^8210/, "010");
  if (!/^010\d{8}$/.test(phone) || !user.phone_confirmed_at) {
    return NextResponse.json({ error: "휴대폰 인증이 필요해요." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (body?.questionnaireVersion !== signupQuestionnaireVersion || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: "새 가입 질문부터 다시 시작해 주세요." }, { status: 400 });
  }
  const rows = new Map<number, StoredAnswerRow>();
  for (const row of body.answers) {
    if (!row || !localSignupQuestions.some(q => q.id === row.question_order) || rows.has(row.question_order) ||
        (row.answer_text != null && typeof row.answer_text !== "string") ||
        (row.answer_values != null && !Array.isArray(row.answer_values))) {
      return NextResponse.json({ error: "유효하지 않은 답변이에요." }, { status: 400 });
    }
    rows.set(row.question_order, row);
  }
  if (!localSignupQuestions.every(q => validQuestionAnswer(q, rows.get(q.id)))) {
    return NextResponse.json({ error: "가입 질문을 모두 확인해 주세요." }, { status: 400 });
  }
  const answers = localSignupQuestions.flatMap(q => {
    const row = rows.get(q.id);
    return row ? [{ question_order: q.id, category: q.category, question_type: q.type,
      answer_value: q.type === "single_choice" ? row.answer_value : null,
      answer_values: q.type === "multi_choice" ? row.answer_values ?? [] : null,
      answer_text: q.type === "text" ? row.answer_text!.trim() : null, other_text: null }] : [];
  });
  const profileArchetypeId = classifyLocalSignup(answers);
  const { data: saved, error } = await createAdminClient().rpc("complete_signup_v17", {
    p_user_id: user.id, p_phone: phone, p_name: rows.get(2001)!.answer_text!.trim(),
    p_gender: rows.get(2030)!.answer_value === "남자" ? "남성" : "여성",
    p_birth_date: rows.get(2029)!.answer_text, p_type: profileArchetypeId, p_answers: answers,
  });
  if (error) return NextResponse.json({ error: "답변 저장에 실패했어요." }, { status: 500 });
  if (!saved) return NextResponse.json({ existing: true }, { status: 409 });
  await safelyRecordServerFunnelEvent({ sessionId: body.analyticsSessionId, profileId: user.id,
    eventName: "questions_complete", path: "/api/profile/onboarding/import",
    metadata: { mode: "guest_import", questionnaire_version: signupQuestionnaireVersion }, createdAt: new Date().toISOString() });
  return NextResponse.json({ ok: true, profileArchetypeId });
}
