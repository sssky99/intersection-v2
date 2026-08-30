import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type MeetingFeedbackRow = {
  id: string;
  waitlist_id: number | string;
  user_id: string;
  ticket_instance_id: string | null;
  ticket_template_id: string | null;
  ticket_snapshot: Record<string, unknown> | null;
  selected_member_ids: string[] | null;
  member_feedback: Record<string, unknown> | null;
  place_feedback: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type TicketInstanceRow = {
  id: string;
  template_id: string | null;
  title: string | null;
  operation_code: string | null;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  place_name: string | null;
  address: string | null;
};

type TicketTemplateRow = {
  id: string;
  title: string;
};

type BlindDateParticipationRow = {
  id: string;
  offer_id: string;
  user_id: string;
  counterpart_rating: number | null;
  counterpart_comment: string | null;
  place_rating: number | null;
  place_comment: string | null;
  feedback_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type BlindDateOfferRow = {
  id: string;
  participant_a_id: string;
  participant_b_id: string;
  scheduled_date: string | null;
};

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function negativeMemberIds(placeFeedback: Record<string, unknown> | null) {
  const value = placeFeedback?.negative_member_feedback;
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value);
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const supabase = createAdminClient();
    const [
      { data: feedbacksData, error: feedbacksError },
      { data: blindDateFeedbacksData, error: blindDateFeedbacksError },
    ] = await Promise.all([
      supabase
        .from("meeting_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000)
        .returns<MeetingFeedbackRow[]>(),
      supabase
        .from("blind_date_participations")
        .select(
          "id,offer_id,user_id,counterpart_rating,counterpart_comment,place_rating,place_comment,feedback_completed_at,created_at,updated_at",
        )
        .not("feedback_completed_at", "is", null)
        .order("feedback_completed_at", { ascending: false })
        .limit(1000)
        .returns<BlindDateParticipationRow[]>(),
    ]);
    if (feedbacksError) throw feedbacksError;
    if (blindDateFeedbacksError) throw blindDateFeedbacksError;

    const feedbacks = feedbacksData ?? [];
    const blindDateFeedbacks = blindDateFeedbacksData ?? [];
    const blindDateOfferIds = unique(blindDateFeedbacks.map((row) => row.offer_id));
    const { data: blindDateOffersData, error: blindDateOffersError } =
      blindDateOfferIds.length
        ? await supabase
            .from("blind_date_offers")
            .select("id,participant_a_id,participant_b_id,scheduled_date")
            .in("id", blindDateOfferIds)
            .returns<BlindDateOfferRow[]>()
        : { data: [] as BlindDateOfferRow[], error: null };
    if (blindDateOffersError) throw blindDateOffersError;

    const blindDateOffers = blindDateOffersData ?? [];
    const instanceIds = unique(feedbacks.map((row) => row.ticket_instance_id));
    const initialTemplateIds = unique(feedbacks.map((row) => row.ticket_template_id));
    const profileIds = unique([
      ...feedbacks.flatMap((row) => [
        row.user_id,
        ...(Array.isArray(row.selected_member_ids) ? row.selected_member_ids : []),
        ...Object.keys(row.member_feedback ?? {}),
        ...negativeMemberIds(row.place_feedback),
      ]),
      ...blindDateOffers.flatMap((offer) => [
        offer.participant_a_id,
        offer.participant_b_id,
      ]),
    ]);

    const [{ data: instancesData, error: instancesError }, { data: profilesData, error: profilesError }] =
      await Promise.all([
        instanceIds.length
          ? supabase
              .from("ticket_instances")
              .select(
                "id,template_id,title,operation_code,event_date,event_time,region,place_name,address",
              )
              .in("id", instanceIds)
              .returns<TicketInstanceRow[]>()
          : Promise.resolve({ data: [] as TicketInstanceRow[], error: null }),
        profileIds.length
          ? supabase
              .from("profiles")
              .select("user_id,name,nickname,phone,gender")
              .in("user_id", profileIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
    if (instancesError) throw instancesError;
    if (profilesError) throw profilesError;

    const instances = instancesData ?? [];
    const templateIds = unique([
      ...initialTemplateIds,
      ...instances.map((instance) => instance.template_id),
    ]);

    const { data: templatesData, error: templatesError } = templateIds.length
      ? await supabase
          .from("ticket_templates")
          .select("id,title")
          .in("id", templateIds)
          .returns<TicketTemplateRow[]>()
      : { data: [] as TicketTemplateRow[], error: null };
    if (templatesError) throw templatesError;

    return NextResponse.json({
      feedbacks,
      blindDateFeedbacks,
      blindDateOffers,
      profiles: profilesData ?? [],
      instances,
      templates: templatesData ?? [],
    });
  } catch (error) {
    console.error("[admin feedback GET]", error);
    return NextResponse.json(
      { error: "Feedback data could not be loaded." },
      { status: 500 },
    );
  }
}
