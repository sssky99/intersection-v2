import { NextResponse } from "next/server";
import {
  getAvailableMeetingTickets,
  getRejectedMeetingTickets,
} from "@/lib/publicTicketPreview";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProfileAccessRow = {
  is_test_participant: boolean | null;
};

async function requestContext(allowAnonymous = false) {
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return allowAnonymous
      ? {
          admin: createAdminClient(),
          userId: null,
          includeTestOnly: false,
          recommendationProfileReady: true,
        }
      : null;
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("is_test_participant")
    .eq("user_id", user.id)
    .maybeSingle<ProfileAccessRow>();
  if (error) throw error;

  return {
    admin,
    userId: user.id,
    includeTestOnly: profile?.is_test_participant === true,
    recommendationProfileReady: true,
  };
}

export async function GET(request: Request) {
  try {
    const context = await requestContext(true);
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (context.userId && !context.recommendationProfileReady) {
      return NextResponse.json(
        { error: "질문을 완료한 후 추천을 확인할 수 있어요." },
        { status: 403 },
      );
    }

    const view = new URL(request.url).searchParams.get("view");
    const tickets = await (view === "declined"
      ? context.userId
        ? getRejectedMeetingTickets({
            userId: context.userId,
            includeTestOnly: context.includeTestOnly,
          })
        : []
      : getAvailableMeetingTickets({
          userId: context.userId,
          includeTestOnly: context.includeTestOnly,
        }));
    return NextResponse.json(
      { tickets, view: view === "declined" ? "declined" : "available" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Available tickets load failed:", error);
    return NextResponse.json(
      { error: "티켓을 불러오지 못했어요." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await requestContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!context.recommendationProfileReady) {
      return NextResponse.json(
        { error: "질문을 완료한 후 추천에 응답할 수 있어요." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      ticketInstanceId?: unknown;
    };
    if (body.action !== "no" || typeof body.ticketInstanceId !== "string") {
      return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    }

    const allowedVisibilities = context.includeTestOnly
      ? ["public", "test_only"]
      : ["public"];
    const { data: event, error: eventError } = await context.admin
      .from("meeting_events")
      .select("id")
      .eq("id", body.ticketInstanceId)
      .in("visibility", allowedVisibilities)
      .maybeSingle<{ id: string }>();
    if (eventError && eventError.code !== "PGRST205") throw eventError;
    if (event) {
      const { error: rejectionError } = await context.admin
        .from("meeting_event_rejections")
        .upsert(
          { event_id: event.id, user_id: context.userId },
          { onConflict: "event_id,user_id" },
        );
      if (rejectionError) throw rejectionError;
      return NextResponse.json({ rejected: true });
    }

    const { data: instance, error: instanceError } = await context.admin
      .from("ticket_instances")
      .select("id,template_id,title,event_date,event_time,region,visibility")
      .eq("id", body.ticketInstanceId)
      .in("visibility", allowedVisibilities)
      .maybeSingle<{
        id: string;
        template_id: string;
        title: string;
        event_date: string | null;
        event_time: string | null;
        region: string | null;
        visibility: string;
      }>();
    if (instanceError) throw instanceError;
    if (!instance) {
      return NextResponse.json(
        { error: "선택한 티켓을 찾지 못했어요." },
        { status: 404 },
      );
    }

    const { data: existing, error: existingError } = await context.admin
      .from("ticket_rejections")
      .select("id")
      .eq("user_id", context.userId)
      .eq("ticket_instance_id", instance.id)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (existingError) throw existingError;

    if (!existing) {
      const { error: rejectionError } = await context.admin
        .from("ticket_rejections")
        .insert({
          user_id: context.userId,
          ticket_instance_id: instance.id,
          ticket_template_id: instance.template_id,
          reason: "not_sure",
          ticket_snapshot: {
            title: instance.title,
            date: instance.event_date,
            time: instance.event_time,
            region: instance.region,
          },
        });
      if (rejectionError) throw rejectionError;
    }

    return NextResponse.json({ rejected: true });
  } catch (error) {
    console.error("Available ticket rejection failed:", error);
    return NextResponse.json(
      { error: "선택을 저장하지 못했어요." },
      { status: 500 },
    );
  }
}
