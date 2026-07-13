import { NextResponse } from "next/server";
import { profileQuestions } from "@/data/profileQuestions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AnswerRow = { question_order: number; answer_value: string | null };

function answerScore(value: string | null | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) return 0;
  return Math.min(100, Math.max(-100, (parsed - 3) * 50));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
  const isRegeneration = body?.mode === "regeneration";
  const answerTable = isRegeneration ? "profile_regeneration_answers" : "user_answers";
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(answerTable)
    .select("question_order,answer_value")
    .eq("user_id", user.id)
    .returns<AnswerRow[]>();

  if (error) {
    console.error("Profile answer completion lookup failed:", error.message);
    return NextResponse.json({ error: "Answers could not be verified." }, { status: 500 });
  }

  const requiredOrders = new Set(profileQuestions.map((question) => question.order ?? question.id));
  const answers = data ?? [];
  const answeredOrders = new Set(answers.map((answer) => answer.question_order));
  if ([...requiredOrders].some((order) => !answeredOrders.has(order))) {
    return NextResponse.json({ error: "Answers are incomplete." }, { status: 409 });
  }

  const answerByOrder = new Map(answers.map((answer) => [answer.question_order, answer.answer_value]));
  const update = isRegeneration
    ? { profile_regeneration_questions_completed_at: new Date().toISOString() }
    : {
        questions_completed: true,
        score_temperature: answerScore(answerByOrder.get(1)),
        score_texture: answerScore(answerByOrder.get(2)),
        score_tone: answerScore(answerByOrder.get(3)),
        score_rhythm: answerScore(answerByOrder.get(4)),
      };
  const { error: updateError } = await admin.from("profiles").update(update).eq("user_id", user.id);

  if (updateError) {
    console.error("Profile answer completion save failed:", updateError.message);
    return NextResponse.json({ error: "Completion could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
