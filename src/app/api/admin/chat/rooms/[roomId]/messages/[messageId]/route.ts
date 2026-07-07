import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ roomId: string; messageId: string }>;
};

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

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const { roomId, messageId } = await context.params;
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("meeting_chat_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", messageId)
      .eq("ticket_instance_id", roomId)
      .is("deleted_at", null);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin chat delete]", error);
    return NextResponse.json(
      { error: "메시지를 숨기지 못했습니다." },
      { status: 500 },
    );
  }
}
