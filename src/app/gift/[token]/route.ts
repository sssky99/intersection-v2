import { NextRequest } from "next/server";
import { membershipInvitationEntry } from "@/lib/membershipInvitationEntry";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return membershipInvitationEntry(request, token);
}
