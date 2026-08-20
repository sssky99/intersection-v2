import { NextResponse } from "next/server";
import { requestUserId } from "@/lib/adminUserView";
import {
  getMeetingTicketsByEventIds,
  getMeetingTicketsByInstanceIds,
} from "@/lib/publicTicketPreview";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextTicketInteractionStatus } from "@/lib/ticketInteractions";
import { hasTicketStarted } from "@/lib/ticketDate";
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
  ticket_instance_id: string | null;
  event_id: string | null;
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

async function requestContext(allowAdminView = false) {
  const requestUser = await requestUserId({ allowAdminView });
  if (!requestUser) return null;

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("is_test_participant")
    .eq("user_id", requestUser.userId)
    .maybeSingle<{ is_test_participant: boolean | null }>();
  if (error) throw error;

  return {
    admin,
    userId: requestUser.userId,
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
      "ticket_instance_id,event_id,ticket_template_id,status,opened_at,responded_at,payment_started_at,payment_confirmed_at,updated_at",
    )
    .eq("user_id", context.userId)
    .order("updated_at", { ascending: false })
    .returns<InteractionRow[]>();
  if (error) throw error;

  const [instanceTickets, eventTickets] = await Promise.all([
    getMeetingTicketsByInstanceIds({
      instanceIds: (data ?? []).flatMap((row) =>
        row.ticket_instance_id ? [row.ticket_instance_id] : [],
      ),
      includeTestOnly: context.includeTestOnly,
    }),
    getMeetingTicketsByEventIds(
      (data ?? []).flatMap((row) => (row.event_id ? [row.event_id] : [])),
    ),
  ]);
  const ticketMap = new Map(
    [...instanceTickets, ...eventTickets]
      .filter((ticket) => !hasTicketStarted(ticket.date, ticket.time))
      .map((ticket) => [ticket.id, ticket]),
  );
  const interactions = (data ?? [])
    .map((row): TicketInteraction | null => {
      const ticketId = row.event_id ?? row.ticket_instance_id;
      const ticket = ticketId ? ticketMap.get(ticketId) : null;
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
  const { data: event, error: eventError } = await context.admin
    .from("meeting_events")
    .select("id,program_id,title,event_date,starts_at,region")
    .eq("id", ticketInstanceId)
    .in("visibility", allowedVisibilities)
    .maybeSingle<{
      id: string;
      program_id: string;
      title: string;
      event_date: string;
      starts_at: string;
      region: string;
    }>();
  if (eventError && eventError.code !== "PGRST205") throw eventError;

  const instanceResult = event
    ? null
    : await context.admin
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
  if (instanceResult?.error) throw instanceResult.error;
  const instance = instanceResult?.data ?? null;
  if (!event && !instance) return false;

  const target = event
    ? {
        kind: "event" as const,
        id: event.id,
        templateId: event.program_id,
        title: event.title,
        date: event.event_date,
        time: event.starts_at,
        region: event.region,
      }
    : {
        kind: "instance" as const,
        id: instance!.id,
        templateId: instance!.template_id,
        title: instance!.title,
        date: instance!.event_date,
        time: instance!.event_time,
        region: instance!.region,
      };
  if (hasTicketStarted(target.date, target.time)) return false;

  let existingQuery = context.admin
    .from("ticket_user_interactions")
    .select(
      "ticket_instance_id,event_id,ticket_template_id,status,opened_at,responded_at,payment_started_at,payment_confirmed_at,updated_at",
    )
    .eq("user_id", context.userId);
  existingQuery =
    target.kind === "event"
      ? existingQuery.eq("event_id", target.id)
      : existingQuery.eq("ticket_instance_id", target.id);
  const { data: existing, error: existingError } =
    await existingQuery.maybeSingle<InteractionRow>();
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

  const { error } = await context.admin
    .from("ticket_user_interactions")
    .upsert(
      {
        user_id: context.userId,
        ticket_instance_id: target.kind === "instance" ? target.id : null,
        event_id: target.kind === "event" ? target.id : null,
        ticket_template_id: target.templateId,
        status,
        opened_at: openedAt,
        responded_at: respondedAt,
        payment_started_at: paymentStartedAt,
        payment_confirmed_at: paymentConfirmedAt,
        updated_at: now,
      },
      {
        onConflict:
          target.kind === "event"
            ? "user_id,event_id"
            : "user_id,ticket_instance_id",
      },
    );
  if (error) throw error;

  if (status === "no") {
    if (target.kind === "event") {
      const { error: rejectionError } = await context.admin
        .from("meeting_event_rejections")
        .upsert(
          { user_id: context.userId, event_id: target.id },
          { onConflict: "event_id,user_id" },
        );
      if (rejectionError) throw rejectionError;
      return true;
    }

    const { error: oldRejectionDeleteError } = await context.admin
      .from("ticket_rejections")
      .delete()
      .eq("user_id", context.userId)
      .eq("ticket_instance_id", target.id);
    if (oldRejectionDeleteError) throw oldRejectionDeleteError;

    const { error: rejectionError } = await context.admin
      .from("ticket_rejections")
      .insert({
        user_id: context.userId,
        ticket_instance_id: target.id,
        ticket_template_id: target.templateId,
        reason: "not_sure",
        ticket_snapshot: {
          title: target.title,
          date: target.date,
          time: target.time,
          region: target.region,
        },
      });
    if (rejectionError) throw rejectionError;
  } else if (["yes", "payment_pending", "payment_confirmed"].includes(status)) {
    const rejectionDeleteQuery = context.admin
      .from(
        target.kind === "event"
          ? "meeting_event_rejections"
          : "ticket_rejections",
      )
      .delete()
      .eq("user_id", context.userId);
    const { error: rejectionDeleteError } = await (target.kind === "event"
      ? rejectionDeleteQuery.eq("event_id", target.id)
      : rejectionDeleteQuery.eq("ticket_instance_id", target.id));
    if (rejectionDeleteError) throw rejectionDeleteError;
  }
  return true;
}

export async function GET() {
  try {
    const context = await requestContext(true);
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
