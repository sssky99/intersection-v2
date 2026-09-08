import { describe, expect, it, vi, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { friendSmsDelivered, sendFriendSms, solapiAuthorization } from "./solapi";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("SOLAPI friend invitations", () => {
  it("signs requests using server credentials", () => {
    const date = "2026-09-08T00:00:00.000Z";
    const signature = createHmac("sha256", "secret").update(date + "salt").digest("hex");
    expect(solapiAuthorization("key", "secret", date, "salt")).toBe(`HMAC-SHA256 apiKey=key, date=${date}, salt=salt, signature=${signature}`);
  });
  it("never treats queued, failed, or another recipient's delivery as success", () => {
    const base = { to: "01000000001", from: "01000000002" };
    for (const statusCode of ["2000", "3000", "5000", undefined]) expect(friendSmsDelivered({ ...base, statusCode }, base.to, base.from)).toBe(false);
    expect(friendSmsDelivered({ ...base, statusCode: "4000" }, "01000000003", base.from)).toBe(false);
    expect(friendSmsDelivered({ ...base, statusCode: "4000" }, base.to, "01000000003")).toBe(false);
    expect(friendSmsDelivered({ ...base, statusCode: "4000" }, base.to, base.from)).toBe(true);
  });
  it("does not retry a send with an uncertain outcome", async () => {
    vi.stubEnv("SOLAPI_API_KEY", "key"); vi.stubEnv("SOLAPI_API_SECRET", "secret"); vi.stubEnv("SOLAPI_SENDER_NUMBER", "01000000002");
    const fetchMock = vi.fn().mockRejectedValue(new Error("timeout")); vi.stubGlobal("fetch", fetchMock);
    await expect(sendFriendSms("01000000001", "test", "invitation")).rejects.toThrow("timeout");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
