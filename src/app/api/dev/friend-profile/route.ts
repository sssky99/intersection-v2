import { NextResponse } from "next/server";

// Retired: a typed phone number must never unlock a profile photo.
export async function POST() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
