import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { GatheringTicket } from "@/types/ticket";
import {
  isTicketRejectionReasonId,
  type TicketRejectionReasonId,
} from "@/types/ticketRejection";

type RejectionRequest = {
  reason?: unknown;
  ticket?: Partial<GatheringTicket> | null;
  replacementTicket?: Partial<GatheringTicket> | null;
};

type TicketInstanceLookup = {
  id: string;
  template_id: string | null;
};

function isTicket(value: RejectionRequest["ticket"]): value is GatheringTicket {
  return Boolean(
    value?.id &&
      value.templateId &&
      value.title &&
      value.date &&
      value.time &&
      value.area &&
      Array.isArray(value.moodTags) &&
      value.peopleHint &&
      value.reason,
  );
}

async function lookupTicketInstance(
  ticketId: string,
): Promise<TicketInstanceLookup | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ticket_instances")
    .select("id,template_id")
    .eq("id", ticketId)
    .maybeSingle<TicketInstanceLookup>();

  if (error) throw error;
  return data ?? null;
}

async function saveTicketRejection({
  userId,
  reason,
  ticket,
  replacementTicket,
  ticketInstance,
  replacementInstance,
}: {
  userId: string;
  reason: TicketRejectionReasonId;
  ticket: GatheringTicket;
  replacementTicket: GatheringTicket | null;
  ticketInstance: TicketInstanceLookup;
  replacementInstance: TicketInstanceLookup | null;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ticket_rejections")
    .insert({
      user_id: userId,
      ticket_instance_id: ticketInstance.id,
      ticket_template_id: ticketInstance.template_id ?? ticket.templateId,
      reason,
      replacement_ticket_instance_id: replacementInstance?.id ?? null,
      replacement_ticket_template_id:
        replacementInstance?.template_id ?? replacementTicket?.templateId ?? null,
      ticket_snapshot: ticket,
      replacement_ticket_snapshot: replacementTicket,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) throw error;
  return data;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | RejectionRequest
    | null;
  const reason = body?.reason;
  const ticket = body?.ticket;
  const replacementTicket = body?.replacementTicket ?? null;

  if (!isTicketRejectionReasonId(reason) || !isTicket(ticket)) {
    return NextResponse.json(
      { error: "Invalid rejection payload." },
      { status: 400 },
    );
  }

  if (replacementTicket !== null && !isTicket(replacementTicket)) {
    return NextResponse.json(
      { error: "Invalid replacement ticket payload." },
      { status: 400 },
    );
  }

  try {
    const ticketInstance = await lookupTicketInstance(ticket.id);
    if (!ticketInstance) {
      return NextResponse.json(
        { error: "Ticket occurrence is not available." },
        { status: 404 },
      );
    }

    const replacementInstance = replacementTicket
      ? await lookupTicketInstance(replacementTicket.id)
      : null;

    if (replacementTicket && !replacementInstance) {
      return NextResponse.json(
        { error: "Replacement ticket occurrence is not available." },
        { status: 404 },
      );
    }

    const rejection = await saveTicketRejection({
      userId: user.id,
      reason,
      ticket,
      replacementTicket,
      ticketInstance,
      replacementInstance,
    });

    return NextResponse.json({ rejection });
  } catch (error) {
    console.error("[meeting rejections]", error);
    return NextResponse.json(
      { error: "Ticket rejection could not be saved." },
      { status: 500 },
    );
  }
}
