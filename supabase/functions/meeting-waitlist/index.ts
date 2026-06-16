import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";

type GatheringTicket = {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  time: string;
  area: string;
  moodTags: string[];
  peopleHint: string;
  reason: string;
};

type WaitlistRequest = {
  ticket?: Partial<GatheringTicket>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isTicket(value: WaitlistRequest["ticket"]): value is GatheringTicket {
  return Boolean(
    value?.id &&
      value.title &&
      value.subtitle &&
      value.date &&
      value.time &&
      value.area &&
      Array.isArray(value.moodTags) &&
      value.peopleHint &&
      value.reason,
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: "Supabase environment is not configured." }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: "Unauthorized." }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as WaitlistRequest;
  const ticket = body.ticket;

  if (!isTicket(ticket)) {
    return json({ error: "Invalid ticket payload." }, 400);
  }

  const { error } = await supabase.from("meeting_waitlist").insert({
    user_id: user.id,
    ticket_id: ticket.id,
    meeting_date: ticket.date,
    status: "waitlisted",
    ticket_snapshot: ticket,
  });

  if (error && error.code !== "23505") {
    console.error("Meeting waitlist insert error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return json({ error: "Failed to join meeting waitlist." }, 500);
  }

  return json({
    ticket,
    status: "waitlisted",
    duplicate: error?.code === "23505",
  });
});
