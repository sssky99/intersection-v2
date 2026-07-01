import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type InvitationAction = "viewed" | "declined";

export async function POST(request: Request) {
  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    ticketInstanceId?: unknown;
    action?: unknown;
  } | null;
  const ticketInstanceId =
    typeof body?.ticketInstanceId === "string"
      ? body.ticketInstanceId.trim()
      : "";
  const action = body?.action as InvitationAction | undefined;

  if (
    !ticketInstanceId ||
    (action !== "viewed" && action !== "declined")
  ) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: instance, error: instanceError } = await admin
      .from("ticket_instances")
      .select("id,visibility")
      .eq("id", ticketInstanceId)
      .maybeSingle<{ id: string; visibility: string }>();
    if (instanceError || !instance) {
      return NextResponse.json(
        { error: "Ticket occurrence is not available." },
        { status: 404 },
      );
    }

    const { data: existing, error: existingError } = await admin
      .from("ticket_invitations")
      .select("id,status,source_type,inviter_id,expires_at,viewed_at")
      .eq("ticket_instance_id", ticketInstanceId)
      .eq("user_id", user.id)
      .maybeSingle<{
        id: string;
        status: string;
        source_type: "service" | "admin" | "friend";
        inviter_id: string | null;
        expires_at: string | null;
        viewed_at: string | null;
      }>();
    if (existingError) throw existingError;

    const invitationIsActive = Boolean(
      existing &&
        ["sent", "viewed", "accepted"].includes(existing.status) &&
        (!existing.expires_at ||
          new Date(existing.expires_at).getTime() > Date.now()),
    );
    if (instance.visibility === "invite_only" && !invitationIsActive) {
      return NextResponse.json(
        { error: "An invitation is required." },
        { status: 403 },
      );
    }

    if (existing?.status === "accepted") {
      return NextResponse.json({ invitation: existing });
    }
    if (
      action === "viewed" &&
      existing &&
      ["declined", "expired", "cancelled"].includes(existing.status)
    ) {
      return NextResponse.json({ invitation: existing });
    }

    const now = new Date().toISOString();
    const nextStatus = action === "declined" ? "declined" : "viewed";
    const { data: invitation, error } = await admin
      .from("ticket_invitations")
      .upsert(
        {
          ticket_instance_id: ticketInstanceId,
          user_id: user.id,
          source_type: existing?.source_type ?? "service",
          inviter_id: existing?.inviter_id ?? null,
          status: nextStatus,
          viewed_at: existing?.viewed_at ?? now,
          responded_at: action === "declined" ? now : null,
          updated_at: now,
        },
        { onConflict: "ticket_instance_id,user_id" },
      )
      .select("id,status")
      .single();
    if (error) throw error;

    return NextResponse.json({ invitation });
  } catch (error) {
    console.error("[meeting invitations]", error);
    return NextResponse.json(
      { error: "Invitation response could not be saved." },
      { status: 500 },
    );
  }
}
