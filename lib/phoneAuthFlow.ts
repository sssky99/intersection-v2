export type PhoneAuthFailureCode =
  | "ACCOUNT_BLOCKED"
  | "OTP_SEND_FAILED"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_RATE_LIMITED"
  | "PROFILE_UNAUTHORIZED"
  | "PROFILE_INVALID_PHONE"
  | "PROFILE_LOOKUP_FAILED"
  | "PROFILE_CREATE_FAILED"
  | "PROFILE_RESPONSE_INVALID";

export class PhoneAuthError extends Error {
  constructor(public readonly code: PhoneAuthFailureCode) {
    super(code);
    this.name = "PhoneAuthError";
  }
}

export function otpFailureCode(message: string): PhoneAuthFailureCode {
  const normalized = message.toLowerCase();
  if (normalized.includes("banned") || normalized.includes("blocked")) {
    return "ACCOUNT_BLOCKED";
  }
  if (normalized.includes("rate") || normalized.includes("seconds")) return "OTP_RATE_LIMITED";
  if (normalized.includes("expired")) return "OTP_EXPIRED";
  return "OTP_INVALID";
}

export function otpSendFailureCode(message: string): PhoneAuthFailureCode {
  const normalized = message.toLowerCase();
  if (normalized.includes("banned") || normalized.includes("blocked")) {
    return "ACCOUNT_BLOCKED";
  }
  if (normalized.includes("rate") || normalized.includes("seconds")) {
    return "OTP_RATE_LIMITED";
  }
  return "OTP_SEND_FAILED";
}

export function phoneAuthErrorMessage(code: PhoneAuthFailureCode) {
  switch (code) {
    case "ACCOUNT_BLOCKED": return "오류가 발생했습니다.\n하단 카카오톡 채널로 문의해주세요.";
    case "OTP_RATE_LIMITED": return "잠시 후 다시 시도해주세요.";
    case "OTP_EXPIRED": return "인증 시간이 지났어요. 인증번호를 다시 요청해주세요.";
    case "OTP_INVALID": return "인증번호가 맞지 않아요. 다시 확인해주세요.";
    case "OTP_SEND_FAILED": return "인증번호를 보내지 못했어요. 잠시 후 다시 시도해주세요.";
    default: return "인증은 완료됐지만 계정 정보를 불러오지 못했어요.";
  }
}

export const profileRecoveryMessage = "인증이 완료됐어요. 계정 정보를 준비하고 있으니 잠시만 기다려주세요.";

export async function retryProfileSetup<T>(
  operation: () => Promise<T>,
  options: { timeoutMs?: number; intervalMs?: number } = {},
) {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 2_000;
  const startedAt = Date.now();
  let lastError: unknown = new PhoneAuthError("PROFILE_RESPONSE_INVALID");

  while (Date.now() - startedAt < timeoutMs) {
    const remaining = timeoutMs - (Date.now() - startedAt);
    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
    try {
      return await operation();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function isProfileSetupFailure(code: PhoneAuthFailureCode) {
  return code.startsWith("PROFILE_");
}

export function phoneAuthDestination(
  nextPath: string,
  completionPath?: string,
) {
  return completionPath || nextPath;
}
