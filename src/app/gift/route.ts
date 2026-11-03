import { NextRequest } from "next/server";
import { membershipInvitationEntry } from "@/lib/membershipInvitationEntry";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return membershipInvitationEntry(request, process.env.MEMBERSHIP_INVITATION_SHORT_LINK_TOKEN?.trim());
}
