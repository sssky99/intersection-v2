import { createHash } from "node:crypto";

export const membershipInvitationCookie = "inter_membership_invitation";
export const membershipInvitationMaxAge = 30 * 24 * 60 * 60;

export function validMembershipInvitationToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function membershipInvitationHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
