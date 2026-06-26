import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import type { User } from "@supabase/supabase-js";
import type { ProfileRow } from "@/types/profile";

export const OPERATOR_RETURN_SESSION_COOKIE =
  "inter_operator_return_session";
export const operatorReturnSessionTtlSeconds = 2 * 60 * 60;

export type OperatorReturnSession = {
  version: 1;
  operatorUserId: string;
  targetUserId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

function encryptionKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createHash("sha256")
    .update("intersection:operator-session-switch:v1:")
    .update(serviceRoleKey)
    .digest();
}

export function encryptOperatorReturnSession(
  value: Omit<OperatorReturnSession, "version" | "expiresAt">,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const payload: OperatorReturnSession = {
    ...value,
    version: 1,
    expiresAt: Date.now() + operatorReturnSessionTtlSeconds * 1000,
  };
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

export function decryptOperatorReturnSession(
  token: string | null | undefined,
) {
  if (!token) return null;

  try {
    const value = Buffer.from(token, "base64url");
    if (value.length <= 28) return null;

    const iv = value.subarray(0, 12);
    const authTag = value.subarray(12, 28);
    const encrypted = value.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(authTag);
    const payload = JSON.parse(
      Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString("utf8"),
    ) as Partial<OperatorReturnSession>;

    if (
      payload.version !== 1 ||
      typeof payload.operatorUserId !== "string" ||
      typeof payload.targetUserId !== "string" ||
      typeof payload.accessToken !== "string" ||
      typeof payload.refreshToken !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }

    return payload as OperatorReturnSession;
  } catch {
    return null;
  }
}

export function isOperatorAccount(
  user: Pick<User, "id" | "app_metadata">,
  profile: Pick<
    ProfileRow,
    "user_id" | "provider" | "is_test_participant"
  >,
) {
  return Boolean(
    user.id === profile.user_id &&
      user.app_metadata?.operator_profile === true &&
      profile.provider === "kakao" &&
      profile.is_test_participant === true,
  );
}

export const operatorReturnSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: operatorReturnSessionTtlSeconds,
};
