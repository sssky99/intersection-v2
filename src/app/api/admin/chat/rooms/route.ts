import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { loadAdminChatRooms } from "@/lib/adminChatRooms";
import type { AdminChatRoomsResponse } from "@/types/adminChat";

export const dynamic = "force-dynamic";

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

function unauthorized() {
  return NextResponse.json(
    { error: "관리자 인증이 필요합니다." },
    { status: 401 },
  );
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const { rooms, operatorConfigured } = await loadAdminChatRooms();
    const response: AdminChatRoomsResponse = {
      activeRooms: rooms.filter((room) => room.status === "active"),
      upcomingRooms: rooms.filter((room) => room.status === "upcoming"),
      operatorConfigured,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[admin chat rooms]", error);
    return NextResponse.json(
      { error: "채팅방 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
