import { beforeEach, describe, expect, it, vi } from "vitest";
import { localSignupQuestions, signupQuestionnaireVersion } from "@/data/localSignupQuestions";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/funnelAnalytics", () => ({ safelyRecordServerFunnelEvent: vi.fn() }));
const answers = localSignupQuestions.filter(q => !q.optional).map(q => ({
  question_order: q.id, answer_text: q.inputKind === "name" ? "김테스트" : q.inputKind === "birthday" ? "2000-02-29" : null,
  answer_value: q.type === "single_choice" ? q.options![0] : null,
  answer_values: q.type === "multi_choice" ? [q.inputKind === "searchable_choices" ? "직접 입력" : q.options![0]] : null,
}));
function request(rows = answers, version = signupQuestionnaireVersion as string) {
  return new Request("http://localhost/api/profile/onboarding/import", {method: "POST", body: JSON.stringify({ answers: rows, questionnaireVersion: version })});
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "member", phone: "+821000000000", phone_confirmed_at: "2026-11-23" } } });
  mocks.rpc.mockResolvedValue({data: true});
});
describe("signup after phone verification", () => {
  it("stores custom choices, basic details and a type without requiring a photo or MBTI", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("complete_signup_v17", expect.objectContaining({
      p_phone:"01000000000", p_name:"김테스트", p_gender:"남성", p_birth_date:"2000-02-29",
      p_type:(await response.json()).profileArchetypeId,
      p_answers:expect.arrayContaining([expect.objectContaining({question_order:2019, answer_values:["직접 입력"]})]),
    }));
  });
  it("requires a verified phone before saving", async () => {
    mocks.getUser.mockResolvedValue({data:{user:{id:"member",phone:"+821000000000"}}});
    expect((await POST(request())).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects old drafts, missing required answers and invalid dates", async () => {
    for (const req of [request(answers,"preferences-v16"),request(answers.slice(1)),request(answers.map(r => r.question_order === 2029 ? {...r,answer_text:"2000-02-31"} : r))]) {
      expect((await POST(req)).status).toBe(400);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserves an existing completed account", async () => {
    mocks.rpc.mockResolvedValue({data:false});
    expect((await POST(request())).status).toBe(409);
  });
});
