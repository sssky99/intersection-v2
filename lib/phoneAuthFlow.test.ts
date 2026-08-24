import { describe, expect, it } from "vitest";
import {
  isProfileSetupFailure,
  otpFailureCode,
  otpSendFailureCode,
  phoneAuthDestination,
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

  it("shows a neutral login error for blocked accounts", () => {
    expect(otpFailureCode("User is banned")).toBe("ACCOUNT_BLOCKED");
    expect(phoneAuthErrorMessage("ACCOUNT_BLOCKED")).toBe(
      "오류가 발생했습니다.\n하단 카카오톡 채널로 문의해주세요.",
    );
  });

  it("does not present OTP delivery failures as an invalid verification code", () => {
    expect(otpSendFailureCode("context deadline exceeded")).toBe("OTP_SEND_FAILED");
    expect(otpSendFailureCode("AuthRetryableFetchError: 504")).toBe("OTP_SEND_FAILED");
    expect(otpSendFailureCode("SMS rate limit exceeded")).toBe("OTP_RATE_LIMITED");
    expect(otpSendFailureCode("User is banned")).toBe("ACCOUNT_BLOCKED");
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

  it("keeps the guest-answer import destination after authentication", () => {
    expect(
      phoneAuthDestination(
        "/onboarding/questions?start=1",
        "/onboarding/import",
      ),
    ).toBe("/onboarding/import");
  });

  it("uses the profile destination for a regular login", () => {
    expect(phoneAuthDestination("/meetings?tab=browse")).toBe(
      "/meetings?tab=browse",
    );
  });
});
