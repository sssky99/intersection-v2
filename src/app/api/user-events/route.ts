import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Emergency circuit breaker: older browser bundles can keep posting analytics
// after a deployment. Finish those requests immediately without auth or DB I/O.
export async function POST() {
  return new NextResponse(null, { status: 204 });
}
