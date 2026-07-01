import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { GatheringTicket, TicketArrivalStatus } from "@/types/ticket";

export const dynamic = "force-dynamic";

type ArrivalRequest = {
  waitlistId?: string;
  arrivalStatus?: TicketArrivalStatus;
};

type WaitlistRow = {
  id: number | string;
  user_id: string;
  status: string;
  ticket_id: string;
  ticket_instance_id: string | null;
  ticket_snapshot: GatheringTicket | null;
};

type InstanceRow = {
  id: string;
  event_date: string | null;
  event_time: string | null;
};

const arrivalStatuses = new Set<TicketArrivalStatus>([
  "on_time",
  "late_10",
  "late_20",
  "late_30_plus",
]);

function toStartAt(date: string | null | undefined, time: string | null | undefined) {
  if (!date) return null;
  const normalizedTime = time?.slice(0, 5) || "00:00";
  const start = new Date(`${date}T${normalizedTime}:00+09:00`);
  return Number.isFinite(start.getTime()) ? start : null;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export async function POST(request: Request) {
  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ArrivalRequest | null;
  const waitlistId = body?.waitlistId?.trim();
  const arrivalStatus = body?.arrivalStatus;

  if (!waitlistId || !arrivalStatus || !arrivalStatuses.has(arrivalStatus)) {
    return NextResponse.json({ error: "Invalid arrival status." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data: rowData, error: rowError } = await supabase
      .from("ticket_participations")
      .select("id,user_id,status,ticket_id,ticket_instance_id,ticket_snapshot")
      .eq("id", waitlistId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (rowError) throw rowError;

    const row = rowData as unknown as WaitlistRow | null;
    if (!row) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }

    if (row.status !== "approved") {
      return NextResponse.json(
        { error: "Arrival status is only available after approval." },
        { status: 400 },
      );
    }

    let instance: InstanceRow | null = null;
    const instanceId = row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id;
    if (instanceId) {
      const { data, error } = await supabase
        .from("ticket_instances")
        .select("id,event_date,event_time")
        .eq("id", instanceId)
        .maybeSingle();
      if (error) throw error;
      instance = data as unknown as InstanceRow | null;
    }

    const startAt = toStartAt(
      instance?.event_date ?? row.ticket_snapshot?.date,
      instance?.event_time ?? row.ticket_snapshot?.time,
    );
    if (!startAt) {
      return NextResponse.json(
        { error: "Meeting start time is not available." },
        { status: 400 },
      );
    }

    if (new Date() < addHours(startAt, -3)) {
      return NextResponse.json(
        { error: "Arrival status opens three hours before the meeting." },
        { status: 403 },
      );
    }

    const updatedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("ticket_participations")
      .update({
        arrival_status: arrivalStatus,
        arrival_status_updated_at: updatedAt,
        updated_at: updatedAt,
      })
      .eq("id", waitlistId)
      .eq("user_id", user.id);
    if (updateError) throw updateError;

    return NextResponse.json({
      arrivalStatus,
      arrivalStatusUpdatedAt: updatedAt,
    });
  } catch (error) {
    console.error("[meetings my-tickets arrival]", error);
    return NextResponse.json(
      { error: "도착 상태를 저장하지 못했어요." },
      { status: 500 },
    );
  }
}
