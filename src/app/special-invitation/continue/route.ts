import { NextRequest, NextResponse } from "next/server";
import { findMembershipInvitation } from "@/lib/membershipInvitation";
import { membershipInvitationCookie } from "@/lib/membershipInvitationToken";
import { getAuthenticatedProfile, nextOnboardingPath } from "@/lib/onboarding";

export async function GET(request: NextRequest) {
  if (!await findMembershipInvitation(request.cookies.get(membershipInvitationCookie)?.value)) {
    return new NextResponse("초대 링크를 다시 확인해주세요.", { status: 404 });
  }
  const { user, profile } = await getAuthenticatedProfile();
  const path = user && profile ? nextOnboardingPath(profile) : "/onboarding/start";
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
