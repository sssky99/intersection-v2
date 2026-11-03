import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { findMembershipInvitation } from "@/lib/membershipInvitation";
import { membershipInvitationCookie } from "@/lib/membershipInvitationToken";
import { SpecialInvitationLanding } from "@/features/invitations/SpecialInvitationLanding";

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function SpecialInvitationPage() {
  const token = (await cookies()).get(membershipInvitationCookie)?.value;
  if (!await findMembershipInvitation(token)) notFound();
  return <SpecialInvitationLanding preview={false} />;
}
