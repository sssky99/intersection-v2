import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import {
  meetingProposalDisplayName,
  type MeetingProposalProfileRow,
} from "@/lib/meetingProposalAccess";
import { normalizeProfileGender } from "@/lib/meetingAtmosphere";
import { normalizeProposalHashtags } from "@/lib/meetingProposalTags";
import {
  meetingPlaceAddress,
  normalizeMeetingPlace,
  ticketPlaceFromMeetingPlace,
} from "@/lib/placePayload";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayMembershipStatus } from "@/features/membership/membershipTypes";
import {
  meetingProposalStatuses,
  type MeetingProposalStatus,
} from "@/types/meetingProposal";
import type { AdminMeetingProposal } from "@/features/admin/proposalAdminTypes";
import {
  MEETING_MAX_PARTICIPANT_COUNT,
  MEETING_MIN_PARTICIPANT_COUNT,
} from "@/types/ticket";

export const dynamic = "force-dynamic";

type ProposalRow = {
  id: string;
  proposer_id: string;
  proposer_membership_status: string | null;
  proposer_public_display_name: string;
  proposer_public_intro: string | null;
  proposer_public_emoji: string | null;
  image_url: string | null;
  pexels_photo_id: string | null;
  pexels_page_url: string | null;
  photographer: string | null;
  photographer_url: string | null;
  image_source: "pexels" | "user_upload" | null;
  image_selection_method: "auto" | "manual" | null;
  image_review_model: string | null;
  original_image_url: string | null;
  title: string;
  activity_description: string;
  event_date: string;
  event_time: string;
  region: string;
  specific_place: string | null;
  place_payload: unknown;
  hashtags: string[] | null;
  short_description: string;
  activities: unknown;
  vibe: unknown;
  flow: unknown;
  proposer_role_agreed: boolean;
  status: MeetingProposalStatus;
  admin_note: string | null;
  rejection_reason: string | null;
  converted_template_id: string | null;
  converted_instance_id: string | null;
  converted_at: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

type ProposalChangeRequestRow = {
  id: string;
  proposal_id: string;
  request_type: "edit" | "cancel";
  request_body: string;
  status: "pending_review" | "reviewed" | "approved" | "rejected";
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

const proposalSelect = [
  "id",
  "proposer_id",
  "proposer_membership_status",
  "proposer_public_display_name",
  "proposer_public_intro",
  "proposer_public_emoji",
  "image_url",
  "pexels_photo_id",
  "pexels_page_url",
  "photographer",
  "photographer_url",
  "image_source",
  "image_selection_method",
  "image_review_model",
  "original_image_url",
  "title",
  "activity_description",
  "event_date",
  "event_time",
  "region",
  "specific_place",
  "place_payload",
  "hashtags",
  "short_description",
  "activities",
  "vibe",
  "flow",
  "proposer_role_agreed",
  "status",
  "admin_note",
  "rejection_reason",
  "converted_template_id",
  "converted_instance_id",
  "converted_at",
  "submitted_at",
  "created_at",
  "updated_at",
].join(",");

const profileSelect = [
  "user_id",
  "name",
  "nickname",
  "gender",
  "birth_year",
  "public_intro",
  "public_emoji",
  "membership_status",
  "membership_end_date",
].join(",");

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

function unauthorized() {
  return NextResponse.json(
    { error: "관리자 인증이 필요합니다." },
    { status: 401 },
  );
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function requiredText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function tags(value: unknown) {
  return normalizeProposalHashtags(value);
}

function textList(value: unknown) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];

  return items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function score(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(5, Math.max(1, Math.round(value)));
}

function vibe(value: unknown) {
  const draft =
    typeof value === "object" && value
      ? value as Record<string, unknown>
      : {};

  return {
    temperature: score(draft.temperature, 3),
    texture: score(draft.texture, 3),
    tone: score(draft.tone, 3),
    rhythm: score(draft.rhythm, 3),
    alcohol: score(draft.alcohol, 2),
    romance: score(draft.romance, 2),
  };
}

function profileMembershipStatus(profile: MeetingProposalProfileRow | undefined) {
  if (!profile) return null;
  return displayMembershipStatus({
    status: profile.membership_status,
    endDate: profile.membership_end_date,
  });
}

function toAdminProposal(
  row: ProposalRow,
  profile?: MeetingProposalProfileRow,
  changeRequests: ProposalChangeRequestRow[] = [],
): AdminMeetingProposal {
  const displayName =
    profile ? meetingProposalDisplayName(profile) : row.proposer_public_display_name;

  return {
    id: row.id,
    proposerId: row.proposer_id,
    proposerMembershipStatus: row.proposer_membership_status,
    proposerCurrentMembershipStatus: profileMembershipStatus(profile),
    proposerProfile: {
      userId: row.proposer_id,
      displayName,
      publicIntro: row.proposer_public_intro ?? profile?.public_intro ?? null,
      publicEmoji: row.proposer_public_emoji ?? profile?.public_emoji ?? null,
      gender: normalizeProfileGender(profile?.gender),
      birthYear: profile?.birth_year ?? null,
    },
    imageUrl: row.image_url,
    originalImageUrl: row.original_image_url,
    title: row.title,
    activityDescription: row.activity_description,
    eventDate: row.event_date,
    eventTime: row.event_time?.slice(0, 5) ?? "",
    region: row.region,
    specificPlace: row.specific_place,
    place: normalizeMeetingPlace(row.place_payload),
    hashtags: normalizeProposalHashtags(row.hashtags ?? []),
    shortDescription: row.short_description,
    activities: textList(row.activities).slice(0, 4),
    vibe: vibe(row.vibe),
    flow: textList(row.flow),
    proposerRoleAgreed: row.proposer_role_agreed,
    status: row.status,
    adminNote: row.admin_note,
    rejectionReason: row.rejection_reason,
    convertedTemplateId: row.converted_template_id,
    convertedInstanceId: row.converted_instance_id,
    convertedAt: row.converted_at,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    changeRequests: changeRequests.map((request) => ({
      id: request.id,
      type: request.request_type,
      body: request.request_body,
      status: request.status,
      adminNote: request.admin_note,
      reviewedAt: request.reviewed_at,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
    })),
  };
}

async function loadProposalData() {
  const supabase = createAdminClient();
  const { data: proposalRows, error: proposalError } = await supabase
    .from("meeting_proposals")
    .select(proposalSelect)
    .order("submitted_at", { ascending: false });

  if (proposalError) throw proposalError;

  const rows = (proposalRows ?? []) as unknown as ProposalRow[];
  const proposerIds = Array.from(new Set(rows.map((row) => row.proposer_id)));
  const proposalIds = rows.map((row) => row.id);
  const profileMap = new Map<string, MeetingProposalProfileRow>();
  const requestsByProposal = new Map<string, ProposalChangeRequestRow[]>();

  if (proposerIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select(profileSelect)
      .in("user_id", proposerIds);
    if (profileError) throw profileError;

    for (const profile of (profiles ?? []) as unknown as MeetingProposalProfileRow[]) {
      profileMap.set(profile.user_id, profile);
    }
  }

  if (proposalIds.length > 0) {
    const { data: changeRequests, error: changeRequestError } = await supabase
      .from("meeting_proposal_change_requests")
      .select(
        "id,proposal_id,request_type,request_body,status,admin_note,reviewed_at,created_at,updated_at",
      )
      .in("proposal_id", proposalIds)
      .order("created_at", { ascending: false });

    if (!changeRequestError) {
      for (const request of (changeRequests ?? []) as ProposalChangeRequestRow[]) {
        const current = requestsByProposal.get(request.proposal_id) ?? [];
        current.push(request);
        requestsByProposal.set(request.proposal_id, current);
      }
    } else {
      console.warn("[admin proposals change requests]", changeRequestError);
    }
  }

  return {
    proposals: rows.map((row) =>
      toAdminProposal(
        row,
        profileMap.get(row.proposer_id),
        requestsByProposal.get(row.id) ?? [],
      ),
    ),
  };
}

function updatePayload(body: Record<string, unknown>) {
  const nextStatus = body.status;
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if ("imageUrl" in body) payload.image_url = text(body.imageUrl);
  if ("title" in body) payload.title = requiredText(body.title);
  if ("activityDescription" in body) {
    payload.activity_description = requiredText(body.activityDescription);
  }
  if ("eventDate" in body) payload.event_date = requiredText(body.eventDate);
  if ("eventTime" in body) payload.event_time = requiredText(body.eventTime);
  if ("region" in body) payload.region = requiredText(body.region);
  if ("specificPlace" in body) payload.specific_place = text(body.specificPlace);
  if ("hashtags" in body) payload.hashtags = tags(body.hashtags);
  if ("shortDescription" in body) {
    payload.short_description = requiredText(body.shortDescription);
  }
  if ("activities" in body) payload.activities = textList(body.activities);
  if ("vibe" in body) payload.vibe = vibe(body.vibe);
  if ("flow" in body) payload.flow = textList(body.flow);
  if ("adminNote" in body) payload.admin_note = text(body.adminNote);
  if ("rejectionReason" in body) {
    payload.rejection_reason = text(body.rejectionReason);
  }
  if ("status" in body) {
    if (!meetingProposalStatuses.includes(nextStatus as MeetingProposalStatus)) {
      return null;
    }
    payload.status = nextStatus;
  }

  return payload;
}

function ensureConvertible(proposal: ProposalRow) {
  return Boolean(
    proposal.title &&
      proposal.event_date &&
      proposal.event_time &&
      proposal.region &&
      proposal.short_description &&
      proposal.proposer_role_agreed &&
      proposal.status !== "converted_to_ticket" &&
      !proposal.converted_template_id &&
      !proposal.converted_instance_id,
  );
}

async function syncPublishedProposal(proposal: ProposalRow) {
  if (!proposal.converted_template_id || !proposal.converted_instance_id) {
    return;
  }

  const supabase = createAdminClient();
  const place = normalizeMeetingPlace(proposal.place_payload);
  const placeAddress = meetingPlaceAddress(place);
  const visibility = proposal.status === "rejected" ? "archived" : "public";
  const updatedAt = new Date().toISOString();
  const proposalVibe = vibe(proposal.vibe);
  const proposalTags = normalizeProposalHashtags(proposal.hashtags ?? []);

  const { error: templateError } = await supabase
    .from("ticket_templates")
    .update({
      title: proposal.title,
      short_description: proposal.short_description,
      detail_summary: proposal.short_description,
      detail_activities: textList(proposal.activities).slice(0, 4),
      detail_flow: [],
      image_url: proposal.image_url,
      pexels_photo_id: proposal.pexels_photo_id,
      pexels_page_url: proposal.pexels_page_url,
      photographer: proposal.photographer,
      photographer_url: proposal.photographer_url,
      image_source: proposal.image_source,
      image_selection_method: proposal.image_selection_method,
      image_review_model: proposal.image_review_model,
      mood_tags: proposalTags,
      recommendation_copy: proposal.short_description,
      default_region: proposal.region,
      default_time: proposal.event_time,
      event_date: proposal.event_date,
      event_time: proposal.event_time,
      region: proposal.region,
      place_name: place?.name ?? proposal.specific_place,
      address: placeAddress,
      place_payload: place,
      place_visibility: place || proposal.specific_place ? "public" : "hidden",
      operation_note: proposal.admin_note,
      visibility,
      score_temperature: proposalVibe.temperature,
      score_texture: proposalVibe.texture,
      score_tone: proposalVibe.tone,
      score_rhythm: proposalVibe.rhythm,
      score_alcohol: proposalVibe.alcohol,
      score_romance: proposalVibe.romance,
      updated_at: updatedAt,
    })
    .eq("id", proposal.converted_template_id);
  if (templateError) throw templateError;

  const { error: instanceError } = await supabase
    .from("ticket_instances")
    .update({
      title: proposal.title,
      event_date: proposal.event_date,
      event_time: proposal.event_time,
      region: proposal.region,
      place_name: place?.name ?? proposal.specific_place,
      address: placeAddress,
      place_payload: place,
      operation_note: proposal.admin_note,
      place_visibility: place || proposal.specific_place ? "public" : "hidden",
      visibility,
      updated_at: updatedAt,
    })
    .eq("id", proposal.converted_instance_id);
  if (instanceError) throw instanceError;

  if (proposal.status === "rejected") {
    const { error: waitlistError } = await supabase
      .from("meeting_waitlist")
      .update({
        status: "cancelled",
        updated_at: updatedAt,
      })
      .eq("ticket_instance_id", proposal.converted_instance_id)
      .in("status", ["waitlisted", "approved", "on_hold", "payment_pending"]);
    if (waitlistError) throw waitlistError;
  }
}

function convertedTicketSnapshot(
  proposal: ProposalRow,
  templateId: string,
  instanceId: string,
  displayName: string,
  profile: MeetingProposalProfileRow | null,
) {
  const proposerLabel = `${displayName}님의 제안`;
  const eventTime = proposal.event_time?.slice(0, 5) ?? "";
  const proposalTags = normalizeProposalHashtags(proposal.hashtags ?? []);
  const place = normalizeMeetingPlace(proposal.place_payload);

  return {
    id: instanceId,
    templateId,
    proposalId: proposal.id,
    title: proposal.title,
    subtitle: proposal.short_description,
    date: proposal.event_date,
    time: eventTime,
    area: proposal.region,
    moodTags: proposalTags,
    activityType: "member_proposal",
    imageUrl: proposal.image_url ?? undefined,
    remainingSeatCount: 0,
    minimumParticipantCount: MEETING_MIN_PARTICIPANT_COUNT,
    maxParticipantCount: MEETING_MAX_PARTICIPANT_COUNT,
    peopleHint: proposal.short_description,
    reason: proposal.short_description,
    detailSummary: proposal.short_description,
    detailActivities: textList(proposal.activities).slice(0, 4),
    detailFlow: [],
    place: ticketPlaceFromMeetingPlace(place),
    proposerLabel,
    proposerProfile: {
      userId: proposal.proposer_id,
      displayName,
      publicIntro: proposal.proposer_public_intro,
      publicEmoji: proposal.proposer_public_emoji,
      gender: normalizeProfileGender(profile?.gender),
      birthYear: profile?.birth_year ?? null,
    },
    vibeScores: vibe(proposal.vibe),
  };
}

async function convertProposal(proposalId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("meeting_proposals")
    .select(proposalSelect)
    .eq("id", proposalId)
    .single();
  if (error) throw error;

  const proposal = data as unknown as ProposalRow;
  if (!ensureConvertible(proposal)) {
    throw new Error("proposal-not-convertible");
  }
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("user_id", proposal.proposer_id)
    .maybeSingle();
  if (profileError) throw profileError;

  const proposerProfile = profileData as unknown as
    | MeetingProposalProfileRow
    | null;
  const proposerDisplayName = proposerProfile
    ? meetingProposalDisplayName(proposerProfile)
    : proposal.proposer_public_display_name;

  const proposalVibe = vibe(proposal.vibe);
  const proposalTags = normalizeProposalHashtags(proposal.hashtags ?? []);
  const proposalPlace = normalizeMeetingPlace(proposal.place_payload);
  const proposalPlaceAddress = meetingPlaceAddress(proposalPlace);
  const { data: template, error: templateError } = await supabase
    .from("ticket_templates")
    .insert({
      title: proposal.title,
      short_description: proposal.short_description,
      detail_summary: proposal.short_description,
      detail_activities: textList(proposal.activities).slice(0, 4),
      detail_flow: [],
      detail_good_for: [],
      detail_notice: null,
      image_url: proposal.image_url,
      pexels_photo_id: proposal.pexels_photo_id,
      pexels_page_url: proposal.pexels_page_url,
      photographer: proposal.photographer,
      photographer_url: proposal.photographer_url,
      image_source: proposal.image_source,
      image_selection_method: proposal.image_selection_method,
      image_review_model: proposal.image_review_model,
      mood_tags: proposalTags,
      activity_type: "member_proposal",
      recommendation_copy: proposal.short_description,
      default_region: proposal.region,
      default_time: proposal.event_time,
      event_date: proposal.event_date,
      event_time: proposal.event_time,
      region: proposal.region,
      place_name: proposalPlace?.name ?? proposal.specific_place,
      address: proposalPlaceAddress,
      place_payload: proposalPlace,
      place_visibility: proposalPlace || proposal.specific_place ? "public" : "hidden",
      operation_code: null,
      operation_note: proposal.admin_note,
      remaining_seat_label_count: 0,
      max_participant_count: 6,
      visibility: "public",
      score_temperature: proposalVibe.temperature,
      score_texture: proposalVibe.texture,
      score_tone: proposalVibe.tone,
      score_rhythm: proposalVibe.rhythm,
      score_alcohol: proposalVibe.alcohol,
      score_romance: proposalVibe.romance,
      proposal_id: proposal.id,
      proposer_user_id: proposal.proposer_id,
      proposer_display_name: proposerDisplayName,
      proposer_public_intro: proposal.proposer_public_intro,
      proposer_public_emoji: proposal.proposer_public_emoji,
    })
    .select("id")
    .single();

  if (templateError) throw templateError;

  const { data: instance, error: instanceError } = await supabase
    .from("ticket_instances")
    .insert({
      template_id: template.id,
      title: proposal.title,
      event_date: proposal.event_date,
      event_time: proposal.event_time,
      region: proposal.region,
      place_name: proposalPlace?.name ?? proposal.specific_place,
      address: proposalPlaceAddress,
      place_payload: proposalPlace,
      operation_code: null,
      operation_note: proposal.admin_note,
      place_visibility: proposalPlace || proposal.specific_place ? "public" : "hidden",
      visibility: "public",
      remaining_seat_label_count: 0,
    })
    .select("id")
    .single();

  if (instanceError) throw instanceError;

  const snapshot = convertedTicketSnapshot(
    proposal,
    template.id,
    instance.id,
    proposerDisplayName,
    proposerProfile,
  );
  const { data: existingWaitlist, error: existingWaitlistError } = await supabase
    .from("meeting_waitlist")
    .select("id")
    .eq("user_id", proposal.proposer_id)
    .eq("ticket_instance_id", instance.id)
    .maybeSingle();
  if (existingWaitlistError) throw existingWaitlistError;

  if (existingWaitlist?.id) {
    const { error: waitlistUpdateError } = await supabase
      .from("meeting_waitlist")
      .update({
        status: "approved",
        ticket_id: instance.id,
        ticket_template_id: template.id,
        meeting_date: proposal.event_date,
        ticket_snapshot: snapshot,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingWaitlist.id);
    if (waitlistUpdateError) throw waitlistUpdateError;
  } else {
    const { error: waitlistInsertError } = await supabase
      .from("meeting_waitlist")
      .insert({
        user_id: proposal.proposer_id,
        ticket_id: instance.id,
        ticket_template_id: template.id,
        ticket_instance_id: instance.id,
        meeting_date: proposal.event_date,
        status: "approved",
        ticket_snapshot: snapshot,
      });
    if (waitlistInsertError && waitlistInsertError.code !== "23505") {
      throw waitlistInsertError;
    }
  }

  const convertedAt = new Date().toISOString();
  const { error: proposalUpdateError } = await supabase
    .from("meeting_proposals")
    .update({
      status: "converted_to_ticket",
      converted_template_id: template.id,
      converted_instance_id: instance.id,
      converted_at: convertedAt,
      updated_at: convertedAt,
    })
    .eq("id", proposal.id);
  if (proposalUpdateError) throw proposalUpdateError;
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    return NextResponse.json(await loadProposalData());
  } catch (error) {
    console.error("[admin proposals]", error);
    return NextResponse.json(
      { error: "제안 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const id = requiredText(body?.id);
  const payload = body ? updatePayload(body) : null;

  if (!id || !payload) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("meeting_proposals")
      .update(payload)
      .eq("id", id);
    if (error) throw error;

    const { data: proposal, error: proposalError } = await supabase
      .from("meeting_proposals")
      .select(proposalSelect)
      .eq("id", id)
      .single();
    if (proposalError) throw proposalError;

    await syncPublishedProposal(proposal as unknown as ProposalRow);

    return NextResponse.json(await loadProposalData());
  } catch (error) {
    console.error("[admin proposals patch]", error);
    return NextResponse.json(
      { error: "제안을 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    proposalId?: unknown;
  } | null;
  const action = body?.action;
  const proposalId = requiredText(body?.proposalId);

  if (action !== "convert_to_ticket" || !proposalId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    await convertProposal(proposalId);
    return NextResponse.json(await loadProposalData());
  } catch (error) {
    console.error("[admin proposals convert]", error);
    return NextResponse.json(
      { error: "제안을 초대장으로 전환하지 못했습니다." },
      { status: 500 },
    );
  }
}
