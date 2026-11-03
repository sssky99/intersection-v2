import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { membershipInvitationCookie, membershipInvitationHash, validMembershipInvitationToken } from "@/lib/membershipInvitationToken";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const token = request.cookies.get(membershipInvitationCookie)?.value;
  if (!validMembershipInvitationToken(token)) {
    const response = NextResponse.json({ outcome: "no_invitation" });
    if (token) response.cookies.delete(membershipInvitationCookie);
    return response;
  }
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  // Identity and invitation come from trusted session/cookies, never the request body.
  const { data, error } = await createAdminClient({ timeoutMs: 8000 }).rpc("claim_membership_invitation", {
    p_user_id: user.id, p_token_hash: membershipInvitationHash(token),
  });
  if (error || !data) {
    console.error("Membership invitation claim failed", error?.code);
    return NextResponse.json({ error: "초대 혜택을 적용하지 못했어요. 다시 시도해주세요." }, { status: 503 });
  }
  const response = NextResponse.json(data);
  response.headers.set("Cache-Control", "no-store");
  if (data.outcome !== "profile_incomplete") response.cookies.delete(membershipInvitationCookie);
  return response;
}
