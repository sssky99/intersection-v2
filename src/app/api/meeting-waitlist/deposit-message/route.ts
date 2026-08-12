import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function removed() {
  return NextResponse.json(
    { error: "Deposit processing is no longer supported." },
    { status: 410 },
  );
}

export async function GET() {
  return removed();
}

export async function POST() {
  return removed();
}
