import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { membershipInvitationHash, validMembershipInvitationToken } from "@/lib/membershipInvitationToken";

export async function findMembershipInvitation(token: unknown) {
  if (!validMembershipInvitationToken(token)) return null;
  const { data, error } = await createAdminClient({ timeoutMs: 5000 })
    .from("membership_invitations")
    .select("id,enabled,expires_at,max_redemptions,redeemed_count")
    .eq("token_hash", membershipInvitationHash(token))
    .maybeSingle<{ id: string; enabled: boolean; expires_at: string | null; max_redemptions: number | null; redeemed_count: number }>();
  if (error) throw new Error("Invitation lookup failed.");
  if (!data || !data.enabled || (data.expires_at && Date.parse(data.expires_at) <= Date.now()) ||
    (data.max_redemptions !== null && data.redeemed_count >= data.max_redemptions)) return null;
  return data;
}
