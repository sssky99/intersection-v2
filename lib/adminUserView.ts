import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createClient } from "@/lib/supabase/server";

export const ADMIN_USER_VIEW_COOKIE = "inter_admin_user_view";
export const adminUserViewTtlSeconds = 30 * 60;

export type AdminUserViewSession = {
  version: 1;
  viewId: string;
  targetUserId: string;
  targetName: string;
  expiresAt: number;
};

function encryptionKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createHash("sha256")
    .update("intersection:admin-user-view:v1:")
    .update(serviceRoleKey)
    .digest();
}

export function encryptAdminUserViewSession(
  value: Omit<AdminUserViewSession, "version" | "expiresAt">,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const payload: AdminUserViewSession = {
    ...value,
    version: 1,
    expiresAt: Date.now() + adminUserViewTtlSeconds * 1000,
  };
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}

export function decryptAdminUserViewSession(
  token: string | null | undefined,
) {
  if (!token) return null;

  try {
    const value = Buffer.from(token, "base64url");
    if (value.length <= 28) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      value.subarray(0, 12),
    );
    decipher.setAuthTag(value.subarray(12, 28));
    const payload = JSON.parse(
      Buffer.concat([
        decipher.update(value.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    ) as Partial<AdminUserViewSession>;

    if (
      payload.version !== 1 ||
      typeof payload.viewId !== "string" ||
      typeof payload.targetUserId !== "string" ||
      typeof payload.targetName !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }

    return payload as AdminUserViewSession;
  } catch {
    return null;
  }
}

export const adminUserViewCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: adminUserViewTtlSeconds,
};

export async function currentAdminUserView() {
  const cookieStore = await cookies();
  if (
    !isAdminSessionTokenValid(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
  ) {
    return null;
  }

  return decryptAdminUserViewSession(
    cookieStore.get(ADMIN_USER_VIEW_COOKIE)?.value,
  );
}

export async function requestUserId(options?: { allowAdminView?: boolean }) {
  if (options?.allowAdminView) {
    const view = await currentAdminUserView();
    if (view) return { userId: view.targetUserId, readOnly: true as const };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { userId: user.id, readOnly: false as const } : null;
}
