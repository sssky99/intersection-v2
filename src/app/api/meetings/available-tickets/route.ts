import { NextResponse } from "next/server";
import { getAvailableMeetingTickets } from "@/lib/publicTicketPreview";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProfileAccessRow = {
  is_test_participant: boolean | null;
};

async function requestContext() {
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return null;

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
  };
}

export async function GET() {
  try {
    const context = await requestContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tickets = await getAvailableMeetingTickets({
      userId: context.userId,
      includeTestOnly: context.includeTestOnly,
    });
    return NextResponse.json(
      { tickets },
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
