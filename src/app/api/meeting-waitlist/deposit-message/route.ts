import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  membershipApplicationCounter,
} from "@/lib/membershipApplicationCounter";
import { isPastTicketDate } from "@/lib/ticketDate";

export const dynamic = "force-dynamic";

type DepositMessageRequest = {
  ticketId?: unknown;
};

function cleanTicketId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function registrationSummary(
  admin: ReturnType<typeof createAdminClient>,
) {
  const { count, baseCount, applicationCount, limitCount } =
    await membershipApplicationCounter(admin);

  return {
    count,
    uniqueRegistrationCount: applicationCount,
    baseCount,
    limitCount,
  };
}

async function validateTicketInstance(
  admin: ReturnType<typeof createAdminClient>,
  ticketId: string | null,
) {
  if (!ticketId) return null;

  const { data, error } = await admin
    .from("ticket_instances")
    .select("id,event_date")
    .eq("id", ticketId)
    .maybeSingle<{ id: string; event_date: string | null }>();

  if (error || !data) {
    return {
      error: NextResponse.json(
        { error: "Ticket is not available." },
        { status: 400 },
      ),
    };
  }

  if (data.event_date && isPastTicketDate(data.event_date)) {
    return {
      error: NextResponse.json(
        { error: "This invitation has ended.", code: "ticket_ended" },
        { status: 410 },
      ),
    };
  }

  return { ticketId: data.id };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await registrationSummary(createAdminClient()));
  } catch (error) {
    console.error("Deposit message registration count error:", error);
    return NextResponse.json(
      { error: "Failed to load registration count." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as DepositMessageRequest;
  const requestedTicketId = cleanTicketId(body.ticketId);
  const admin = createAdminClient();
  const ticketValidation = await validateTicketInstance(admin, requestedTicketId);

  if (ticketValidation?.error) return ticketValidation.error;

  let summary: Awaited<ReturnType<typeof registrationSummary>>;
  try {
    summary = await registrationSummary(admin);
  } catch (error) {
    console.error("Deposit message registration count error:", error);
    return NextResponse.json(
      { error: "Failed to load registration count." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    registered: false,
    ...summary,
  });
}
