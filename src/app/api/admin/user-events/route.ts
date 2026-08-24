import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminSessionTokenValid(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "Raw visitor-event analysis has been retired. Use the funnel facts dashboard.",
      code: "RAW_EVENT_ANALYSIS_RETIRED",
    },
    { status: 410, headers: { "Cache-Control": "private, no-store" } },
  );
}
