import { NextResponse } from "next/server";
import { getMeetingTicketsByInstanceIds } from "@/lib/publicTicketPreview";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { nextTicketInteractionStatus } from "@/lib/ticketInteractions";
import type {
  TicketInteraction,
  TicketInteractionStatus,
} from "@/types/ticket";

export const dynamic = "force-dynamic";

const validStatuses = new Set<TicketInteractionStatus>([
  "open",
  "no",
  "yes",
  "payment_pending",
  "payment_confirmed",
]);

type InteractionRow = {
  ticket_instance_id: string;
  ticket_template_id: string;
  status: TicketInteractionStatus;
  opened_at: string | null;
  responded_at: string | null;
  payment_started_at: string | null;
  payment_confirmed_at: string | null;
  updated_at: string;
};

type InteractionInput = {
  ticketInstanceId?: unknown;
  status?: unknown;
  openedAt?: unknown;
  respondedAt?: unknown;
  paymentStartedAt?: unknown;
  paymentConfirmedAt?: unknown;
};

async function requestContext() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("is_test_participant")
    .eq("user_id", user.id)
    .maybeSingle<{ is_test_participant: boolean | null }>();
  if (error) throw error;

  return {
    admin,
    userId: user.id,
    includeTestOnly: profile?.is_test_participant === true,
  };
}

function isoOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function interactionResponse(
  context: NonNullable<Awaited<ReturnType<typeof requestContext>>>,
) {
  const { data, error } = await context.admin
    .from("ticket_user_interactions")
    .select(
      "ticket_instance_id,ticket_template_id,status,opened_at,responded_at,payment_started_at,payment_confirmed_at,updated_at",
    )
    .eq("user_id", context.userId)
    .order("updated_at", { ascending: false })
    .returns<InteractionRow[]>();
  if (error) throw error;

  const tickets = await getMeetingTicketsByInstanceIds({
    instanceIds: (data ?? []).map((row) => row.ticket_instance_id),
    includeTestOnly: context.includeTestOnly,
  });
  const ticketMap = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const interactions = (data ?? [])
    .map((row): TicketInteraction | null => {
      const ticket = ticketMap.get(row.ticket_instance_id);
      if (!ticket) return null;
      return {
        ticket,
        status: row.status,
        openedAt: row.opened_at,
        respondedAt: row.responded_at,
        paymentStartedAt: row.payment_started_at,
        paymentConfirmedAt: row.payment_confirmed_at,
        updatedAt: row.updated_at,
      };
    })
    .filter((row): row is TicketInteraction => Boolean(row));

  return interactions;
}

async function saveInteraction(
  context: NonNullable<Awaited<ReturnType<typeof requestContext>>>,
  input: InteractionInput,
) {
  const ticketInstanceId =
    typeof input.ticketInstanceId === "string"
      ? input.ticketInstanceId.trim()
      : "";
  const requestedStatus =
    typeof input.status === "string" &&
    validStatuses.has(input.status as TicketInteractionStatus)
      ? (input.status as TicketInteractionStatus)
      : null;
  if (!ticketInstanceId || !requestedStatus) return false;

  const allowedVisibilities = context.includeTestOnly
    ? ["public", "test_only"]
    : ["public"];
  const { data: instance, error: instanceError } = await context.admin
    .from("ticket_instances")
    .select("id,template_id,title,event_date,event_time,region")
    .eq("id", ticketInstanceId)
    .in("visibility", allowedVisibilities)
    .maybeSingle<{
      id: string;
      template_id: string;
      title: string;
      event_date: string | null;
      event_time: string | null;
      region: string | null;
    }>();
  if (instanceError) throw instanceError;
  if (!instance) return false;

  const { data: existing, error: existingError } = await context.admin
    .from("ticket_user_interactions")
    .select(
      "ticket_instance_id,ticket_template_id,status,opened_at,responded_at,payment_started_at,payment_confirmed_at,updated_at",
    )
    .eq("user_id", context.userId)
    .eq("ticket_instance_id", instance.id)
    .maybeSingle<InteractionRow>();
  if (existingError) throw existingError;

  const status = nextTicketInteractionStatus(existing?.status, requestedStatus);
  const transitionApplied = status === requestedStatus;
  const now = new Date().toISOString();
  const openedAt = existing?.opened_at ?? isoOrNull(input.openedAt) ?? now;
  const respondedAt =
    transitionApplied &&
    (requestedStatus === "yes" || requestedStatus === "no")
      ? isoOrNull(input.respondedAt) ?? now
      : existing?.responded_at ?? null;
  const paymentStartedAt =
    transitionApplied && requestedStatus === "payment_pending"
      ? isoOrNull(input.paymentStartedAt) ?? now
      : existing?.payment_started_at ?? null;
  const paymentConfirmedAt =
    transitionApplied && requestedStatus === "payment_confirmed"
      ? isoOrNull(input.paymentConfirmedAt) ?? now
      : existing?.payment_confirmed_at ?? null;

  const { error } = await context.admin.from("ticket_user_interactions").upsert(
    {
      user_id: context.userId,
      ticket_instance_id: instance.id,
      ticket_template_id: instance.template_id,
      status,
      opened_at: openedAt,
      responded_at: respondedAt,
      payment_started_at: paymentStartedAt,
      payment_confirmed_at: paymentConfirmedAt,
      updated_at: now,
    },
    { onConflict: "user_id,ticket_instance_id" },
  );
  if (error) throw error;

  if (status === "no") {
    const { error: oldRejectionDeleteError } = await context.admin
      .from("ticket_rejections")
      .delete()
      .eq("user_id", context.userId)
      .eq("ticket_instance_id", instance.id);
    if (oldRejectionDeleteError) throw oldRejectionDeleteError;

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
  } else if (["yes", "payment_pending", "payment_confirmed"].includes(status)) {
    const { error: rejectionDeleteError } = await context.admin
      .from("ticket_rejections")
      .delete()
      .eq("user_id", context.userId)
      .eq("ticket_instance_id", instance.id);
    if (rejectionDeleteError) throw rejectionDeleteError;
  }
  return true;
}

export async function GET() {
  try {
    const context = await requestContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({
      interactions: await interactionResponse(context),
    });
  } catch (error) {
    console.error("Ticket interactions load failed:", error);
    return NextResponse.json(
      { error: "티켓 기록을 불러오지 못했어요." },
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
      interactions?: unknown;
    } & InteractionInput;
    const inputs = Array.isArray(body.interactions)
      ? (body.interactions as InteractionInput[]).slice(0, 50)
      : [body];
    let saved = 0;
    for (const input of inputs) {
      if (await saveInteraction(context, input)) saved += 1;
    }
    if (saved === 0) {
      return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    }
    return NextResponse.json({
      saved,
      interactions: await interactionResponse(context),
    });
  } catch (error) {
    console.error("Ticket interaction save failed:", error);
    return NextResponse.json(
      { error: "티켓 기록을 저장하지 못했어요." },
      { status: 500 },
    );
  }
}
