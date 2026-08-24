import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/loginBlocklist", () => ({
  normalizeLoginPhone: (value: unknown) =>
    typeof value === "string" && /^010\d{8}$/.test(value) ? value : null,
}));
vi.mock("@/lib/requestGuards", () => ({
  isSameOriginRequest: vi.fn(() => true),
  requestActorKey: vi.fn(() => "phone-prepare-test"),
}));

function phoneRequest(phone = "01012345678") {
  return new NextRequest("https://interv2.netlify.app/api/auth/phone/prepare", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone }),
  });
}

describe("POST /api/auth/phone/prepare", () => {
  beforeEach(() => vi.resetModules());

  it("validates the phone without waiting for a blocklist query", async () => {
    const { POST } = await import("./route");
    const response = await POST(phoneRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("rejects an invalid phone before OTP", async () => {
    const { POST } = await import("./route");
    const response = await POST(phoneRequest("1234"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid phone" });
  });
});
