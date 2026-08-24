import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findLoginBlockMock = vi.fn();

vi.mock("@/lib/loginBlocklist", () => ({
  findLoginBlock: findLoginBlockMock,
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
  beforeEach(() => {
    findLoginBlockMock.mockReset();
    findLoginBlockMock.mockResolvedValue(null);
  });

  it("checks the blocklist only after validating the phone", async () => {
    const { POST } = await import("./route");
    const response = await POST(phoneRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(findLoginBlockMock).toHaveBeenCalledWith({ phone: "01012345678" });
  });

  it("rejects a blocked phone before sending an OTP", async () => {
    findLoginBlockMock.mockResolvedValue({ phone_normalized: "01012345678" });
    const { POST } = await import("./route");
    const response = await POST(phoneRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ errorCode: "ACCOUNT_BLOCKED" });
  });

  it("keeps OTP available when the optional blocklist lookup fails", async () => {
    findLoginBlockMock.mockRejectedValue(new Error("temporary blocklist outage"));
    const { POST } = await import("./route");
    const response = await POST(phoneRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
