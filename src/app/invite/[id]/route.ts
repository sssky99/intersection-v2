import { NextRequest, NextResponse } from "next/server";
import { normalizeFriendInvitationId, pendingFriendInvitationCookie, receivedFriendInvitationPath } from "@/lib/friendInvitationLink";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const id = normalizeFriendInvitationId((await context.params).id);
  if (!id) return new NextResponse("초대 링크를 확인해 주세요.", { status: 404 });
  const response = NextResponse.redirect(new URL(receivedFriendInvitationPath(id), request.url));
  response.headers.set("Cache-Control", "no-store");
  // Carry the invitation through sign-in and onboarding without exposing profile data.
  response.cookies.set(pendingFriendInvitationCookie, id, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 7 * 24 * 60 * 60 });
  return response;
}
