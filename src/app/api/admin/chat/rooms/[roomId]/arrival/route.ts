import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TicketArrivalStatus } from "@/types/ticket";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ roomId: string }> };
type AdminArrivalSelection = "pending" | "on_time" | "late" | "no_show";

const selections = new Set<AdminArrivalSelection>([
  "pending",
  "on_time",
  "late",
  "no_show",
]);

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { error: "관리자 인증이 필요합니다." },
      { status: 401 },
    );
  }

  const { roomId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    participationId?: unknown;
    status?: unknown;
  } | null;
  const participationId = String(body?.participationId ?? "").trim();
  const status = body?.status;

  if (
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(roomId) ||
    !/^[1-9]\d{0,18}$/.test(participationId) ||
    typeof status !== "string" ||
    !selections.has(status as AdminArrivalSelection)
  ) {
    return NextResponse.json({ error: "잘못된 도착 상태입니다." }, { status: 400 });
  }

  const selected = status as AdminArrivalSelection;
  const arrivalStatus: TicketArrivalStatus | null =
    selected === "pending"
      ? null
      : selected === "late"
        ? "late_10"
        : selected;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("record_admin_meeting_arrival", {
      p_participation_id: participationId,
      p_room_id: roomId,
      p_arrival_status: arrivalStatus,
    });

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "해당 그룹 멤버를 찾지 못했습니다." }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[admin room arrival]", error);
    return NextResponse.json(
      { error: "도착 상태를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
