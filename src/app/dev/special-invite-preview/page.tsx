import { notFound } from "next/navigation";
import { SpecialInvitationLanding } from "@/features/invitations/SpecialInvitationLanding";

export default function SpecialInvitePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SpecialInvitationLanding />;
}
