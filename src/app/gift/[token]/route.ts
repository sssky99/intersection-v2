import { NextRequest, NextResponse } from "next/server";
import { findMembershipInvitation } from "@/lib/membershipInvitation";
import { membershipInvitationCookie, membershipInvitationMaxAge } from "@/lib/membershipInvitationToken";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await findMembershipInvitation(token);
  if (!invitation) return new NextResponse("유효하지 않거나 종료된 초대장이에요.", { status: 404, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  const response = NextResponse.redirect(new URL("/special-invitation", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(membershipInvitationCookie, token, {
    httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: membershipInvitationMaxAge,
  });
  return response;
}
