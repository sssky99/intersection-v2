import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { loadAdminChatRooms } from "@/lib/adminChatRooms";
import { chatOperatorUserId } from "@/lib/chatOperator";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminChatMessagesResponse } from "@/types/adminChat";
import type { MeetingChatMessage, MeetingChatRead } from "@/types/chat";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

const messageSelect = [
  "id",
  "ticket_instance_id",
  "sender_id",
  "body",
  "deleted_at",
  "created_at",
].join(",");

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

async function roomIdFromContext(context: RouteContext) {
  const params = await context.params;
  return params.roomId;
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const roomId = await roomIdFromContext(context);
    const supabase = createAdminClient();
    const { rooms, operatorConfigured } = await loadAdminChatRooms({
      roomId,
      supabase,
    });
    const room = rooms[0] ?? null;

    if (!room) {
      return NextResponse.json(
        { error: "채팅방을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const [messagesResult, readsResult] = await Promise.all([
      supabase
        .from("meeting_chat_messages")
        .select(messageSelect)
        .eq("ticket_instance_id", roomId)
        .order("created_at", { ascending: true })
        .limit(500)
        .returns<MeetingChatMessage[]>(),
      supabase
        .from("meeting_chat_reads")
        .select("ticket_instance_id,user_id,last_read_at")
        .eq("ticket_instance_id", roomId)
        .returns<MeetingChatRead[]>(),
    ]);

    const error = messagesResult.error ?? readsResult.error;
    if (error) throw error;

    const response: AdminChatMessagesResponse = {
      room,
      messages: messagesResult.data ?? [],
      reads: readsResult.data ?? [],
      operatorConfigured,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[admin chat messages]", error);
    return NextResponse.json(
      { error: "채팅 내역을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminRequest(request)) return unauthorized();

  const operatorId = chatOperatorUserId();
  if (!operatorId) {
    return NextResponse.json(
      { error: "CHAT_OPERATOR_USER_ID가 설정되어 있지 않습니다." },
      { status: 500 },
    );
  }

  let body = "";
  try {
    const payload = (await request.json()) as { body?: unknown };
    body = typeof payload.body === "string" ? payload.body.trim() : "";
  } catch {
    body = "";
  }

  if (body.length === 0 || body.length > 100) {
    return NextResponse.json(
      { error: "메시지는 1자 이상 100자 이하로 입력해 주세요." },
      { status: 400 },
    );
  }

  try {
    const roomId = await roomIdFromContext(context);
    const supabase = createAdminClient();
    const { rooms } = await loadAdminChatRooms({ roomId, supabase });
    const room = rooms[0] ?? null;

    if (!room) {
      return NextResponse.json(
        { error: "채팅방을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (room.status !== "active") {
      return NextResponse.json(
        { error: "아직 활성화되지 않은 채팅방입니다." },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("meeting_chat_messages")
      .insert({
        ticket_instance_id: roomId,
        sender_id: operatorId,
        body,
      })
      .select(messageSelect)
      .single<MeetingChatMessage>();

    if (error) throw error;

    return NextResponse.json({ message: data });
  } catch (error) {
    console.error("[admin chat send]", error);
    return NextResponse.json(
      { error: "운영자 메시지를 보내지 못했습니다." },
      { status: 500 },
    );
  }
}
