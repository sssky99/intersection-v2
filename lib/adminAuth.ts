import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "inter_admin_session";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function adminAccessKey() {
  return process.env.ADMIN_ACCESS_KEY?.trim() || null;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function signSessionPayload(payload: string) {
  const secret = adminAccessKey();
  if (!secret) return null;

  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyAdminAccessKey(input: string) {
  const configuredKey = adminAccessKey();
  if (!configuredKey) {
    return { ok: false, reason: "missing-key" as const };
  }

  return {
    ok: safeEqual(input.trim(), configuredKey),
    reason: "checked" as const,
  };
}

export function createAdminSessionToken() {
  const issuedAt = Date.now().toString();
  const payload = `v1.${issuedAt}`;
  const signature = signSessionPayload(payload);

  if (!signature) return null;
  return `${payload}.${signature}`;
}

export function isAdminSessionTokenValid(token: string | undefined | null) {
  if (!token) return false;

  const [version, issuedAt, signature] = token.split(".");
  if (version !== "v1" || !issuedAt || !signature) return false;

  const timestamp = Number(issuedAt);
  if (!Number.isFinite(timestamp)) return false;
  if (Date.now() - timestamp > SESSION_TTL_MS) return false;

  const expectedSignature = signSessionPayload(`${version}.${issuedAt}`);
  if (!expectedSignature) return false;

  return safeEqual(signature, expectedSignature);
}
