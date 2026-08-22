import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type LoginBlockRow = {
  phone_normalized: string;
  display_name: string | null;
  user_id: string | null;
  reason: string | null;
  blocked_at: string;
  created_at: string;
  updated_at: string;
};

export function normalizeLoginPhone(value: unknown) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("8210") ? `0${digits.slice(2)}` : digits;
  return /^010\d{8}$/.test(local) ? local : null;
}

export async function findLoginBlock({
  userId,
  phone,
}: {
  userId?: string | null;
  phone?: string | null;
}) {
  const normalizedPhone = normalizeLoginPhone(phone);
  const filters = [
    userId ? `user_id.eq.${userId}` : null,
    normalizedPhone ? `phone_normalized.eq.${normalizedPhone}` : null,
  ].filter((value): value is string => Boolean(value));

  if (filters.length === 0) return null;

  const { data, error } = await createAdminClient()
    .from("login_blocklist")
    .select(
      "phone_normalized,display_name,user_id,reason,blocked_at,created_at,updated_at",
    )
    .or(filters.join(","))
    .limit(1)
    .maybeSingle<LoginBlockRow>();

  if (error) throw error;
  return data ?? null;
}

export async function addLoginBlock({
  phone,
  displayName,
  reason,
}: {
  phone: string;
  displayName?: string | null;
  reason?: string | null;
}) {
  const phoneNormalized = normalizeLoginPhone(phone);
  if (!phoneNormalized) throw new Error("Invalid phone number.");

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("user_id,name")
    .eq("phone_normalized", phoneNormalized)
    .is("archived_at", null)
    .maybeSingle<{ user_id: string; name: string | null }>();
  if (profileError) throw profileError;

  const now = new Date().toISOString();
  const { data: block, error: blockError } = await admin
    .from("login_blocklist")
    .upsert(
      {
        phone_normalized: phoneNormalized,
        display_name: displayName?.trim() || profile?.name?.trim() || null,
        user_id: profile?.user_id ?? null,
        reason: reason?.trim() || null,
        blocked_at: now,
        updated_at: now,
      },
      { onConflict: "phone_normalized" },
    )
    .select(
      "phone_normalized,display_name,user_id,reason,blocked_at,created_at,updated_at",
    )
    .single<LoginBlockRow>();
  if (blockError) throw blockError;

  if (profile?.user_id) {
    const { error: banError } = await admin.auth.admin.updateUserById(
      profile.user_id,
      { ban_duration: "876000h" },
    );
    if (banError) throw banError;
  }

  return block;
}

export async function removeLoginBlock(phone: string) {
  const phoneNormalized = normalizeLoginPhone(phone);
  if (!phoneNormalized) throw new Error("Invalid phone number.");

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("login_blocklist")
    .select("user_id")
    .eq("phone_normalized", phoneNormalized)
    .maybeSingle<{ user_id: string | null }>();
  if (lookupError) throw lookupError;

  if (existing?.user_id) {
    const { error: unbanError } = await admin.auth.admin.updateUserById(
      existing.user_id,
      { ban_duration: "none" },
    );
    if (unbanError) throw unbanError;
  }

  const { error: deleteError } = await admin
    .from("login_blocklist")
    .delete()
    .eq("phone_normalized", phoneNormalized);
  if (deleteError) throw deleteError;
}
