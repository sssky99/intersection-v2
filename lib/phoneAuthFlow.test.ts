import { describe, expect, it } from "vitest";
import {
  isProfileSetupFailure,
  otpFailureCode,
  phoneAuthErrorMessage,
  profileRecoveryMessage,
  retryProfileSetup,
} from "./phoneAuthFlow";

describe("phone authentication failures", () => {
  it("keeps an invalid OTP distinct from profile setup failures", () => {
    expect(otpFailureCode("Token has expired")).toBe("OTP_EXPIRED");
    expect(otpFailureCode("Invalid token")).toBe("OTP_INVALID");
    expect(isProfileSetupFailure("OTP_INVALID")).toBe(false);
    expect(isProfileSetupFailure("PROFILE_LOOKUP_FAILED")).toBe(true);
  });

  it("does not tell an authenticated user that the OTP was wrong", () => {
    expect(phoneAuthErrorMessage("OTP_INVALID")).toContain("인증번호가 맞지 않아요");
    expect(phoneAuthErrorMessage("PROFILE_CREATE_FAILED")).toContain("인증은 완료됐지만");
  });

  it("retries profile setup during the waiting period", async () => {
    let attempts = 0;
    const result = await retryProfileSetup(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("temporary");
      return "ready";
    }, { timeoutMs: 50, intervalMs: 1 });

    expect(result).toBe("ready");
    expect(attempts).toBe(3);
    expect(profileRecoveryMessage).toContain("잠시만 기다려주세요");
  });

  it("stops retrying after the waiting period", async () => {
    await expect(retryProfileSetup(
      async () => { throw new Error("still unavailable"); },
      { timeoutMs: 5, intervalMs: 1 },
    )).rejects.toThrow("still unavailable");
  });
});
