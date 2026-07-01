import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GatheringTicket } from "@/types/ticket";
import {
  isTicketRejectionReasonId,
  ticketRejectionReasonIds,
  ticketRejectionReasonLabels,
  type TicketRejectionReasonId,
} from "@/types/ticketRejection";

export const dynamic = "force-dynamic";

type TicketRejectionRow = {
  id: string;
  user_id: string;
  ticket_instance_id: string;
  ticket_template_id: string | null;
  reason: string;
  replacement_ticket_instance_id: string | null;
  replacement_ticket_template_id: string | null;
  ticket_snapshot: Partial<GatheringTicket> | null;
  replacement_ticket_snapshot: Partial<GatheringTicket> | null;
  created_at: string;
};

type AdminProfileRow = {
  user_id: string;
  name: string | null;
  nickname: string | null;
};

type TicketInstanceRow = {
  id: string;
  title: string | null;
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

function uniqueText(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function profileName(profile: AdminProfileRow | null | undefined, userId: string) {
  return (
    profile?.name?.trim() ||
    profile?.nickname?.trim() ||
    `사용자 ${userId.slice(0, 8)}`
  );
}

function ticketTitle(
  snapshot: Partial<GatheringTicket> | null | undefined,
  instance: TicketInstanceRow | null | undefined,
  fallback: string,
) {
  return snapshot?.title?.trim() || instance?.title?.trim() || fallback;
}

function reasonId(value: string): TicketRejectionReasonId | null {
  return isTicketRejectionReasonId(value) ? value : null;
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ticket_rejections")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const rows = (data ?? []) as TicketRejectionRow[];
    const userIds = uniqueText(rows.map((row) => row.user_id));
    const instanceIds = uniqueText([
      ...rows.map((row) => row.ticket_instance_id),
      ...rows.map((row) => row.replacement_ticket_instance_id),
    ]);

    let profiles: AdminProfileRow[] = [];
    if (userIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id,name,nickname")
        .in("user_id", userIds);
      if (profileError) throw profileError;
      profiles = (profileData ?? []) as AdminProfileRow[];
    }

    let instances: TicketInstanceRow[] = [];
    if (instanceIds.length > 0) {
      const { data: instanceData, error: instanceError } = await supabase
        .from("ticket_instances")
        .select("id,title")
        .in("id", instanceIds);
      if (instanceError) throw instanceError;
      instances = (instanceData ?? []) as TicketInstanceRow[];
    }

    const profileMap = new Map(
      profiles.map((profile) => [profile.user_id, profile]),
    );
    const instanceMap = new Map(
      instances.map((instance) => [instance.id, instance]),
    );
    const countMap = new Map<TicketRejectionReasonId, number>(
      ticketRejectionReasonIds.map((id) => [id, 0]),
    );

    const rejections = rows.map((row) => {
      const id = reasonId(row.reason);
      if (id) countMap.set(id, (countMap.get(id) ?? 0) + 1);

      return {
        id: row.id,
        userId: row.user_id,
        userName: profileName(profileMap.get(row.user_id), row.user_id),
        reason: row.reason,
        reasonLabel: id ? ticketRejectionReasonLabels[id] : row.reason,
        originalTicketTitle: ticketTitle(
          row.ticket_snapshot,
          instanceMap.get(row.ticket_instance_id),
          row.ticket_instance_id,
        ),
        replacementTicketTitle: row.replacement_ticket_instance_id
          ? ticketTitle(
              row.replacement_ticket_snapshot,
              instanceMap.get(row.replacement_ticket_instance_id),
              row.replacement_ticket_instance_id,
            )
          : "추천 없음",
        createdAt: row.created_at,
      };
    });

    const total = rows.length;
    const stats = ticketRejectionReasonIds.map((id) => ({
      reason: id,
      reasonLabel: ticketRejectionReasonLabels[id],
      count: countMap.get(id) ?? 0,
      ratio: total > 0 ? Math.round(((countMap.get(id) ?? 0) / total) * 100) : 0,
    }));

    return NextResponse.json({ rejections, stats, total });
  } catch (error) {
    console.error("[admin ticket rejections]", error);
    return NextResponse.json(
      { error: "거절 사유 데이터를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
