import {
  normalizeAdminProfile,
  type AdminProfile,
  type AdminProfileAnswer,
} from "@/features/admin/adminProfile";
import {
  calculateRedFlagAssessment,
  normalizeRedFlagManualFlags,
  type RedFlagParticipation,
} from "@/features/admin/redFlags";
import {
  isWaitlistStatus,
  type AdminArrivalStatus,
  type AdminWaitlistData,
  type AdminWaitlistRow,
  type WaitlistTicketInstance,
  type WaitlistTicketTemplate,
} from "@/features/admin/waitlistAdminTypes";
import type { MeetingDateDepositStatus } from "@/lib/meetingDateApplications";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GatheringTicket } from "@/types/ticket";
import "server-only";


type WaitlistDbRow = {
  id: number | string;
  user_id: string;
  ticket_id: string;
  ticket_template_id: string | null;
  ticket_instance_id: string | null;
  meeting_date: string | null;
  status: string;
  arrival_status: AdminArrivalStatus | null;
  arrival_status_updated_at: string | null;
  admin_note: string | null;
  ticket_snapshot: GatheringTicket | null;
  created_at: string | null;
  updated_at: string | null;
};

type DateApplicationDbRow = {
  id: number | string;
  user_id: string;
  meeting_date: string;
  meeting_time: string;
  region: string;
  status: string;
  deposit_amount: number | null;
  deposit_status: MeetingDateDepositStatus | null;
  assigned_ticket_instance_id: string | null;
  ticket_participation_id: number | string | null;
  admin_note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const profileSelect = [
  "user_id",
  "name",
  "gender",
  "birth_year",
  "mbti",
  "phone",
  "photo_url",
  "public_intro",
  "public_intro_model",
  "created_at",
  "profile_completed",
  "questions_completed",
  "membership_status",
  "membership_plan",
  "membership_start_date",
  "membership_end_date",
  "membership_purchase_clicked_at",
  "membership_updated_at",
].join(",");

const instanceSelect =
  "id,template_id,title,event_date,event_time,region,operation_code";
const redFlagBatchSize = 100;
const redFlagPageSize = 1000;

type RedFlagReviewRow = {
  user_id: string;
  manual_flags: Record<string, unknown> | null;
  manual_adjustment: number | null;
  manual_no_show_count: number | null;
  manual_same_day_cancellation_count: number | null;
  updated_at: string | null;
};

type RedFlagParticipationRow = {
  user_id: string;
  status: string | null;
  arrival_status: string | null;
  cancelled_at: string | null;
  ticket_instance_id: string | null;
};

async function attachWaitlistRedFlagAssessments(
  supabase: ReturnType<typeof createAdminClient>,
  profiles: AdminProfile[],
) {
  const userIds = profiles.map((profile) => profile.user_id).filter(Boolean);
  if (userIds.length === 0) return profiles;

  const answers: AdminProfileAnswer[] = [];
  const reviews: RedFlagReviewRow[] = [];
  const participations: RedFlagParticipationRow[] = [];

  for (let start = 0; start < userIds.length; start += redFlagBatchSize) {
    const userIdBatch = userIds.slice(start, start + redFlagBatchSize);
    const { data: reviewRows, error: reviewError } = await supabase
      .from("profile_red_flag_reviews")
      .select(
        "user_id,manual_flags,manual_adjustment,manual_no_show_count,manual_same_day_cancellation_count,updated_at",
      )
      .in("user_id", userIdBatch)
      .returns<RedFlagReviewRow[]>();
    if (reviewError) throw reviewError;
    reviews.push(...(reviewRows ?? []));

    for (let from = 0; ; from += redFlagPageSize) {
      const { data, error } = await supabase
        .from("user_answers")
        .select(
          "user_id,question_order,category,question_type,answer_value,answer_values,answer_text,other_text,updated_at",
        )
        .in("user_id", userIdBatch)
        .order("user_id", { ascending: true })
        .order("question_order", { ascending: true })
        .range(from, from + redFlagPageSize - 1)
        .returns<AdminProfileAnswer[]>();
      if (error) throw error;
      answers.push(...(data ?? []));
      if ((data ?? []).length < redFlagPageSize) break;
    }

    for (let from = 0; ; from += redFlagPageSize) {
      const { data, error } = await supabase
        .from("ticket_participations")
        .select(
          "user_id,status,arrival_status,cancelled_at,ticket_instance_id",
        )
        .in("user_id", userIdBatch)
        .order("user_id", { ascending: true })
        .range(from, from + redFlagPageSize - 1)
        .returns<RedFlagParticipationRow[]>();
      if (error) throw error;
      participations.push(...(data ?? []));
      if ((data ?? []).length < redFlagPageSize) break;
    }
  }

  const instanceIds = uniqueText(
    participations.map((participation) => participation.ticket_instance_id),
  );
  const eventDateByInstanceId = new Map<string, string | null>();
  for (let start = 0; start < instanceIds.length; start += redFlagBatchSize) {
    const { data, error } = await supabase
      .from("ticket_instances")
      .select("id,event_date")
      .in("id", instanceIds.slice(start, start + redFlagBatchSize));
    if (error) throw error;
    for (const instance of data ?? []) {
      eventDateByInstanceId.set(instance.id, instance.event_date);
    }
  }

  const answersByUserId = new Map<string, AdminProfileAnswer[]>();
  for (const answer of answers) {
    const current = answersByUserId.get(answer.user_id) ?? [];
    current.push(answer);
    answersByUserId.set(answer.user_id, current);
  }
  const reviewByUserId = new Map(
    reviews.map((review) => [review.user_id, review]),
  );
  const participationsByUserId = new Map<string, RedFlagParticipation[]>();
  for (const participation of participations) {
    const current = participationsByUserId.get(participation.user_id) ?? [];
    current.push({
      status: participation.status,
      arrival_status: participation.arrival_status,
      cancelled_at: participation.cancelled_at,
      event_date: participation.ticket_instance_id
        ? eventDateByInstanceId.get(participation.ticket_instance_id) ?? null
        : null,
    });
    participationsByUserId.set(participation.user_id, current);
  }

  return profiles.map((profile) => {
    const review = reviewByUserId.get(profile.user_id);
    const assessment = calculateRedFlagAssessment({
      answers: answersByUserId.get(profile.user_id) ?? [],
      participations: participationsByUserId.get(profile.user_id) ?? [],
      manualFlags: normalizeRedFlagManualFlags(review?.manual_flags),
      manualAdjustment: Number(review?.manual_adjustment ?? 0),
      manualNoShowCount: Number(review?.manual_no_show_count ?? 0),
      manualSameDayCancellationCount: Number(
        review?.manual_same_day_cancellation_count ?? 0,
      ),
      reviewedAt: review?.updated_at ?? null,
    });

    return normalizeAdminProfile({
      ...profile,
      answers: answersByUserId.get(profile.user_id) ?? [],
      red_flag_score: assessment.score,
      red_flag_reasons: assessment.reasons,
      red_flag_manual_flags: assessment.manualFlags,
      red_flag_manual_adjustment: assessment.manualAdjustment,
      red_flag_manual_no_show_count: assessment.manualNoShowCount,
      red_flag_manual_same_day_cancellation_count:
        assessment.manualSameDayCancellationCount,
      red_flag_reviewed_at: assessment.reviewedAt,
    });
  });
}

export async function loadWaitlistData(): Promise<AdminWaitlistData> {
  const supabase = createAdminClient();

  const [waitlistResult, dateApplicationsResult] = await Promise.all([
    supabase
      .from("ticket_participations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("meeting_date_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (waitlistResult.error) throw waitlistResult.error;
  if (
    dateApplicationsResult.error &&
    dateApplicationsResult.error.code !== "PGRST205"
  ) {
    throw dateApplicationsResult.error;
  }

  const waitlistRows = (waitlistResult.data ?? []) as WaitlistDbRow[];
  const dateApplicationRows = (dateApplicationsResult.data ?? []) as DateApplicationDbRow[];
  const participationById = new Map(
    waitlistRows.map((row) => [String(row.id), row]),
  );
  const participationByUserAndInstance = new Map(
    waitlistRows
      .filter((row) => row.ticket_instance_id)
      .map((row) => [`${row.user_id}:${row.ticket_instance_id}`, row]),
  );
  const linkedParticipationForApplication = (row: DateApplicationDbRow) =>
    (row.ticket_participation_id !== null
      ? participationById.get(String(row.ticket_participation_id))
      : undefined) ??
    (row.assigned_ticket_instance_id
      ? participationByUserAndInstance.get(
          `${row.user_id}:${row.assigned_ticket_instance_id}`,
        )
      : undefined);
  const linkedParticipationIds = new Set(
    dateApplicationRows
      .map(linkedParticipationForApplication)
      .filter((row): row is WaitlistDbRow => Boolean(row))
      .map((row) => String(row.id)),
  );
  const visibleWaitlistRows = waitlistRows.filter(
    (row) => !linkedParticipationIds.has(String(row.id)),
  );
  const userIds = uniqueText([
    ...waitlistRows.map((row) => row.user_id),
    ...dateApplicationRows.map((row) => row.user_id),
  ]);
  const rowTemplateIds = uniqueText(
    waitlistRows.map((row) => row.ticket_template_id),
  );
  const rowInstanceIds = uniqueText(
    [
      ...waitlistRows.map((row) => row.ticket_instance_id),
      ...dateApplicationRows.map((row) => row.assigned_ticket_instance_id),
    ],
  );

  let profiles: AdminProfile[] = [];
  if (userIds.length > 0) {
    const [profilesResult, ratingsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select(profileSelect)
        .in("user_id", userIds)
        .order("name"),
      supabase
        .from("profile_operator_ratings")
        .select("user_id,rating,updated_at")
        .in("user_id", userIds),
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (ratingsResult.error) throw ratingsResult.error;

    const ratingsByUserId = new Map(
      (ratingsResult.data ?? []).map((row) => [row.user_id, row]),
    );
    profiles = (
      (profilesResult.data ?? []) as unknown as AdminProfile[]
    ).map((profile) => {
      const rating = ratingsByUserId.get(profile.user_id);
      return normalizeAdminProfile({
        ...profile,
        operator_rating: rating ? Number(rating.rating) : null,
        operator_rating_updated_at: rating?.updated_at ?? null,
      });
    });
    profiles = await attachWaitlistRedFlagAssessments(supabase, profiles);
  }

  let seedInstances: WaitlistTicketInstance[] = [];
  if (rowInstanceIds.length > 0) {
    const { data, error } = await supabase
      .from("ticket_instances")
      .select(instanceSelect)
      .in("id", rowInstanceIds);
    if (error) throw error;
    seedInstances = (data ?? []) as WaitlistTicketInstance[];
  }

  const templateIds = uniqueText([
    ...rowTemplateIds,
    ...seedInstances.map((instance) => instance.template_id),
  ]);

  let templates: WaitlistTicketTemplate[] = [];
  if (templateIds.length > 0) {
    const { data, error } = await supabase
      .from("ticket_templates")
      .select("id,title")
      .in("id", templateIds)
      .order("title");
    if (error) throw error;
    templates = (data ?? []) as WaitlistTicketTemplate[];
  }

  let templateInstances: WaitlistTicketInstance[] = [];
  if (templateIds.length > 0) {
    const { data, error } = await supabase
      .from("ticket_instances")
      .select(instanceSelect)
      .in("template_id", templateIds)
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("event_time", { ascending: true, nullsFirst: false });
    if (error) throw error;
    templateInstances = (data ?? []) as WaitlistTicketInstance[];
  }

  const applicationDates = uniqueText(
    dateApplicationRows.map((row) => row.meeting_date),
  );
  let dateInstances: WaitlistTicketInstance[] = [];
  if (applicationDates.length > 0) {
    const { data, error } = await supabase
      .from("ticket_instances")
      .select(instanceSelect)
      .in("event_date", applicationDates)
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("event_time", { ascending: true, nullsFirst: false });
    if (error) throw error;
    dateInstances = (data ?? []) as WaitlistTicketInstance[];
  }

  const profilesMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const instances = sortInstances(
    dedupeInstances([...seedInstances, ...templateInstances, ...dateInstances]),
  );
  const templateMap = new Map(templates.map((template) => [template.id, template]));
  const instanceMap = new Map(instances.map((instance) => [instance.id, instance]));

  const waitlist = visibleWaitlistRows.map(
    (row): AdminWaitlistRow => {
      const instance = row.ticket_instance_id
        ? instanceMap.get(row.ticket_instance_id) ?? null
        : null;
      const templateId = row.ticket_template_id ?? instance?.template_id ?? null;

      return {
        ...row,
        source: "ticket_participation",
        source_id: row.id,
        status: isWaitlistStatus(row.status) ? row.status : "waitlisted",
        deposit_amount: null,
        deposit_status: null,
        profile: profilesMap.get(row.user_id) ?? null,
        ticket_template: templateId ? templateMap.get(templateId) ?? null : null,
        ticket_instance: instance,
      };
    },
  );

  const dateApplications = dateApplicationRows.map(
    (row): AdminWaitlistRow => {
      const linkedParticipation = linkedParticipationForApplication(row);
      const instance = row.assigned_ticket_instance_id
        ? instanceMap.get(row.assigned_ticket_instance_id) ?? null
        : null;
      const templateId = instance?.template_id ?? null;

      return {
        id: `date:${row.id}`,
        source: "date_application",
        source_id: row.id,
        user_id: row.user_id,
        ticket_id: `date:${row.meeting_date}`,
        ticket_template_id: templateId,
        ticket_instance_id: row.assigned_ticket_instance_id,
        meeting_date: row.meeting_date,
        status: isWaitlistStatus(row.status) ? row.status : "waitlisted",
        arrival_status: linkedParticipation?.arrival_status ?? null,
        arrival_status_updated_at:
          linkedParticipation?.arrival_status_updated_at ?? null,
        admin_note: row.admin_note,
        ticket_snapshot: linkedParticipation?.ticket_snapshot ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deposit_amount: row.deposit_amount,
        deposit_status: row.deposit_status,
        profile: profilesMap.get(row.user_id) ?? null,
        ticket_template: templateId ? templateMap.get(templateId) ?? null : null,
        ticket_instance: instance,
      };
    },
  );

  return {
    waitlist: [...dateApplications, ...waitlist].sort((left, right) =>
      (right.created_at ?? "").localeCompare(left.created_at ?? ""),
    ),
    templates,
    instances,
  };
}

function uniqueText(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function dedupeInstances(instances: WaitlistTicketInstance[]) {
  return Array.from(
    new Map(instances.map((instance) => [instance.id, instance])).values(),
  );
}

function sortInstances(instances: WaitlistTicketInstance[]) {
  return [...instances].sort((a, b) => {
    const dateCompare = (a.event_date ?? "").localeCompare(b.event_date ?? "");
    if (dateCompare !== 0) return dateCompare;

    const timeCompare = (a.event_time ?? "").localeCompare(b.event_time ?? "");
    if (timeCompare !== 0) return timeCompare;

    return a.title.localeCompare(b.title, "ko");
  });
}
