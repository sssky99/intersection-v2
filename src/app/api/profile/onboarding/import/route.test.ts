import { beforeEach, describe, expect, it, vi } from "vitest";
import { legacyPreferenceQuestions, preferenceProfileVersion, preferenceQuestions } from "@/data/preferenceQuestions";
import type { ProfileQuestion, StoredAnswerRow } from "@/types/question";

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), update: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (table: string) => table === "user_answers" ? { upsert: mocks.upsert } : {
  select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { profile_experience_version: "preferences-v16", profile_completed: false } }) }) }),
  update: (value: unknown) => { mocks.update(value); return { eq: async () => ({ error: null }) }; },
} }) }));
vi.mock("@/lib/funnelAnalytics", () => ({ safelyRecordServerFunnelEvent: vi.fn(async () => undefined) }));
import { POST } from "./route";

function answersFor(questions: ProfileQuestion[]) {
  return questions.filter((question) => !question.optional).map((question): StoredAnswerRow => ({
    question_order: question.id,
    answer_value: question.type === "single_choice" ? typeof question.options?.[0] === "string" ? question.options[0] : question.options?.[0].value ?? null : null,
    answer_values: question.type === "multi_choice" ? [typeof question.options?.[0] === "string" ? question.options[0] : question.options?.[0].value ?? ""] : null,
    answer_text: question.type === "text" ? question.id === 17 ? "2000-02-29" : question.id === 36 ? "일본, 프랑스, 태국" : "테스트 답변" : null,
    other_text: null,
  }));
}
function request(answers: StoredAnswerRow[], questionnaireVersion?: string) {
  return new Request("http://localhost/api/profile/onboarding/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, questionnaireVersion, profile: { name: "테스트", gender: "여성" }, photoUrl: "https://example.com/test.jpg" }) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "test-user", phone: "+821000000000" } } });
  mocks.upsert.mockResolvedValue({ error: null });
});

describe("guest signup import compatibility", () => {
  it("saves new structured answers and completes signup without optional free text", async () => {
    const response = await POST(request(answersFor(preferenceQuestions), preferenceProfileVersion));
    expect(response.status).toBe(200);
    const saved = mocks.upsert.mock.calls[0][0] as Array<{ question_order: number }>;
    expect(saved.map((row) => row.question_order)).toContain(37);
    expect(saved.map((row) => row.question_order)).toContain(36);
    expect(saved.map((row) => row.question_order)).not.toContain(18);
    expect(saved).toContainEqual(expect.objectContaining({ question_order: 36, answer_text: "일본, 프랑스, 태국" }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ profile_experience_version: preferenceProfileVersion, questions_completed: true }));
  });
  it("still accepts a pre-deployment guest draft without a version field", async () => {
    const response = await POST(request(answersFor(legacyPreferenceQuestions)));
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ profile_experience_version: "preferences-v14" }));
  });
  it("rejects invalid preference ranges before writing answers", async () => {
    const answers = answersFor(preferenceQuestions);
    answers.find((row) => row.question_order === 32)!.answer_value = "range_7_1";
    expect((await POST(request(answers, preferenceProfileVersion))).status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("rejects a blank country answer before writing answers", async () => {
    const answers = answersFor(preferenceQuestions);
    answers.find((row) => row.question_order === 36)!.answer_text = "   ";
    expect((await POST(request(answers, preferenceProfileVersion))).status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("does not accept old required answers as a complete new questionnaire", async () => {
    expect((await POST(request(answersFor(legacyPreferenceQuestions), preferenceProfileVersion))).status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
