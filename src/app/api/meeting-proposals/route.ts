import { NextResponse } from "next/server";
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
import { meetingRegionFromPlace } from "@/lib/seoulRegion";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  MeetingProposalCoverImage,
  MeetingProposalDraft,
  MeetingProposalInput,
} from "@/types/meetingProposal";
import {
  MEETING_MAX_PARTICIPANT_COUNT,
  MEETING_MIN_PARTICIPANT_COUNT,
} from "@/types/ticket";
import { ensureMeetingProposalEligibility } from "./eligibility";

type SubmitRequest = Partial<MeetingProposalInput & MeetingProposalDraft> & {
  proposerRoleAgreed?: unknown;
};

type RejectedProposalNotificationRow = {
  id: string;
  title: string;
  rejection_reason: string | null;
  updated_at: string;
  submitted_at: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function tags(
  value: unknown,
  blockedTags: Array<string | null | undefined> = [],
) {
  return normalizeProposalHashtags(value, { blockedTags });
}

function textList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];
}

function score(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(5, Math.max(1, Math.round(value)));
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function optionalText(value: unknown) {
  return text(value) || null;
}

function isPexelsImageUrl(value: string) {
  try {
    return new URL(value).hostname.endsWith("pexels.com");
  } catch {
    return false;
  }
}

function normalizeCoverImage(body: SubmitRequest): MeetingProposalCoverImage | null {
  const imageUrl = text(body.imageUrl);
  const raw =
    typeof body.coverImage === "object" && body.coverImage
      ? body.coverImage as Record<string, unknown>
      : null;

  if (
    raw?.imageSource === "pexels" &&
    raw.imageSelectionMethod === "auto" &&
    imageUrl &&
    isPexelsImageUrl(imageUrl) &&
    /^\d+$/.test(text(raw.pexelsPhotoId)) &&
    isPexelsImageUrl(text(raw.pexelsPageUrl))
  ) {
    return {
      imageUrl,
      imageSource: "pexels",
      imageSelectionMethod: "auto",
      pexelsPhotoId: text(raw.pexelsPhotoId),
      pexelsPageUrl: text(raw.pexelsPageUrl),
      photographer: optionalText(raw.photographer),
      photographerUrl: optionalText(raw.photographerUrl),
      imageReviewModel: optionalText(raw.imageReviewModel) ?? "gpt-5.5",
    };
  }

  if (!imageUrl) return null;

  return {
    imageUrl,
    imageSource: "user_upload",
    imageSelectionMethod: "manual",
    pexelsPhotoId: null,
    pexelsPageUrl: null,
    photographer: null,
    photographerUrl: null,
    imageReviewModel: null,
  };
}

function normalizedSubmit(body: SubmitRequest) {
  const place = normalizeMeetingPlace(body.place);
  const region = meetingRegionFromPlace(place) ?? text(body.region);
  const coverImage = normalizeCoverImage(body);
  const vibe =
    typeof body.vibe === "object" && body.vibe
      ? body.vibe as Record<string, unknown>
      : {};
  const payload = {
    imageUrl: coverImage?.imageUrl ?? null,
    coverImage,
    title: text(body.title),
    activityDescription: text(body.activityDescription),
    eventDate: text(body.eventDate),
    eventTime: text(body.eventTime),
    region,
    specificPlace: place?.name ?? (text(body.specificPlace) || null),
    place,
    hashtags: tags(body.hashtags, [
      region,
      place?.name ?? text(body.specificPlace),
    ]),
    shortDescription: text(body.shortDescription),
    activities: textList(body.activities).slice(0, 4),
    vibe: {
      temperature: score(vibe.temperature, 3),
      texture: score(vibe.texture, 3),
      tone: score(vibe.tone, 3),
      rhythm: score(vibe.rhythm, 3),
      alcohol: score(vibe.alcohol, 2),
      romance: score(vibe.romance, 2),
    },
    flow: [],
    proposerRoleAgreed: body.proposerRoleAgreed === true,
  };

  if (
    !payload.title ||
    !payload.activityDescription ||
    !validDate(payload.eventDate) ||
    !validTime(payload.eventTime) ||
    !payload.region ||
    !payload.place ||
    payload.hashtags.length === 0 ||
    !payload.shortDescription ||
    payload.activities.length === 0 ||
    !payload.proposerRoleAgreed
  ) {
    return null;
  }

  return payload;
}

type PublishedProposalRow = {
  id: string;
  proposer_id: string;
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
  title: string;
  event_date: string;
  event_time: string;
  region: string;
  specific_place: string | null;
  place_payload: unknown;
  hashtags: string[] | null;
  short_description: string;
  activities: unknown;
  vibe: Record<string, number>;
};

function activityList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];
}

async function publishProposalImmediately({
  proposal,
  profile,
}: {
  proposal: PublishedProposalRow;
  profile: MeetingProposalProfileRow;
}) {
  const admin = createAdminClient();
  const place = normalizeMeetingPlace(proposal.place_payload);
  const displayName = meetingProposalDisplayName(profile);
  const placeAddress = meetingPlaceAddress(place);
  const now = new Date().toISOString();

  const { data: template, error: templateError } = await admin
    .from("ticket_templates")
    .insert({
      title: proposal.title,
      short_description: proposal.short_description,
      detail_summary: proposal.short_description,
      detail_activities: activityList(proposal.activities),
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
      mood_tags: normalizeProposalHashtags(proposal.hashtags ?? []),
      activity_type: "member_proposal",
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
      operation_code: null,
      operation_note: "제출 즉시 공개 · 검토 대기",
      remaining_seat_label_count: 0,
      max_participant_count: MEETING_MAX_PARTICIPANT_COUNT,
      visibility: "public",
      score_temperature: proposal.vibe.temperature,
      score_texture: proposal.vibe.texture,
      score_tone: proposal.vibe.tone,
      score_rhythm: proposal.vibe.rhythm,
      score_alcohol: proposal.vibe.alcohol,
      score_romance: proposal.vibe.romance,
      proposal_id: proposal.id,
      proposer_user_id: proposal.proposer_id,
      proposer_display_name: displayName,
      proposer_public_intro: proposal.proposer_public_intro,
      proposer_public_emoji: proposal.proposer_public_emoji,
    })
    .select("id")
    .single();
  if (templateError) throw templateError;

  const { data: instance, error: instanceError } = await admin
    .from("ticket_instances")
    .insert({
      template_id: template.id,
      title: proposal.title,
      event_date: proposal.event_date,
      event_time: proposal.event_time,
      region: proposal.region,
      place_name: place?.name ?? proposal.specific_place,
      address: placeAddress,
      place_payload: place,
      operation_code: null,
      operation_note: "제출 즉시 공개 · 검토 대기",
      place_visibility: place || proposal.specific_place ? "public" : "hidden",
      visibility: "public",
      remaining_seat_label_count: 0,
    })
    .select("id")
    .single();
  if (instanceError) throw instanceError;

  const snapshot = {
    id: instance.id,
    templateId: template.id,
    proposalId: proposal.id,
    title: proposal.title,
    subtitle: proposal.short_description,
    date: proposal.event_date,
    time: proposal.event_time.slice(0, 5),
    area: proposal.region,
    moodTags: normalizeProposalHashtags(proposal.hashtags ?? []),
    activityType: "member_proposal",
    imageUrl: proposal.image_url ?? undefined,
    coverImage: {
      imageUrl: proposal.image_url,
      imageSource: proposal.image_source,
      imageSelectionMethod: proposal.image_selection_method,
      pexelsPhotoId: proposal.pexels_photo_id,
      pexelsPageUrl: proposal.pexels_page_url,
      photographer: proposal.photographer,
      photographerUrl: proposal.photographer_url,
      imageReviewModel: proposal.image_review_model,
    },
    remainingSeatCount: 0,
    minimumParticipantCount: MEETING_MIN_PARTICIPANT_COUNT,
    maxParticipantCount: MEETING_MAX_PARTICIPANT_COUNT,
    peopleHint: proposal.short_description,
    reason: proposal.short_description,
    detailSummary: proposal.short_description,
    detailActivities: activityList(proposal.activities),
    detailFlow: [],
    place: ticketPlaceFromMeetingPlace(place),
    proposerLabel: `${displayName}님의 제안`,
    proposerProfile: {
      userId: proposal.proposer_id,
      displayName,
      publicIntro: proposal.proposer_public_intro,
      publicEmoji: proposal.proposer_public_emoji,
      gender: normalizeProfileGender(profile.gender),
      birthYear: profile.birth_year ?? null,
    },
    vibeScores: proposal.vibe,
  };

  const { error: waitlistError } = await admin.from("meeting_waitlist").insert({
    user_id: proposal.proposer_id,
    ticket_id: instance.id,
    ticket_template_id: template.id,
    ticket_instance_id: instance.id,
    meeting_date: proposal.event_date,
    status: "approved",
    ticket_snapshot: snapshot,
  });
  if (waitlistError && waitlistError.code !== "23505") throw waitlistError;

  const { error: proposalUpdateError } = await admin
    .from("meeting_proposals")
    .update({
      converted_template_id: template.id,
      converted_instance_id: instance.id,
      converted_at: now,
      updated_at: now,
    })
    .eq("id", proposal.id);
  if (proposalUpdateError) throw proposalUpdateError;

  return { templateId: template.id, instanceId: instance.id };
}

async function removeIncompletePublishedProposal(proposalId: string) {
  const admin = createAdminClient();
  const { data: templates } = await admin
    .from("ticket_templates")
    .select("id")
    .eq("proposal_id", proposalId);
  const templateIds = (templates ?? []).map((template) => template.id);

  if (templateIds.length > 0) {
    const { data: instances } = await admin
      .from("ticket_instances")
      .select("id")
      .in("template_id", templateIds);
    const instanceIds = (instances ?? []).map((instance) => instance.id);

    if (instanceIds.length > 0) {
      await admin
        .from("meeting_waitlist")
        .delete()
        .in("ticket_instance_id", instanceIds);
    }

    await admin.from("ticket_templates").delete().in("id", templateIds);
  }

  await admin.from("meeting_proposals").delete().eq("id", proposalId);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("meeting_proposals")
    .select("id,title,rejection_reason,updated_at,submitted_at")
    .eq("proposer_id", user.id)
    .eq("status", "rejected")
    .not("rejection_reason", "is", null)
    .order("updated_at", { ascending: false })
    .returns<RejectedProposalNotificationRow[]>();

  if (error) {
    console.error("[meeting proposal notifications]", error);
    return NextResponse.json(
      { error: "제안 알림을 불러오지 못했어요." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    rejectedProposals: (data ?? [])
      .map((proposal) => ({
        id: proposal.id,
        title: proposal.title,
        rejectionReason: proposal.rejection_reason?.trim() ?? "",
        updatedAt: proposal.updated_at,
        submittedAt: proposal.submitted_at,
      }))
      .filter((proposal) => proposal.rejectionReason.length > 0),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "user_id,name,nickname,gender,birth_year,public_intro,public_emoji,membership_status,membership_end_date,is_test_participant",
    )
    .eq("user_id", user.id)
    .maybeSingle<MeetingProposalProfileRow>();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "프로필 정보를 확인하지 못했어요." },
      { status: 400 },
    );
  }

  const eligibilityResponse = await ensureMeetingProposalEligibility(
    supabase,
    user.id,
    profile,
  );
  if (eligibilityResponse) return eligibilityResponse;

  const body = (await request.json().catch(() => null)) as SubmitRequest | null;
  const payload = normalizedSubmit(body ?? {});

  if (!payload) {
    return NextResponse.json(
      { error: "제안 내용과 제안자 역할 동의를 모두 확인해주세요." },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("meeting_proposals")
      .insert({
        proposer_id: user.id,
        proposer_membership_status: profile.membership_status,
        proposer_public_display_name: meetingProposalDisplayName(profile),
        proposer_public_intro: profile.public_intro,
        proposer_public_emoji: profile.public_emoji,
        image_url: payload.imageUrl,
        original_image_url: payload.imageUrl,
        pexels_photo_id: payload.coverImage?.pexelsPhotoId ?? null,
        pexels_page_url: payload.coverImage?.pexelsPageUrl ?? null,
        photographer: payload.coverImage?.photographer ?? null,
        photographer_url: payload.coverImage?.photographerUrl ?? null,
        image_source: payload.coverImage?.imageSource ?? null,
        image_selection_method:
          payload.coverImage?.imageSelectionMethod ?? null,
        image_review_model: payload.coverImage?.imageReviewModel ?? null,
        title: payload.title,
        activity_description: payload.activityDescription,
        event_date: payload.eventDate,
        event_time: payload.eventTime,
        region: payload.region,
        specific_place: payload.specificPlace,
        place_payload: payload.place,
        hashtags: payload.hashtags,
        short_description: payload.shortDescription,
        activities: payload.activities,
        vibe: payload.vibe,
        flow: payload.flow,
        proposer_role_agreed: true,
        status: "pending_review",
      })
      .select(
        "id,proposer_id,proposer_public_display_name,proposer_public_intro,proposer_public_emoji,image_url,pexels_photo_id,pexels_page_url,photographer,photographer_url,image_source,image_selection_method,image_review_model,title,event_date,event_time,region,specific_place,place_payload,hashtags,short_description,activities,vibe,submitted_at",
      )
      .single();

    if (error) throw error;

    let published: { templateId: string; instanceId: string };
    try {
      published = await publishProposalImmediately({
        proposal: data as PublishedProposalRow,
        profile,
      });
    } catch (publishError) {
      await removeIncompletePublishedProposal(data.id).catch((cleanupError) => {
        console.error("[meeting proposal publish cleanup]", cleanupError);
      });
      throw publishError;
    }

    return NextResponse.json({
      proposalId: data.id,
      submittedAt: data.submitted_at,
      ticketTemplateId: published.templateId,
      ticketInstanceId: published.instanceId,
      status: "pending_review",
    });
  } catch (error) {
    console.error("[meeting proposal submit]", error);
    return NextResponse.json(
      { error: "제안을 제출하지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
