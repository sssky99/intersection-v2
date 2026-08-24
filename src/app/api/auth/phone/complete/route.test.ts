import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();
const findLoginBlockMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));
vi.mock("@/lib/loginBlocklist", () => ({
  findLoginBlock: findLoginBlockMock,
}));
vi.mock("@/lib/onboarding", () => ({
  nextOnboardingPath: vi.fn((profile: { profile_completed?: boolean }) =>
    profile.profile_completed ? "/meetings?tab=recommend" : "/onboarding/questions",
  ),
}));
vi.mock("@/data/preferenceQuestions", () => ({
  preferenceProfileVersion: "preferences-v14",
}));

function queryResult(result: unknown): Record<string, ReturnType<typeof vi.fn>> {
  const query: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };
  return query;
}

describe("POST /api/auth/phone/complete", () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockReset();
    findLoginBlockMock.mockReset();
    findLoginBlockMock.mockResolvedValue(null);
  });

  it("ends the session when an existing account is blocked", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    findLoginBlockMock.mockResolvedValue({ phone_normalized: "01012345678" });
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "user-blocked", phone: "+821012345678" } } })),
        signOut,
      },
    });

    const { POST } = await import("./route");
    const response = await POST();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ errorCode: "ACCOUNT_BLOCKED" });
    expect(findLoginBlockMock).toHaveBeenCalledWith({
      userId: "user-blocked",
      phone: "+821012345678",
      timeoutMs: 500,
    });
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("continues an existing account without creating another profile", async () => {
    const existing = { user_id: "user-1", profile_completed: true };
    const profiles = queryResult({ data: existing, error: null });
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1", phone: "+821012345678" } } })) },
      from: vi.fn(() => profiles),
    });
    const { POST } = await import("./route");
    const response = await POST();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ loginType: "existing", nextPath: "/meetings?tab=browse" });
  });

  it("treats an incomplete existing account as resumable onboarding", async () => {
    const existing = { user_id: "user-incomplete", profile_completed: false };
    const profiles = queryResult({ data: existing, error: null });
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-incomplete", phone: "+821012345678" } } })) },
      from: vi.fn(() => profiles),
    });
    const { POST } = await import("./route");
    const response = await POST();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ loginType: "new", nextPath: "/onboarding/questions" });
  });

  it("creates a new profile after OTP authentication", async () => {
    const created = { user_id: "user-2", profile_completed: false };
    const lookup = queryResult({ data: null, error: null });
    const insert = queryResult({ data: created, error: null });
    insert.insert = vi.fn(() => insert);
    let call = 0;
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-2", phone: "+821012345678" } } })) },
      from: vi.fn(() => (++call === 1 ? lookup : insert)),
    });
    const { POST } = await import("./route");
    const response = await POST();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ loginType: "new", nextPath: "/onboarding/questions" });
  });

  it("returns a retryable profile error instead of an OTP error", async () => {
    const lookup = queryResult({ data: null, error: { code: "TEMPORARY" } });
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-3", phone: "+821012345678" } } })) },
      from: vi.fn(() => lookup),
    });
    const { POST } = await import("./route");
    const response = await POST();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ errorCode: "PROFILE_LOOKUP_FAILED" });
  });
});
