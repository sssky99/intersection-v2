import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPastTicketDate } from "@/lib/ticketDate";

export const dynamic = "force-dynamic";

const counterKey = "free_deposit_message_registrations";
const fallbackBaseCount = 66;
const fallbackLimitCount = 100;

type DepositMessageRequest = {
  ticketId?: unknown;
};

type ServiceCounter = {
  base_count: number | null;
  limit_count: number | null;
};

function cleanTicketId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function registrationCounter(
  admin: ReturnType<typeof createAdminClient>,
) {
  const { data, error } = await admin
    .from("service_counters")
    .select("base_count,limit_count")
    .eq("counter_key", counterKey)
    .maybeSingle<ServiceCounter>();

  if (error) {
    console.error("Deposit message counter lookup error:", error);
  }

  return {
    baseCount:
      typeof data?.base_count === "number"
        ? data.base_count
        : fallbackBaseCount,
    limitCount:
      typeof data?.limit_count === "number"
        ? data.limit_count
        : fallbackLimitCount,
  };
}

async function registrationSummary(
  admin: ReturnType<typeof createAdminClient>,
) {
  const [{ baseCount, limitCount }, countResult] = await Promise.all([
    registrationCounter(admin),
    admin
      .from("deposit_message_registrations")
      .select("id", { count: "exact", head: true }),
  ]);

  if (countResult.error) {
    throw countResult.error;
  }

  const uniqueRegistrationCount = countResult.count ?? 0;

  return {
    count: baseCount + uniqueRegistrationCount,
    uniqueRegistrationCount,
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

  let registered = false;
  const { data: existingRegistration, error: existingError } = await admin
    .from("deposit_message_registrations")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle<{ id: number | string }>();

  if (existingError) {
    console.error("Deposit message registration lookup error:", existingError);
    return NextResponse.json(
      { error: "Failed to load registration state." },
      { status: 500 },
    );
  }

  if (!existingRegistration) {
    const now = new Date().toISOString();
    const { error: insertError } = await admin
      .from("deposit_message_registrations")
      .insert({
        user_id: user.id,
        first_ticket_instance_id: ticketValidation?.ticketId ?? null,
        created_at: now,
        updated_at: now,
      });

    if (insertError && insertError.code !== "23505") {
      console.error("Deposit message registration insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save registration." },
        { status: 500 },
      );
    }

    registered = !insertError;
  }

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
    registered,
    ...summary,
  });
}
