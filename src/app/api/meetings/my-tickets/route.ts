import { requestUserId } from "@/lib/adminUserView";
import { NextResponse } from "next/server";
import { loadUserTickets } from "../../../../server/meetings/readUserTickets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUser = await requestUserId({
    allowAdminView: true,
    timeoutMs: 3000,
  }).catch((error: unknown) => {
    console.error("[meetings my-tickets] user lookup timed out", error);
    return undefined;
  });
  if (requestUser === undefined) {
    return NextResponse.json(
      { error: "내 티켓 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 503, headers: { "Retry-After": "3" } },
    );
  }
  if (!requestUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = requestUser.userId;

  return loadUserTickets(request, userId);
}
