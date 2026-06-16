import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "현재 운영 플로우에서는 사용하지 않는 기능입니다." },
    { status: 410 },
  );
}
