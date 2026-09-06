import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { loadWaitlistData } from "@/server/waitlist/readWaitlist";
import { executeWaitlistCommand, waitlistCommandError } from "@/server/waitlist/commands";

export const dynamic = "force-dynamic";

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}
function unauthorized() {
  return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
}
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    return NextResponse.json(await loadWaitlistData());
  } catch (error) {
    console.error("Admin waitlist load failed:", error);
    return NextResponse.json({ error: "대기열 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}
export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const result = await executeWaitlistCommand(await request.json().catch(() => null));
    return NextResponse.json({ ...(await loadWaitlistData()), ...result });
  } catch (error) {
    const failure = waitlistCommandError(error);
    if (failure.status === 500) console.error("Admin waitlist update failed:", error);
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
