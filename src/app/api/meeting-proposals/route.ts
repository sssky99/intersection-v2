import { NextResponse } from "next/server";
import {
  hasActiveProposalMembership,
  meetingProposalDisplayName,
  type MeetingProposalProfileRow,
} from "@/lib/meetingProposalAccess";
import { normalizeProposalHashtags } from "@/lib/meetingProposalTags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { MeetingProposalDraft, MeetingProposalInput } from "@/types/meetingProposal";

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

function normalizedSubmit(body: SubmitRequest) {
  const vibe =
    typeof body.vibe === "object" && body.vibe
      ? body.vibe as Record<string, unknown>
      : {};
  const payload = {
    imageUrl: text(body.imageUrl) || null,
    title: text(body.title),
    activityDescription: text(body.activityDescription),
    eventDate: text(body.eventDate),
    eventTime: text(body.eventTime),
    region: text(body.region),
    specificPlace: text(body.specificPlace) || null,
    hashtags: tags(body.hashtags, [text(body.region), text(body.specificPlace)]),
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
    flow: textList(body.flow).slice(0, 5),
    proposerRoleAgreed: body.proposerRoleAgreed === true,
  };

  if (
    !payload.title ||
    !payload.activityDescription ||
    !validDate(payload.eventDate) ||
    !validTime(payload.eventTime) ||
    !payload.region ||
    payload.hashtags.length === 0 ||
    !payload.shortDescription ||
    payload.activities.length === 0 ||
    payload.flow.length === 0 ||
    !payload.proposerRoleAgreed
  ) {
    return null;
  }

  return payload;
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
      "user_id,name,nickname,public_intro,public_emoji,membership_status,membership_end_date",
    )
    .eq("user_id", user.id)
    .maybeSingle<MeetingProposalProfileRow>();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "프로필 정보를 확인하지 못했어요." },
      { status: 400 },
    );
  }

  if (!hasActiveProposalMembership(profile)) {
    return NextResponse.json(
      {
        error: "교집합 제안은 멤버십 사용자만 이용할 수 있어요.",
        code: "membership_required",
      },
      { status: 402 },
    );
  }

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
        title: payload.title,
        activity_description: payload.activityDescription,
        event_date: payload.eventDate,
        event_time: payload.eventTime,
        region: payload.region,
        specific_place: payload.specificPlace,
        hashtags: payload.hashtags,
        short_description: payload.shortDescription,
        activities: payload.activities,
        vibe: payload.vibe,
        flow: payload.flow,
        proposer_role_agreed: true,
        status: "pending_review",
      })
      .select("id,submitted_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      proposalId: data.id,
      submittedAt: data.submitted_at,
    });
  } catch (error) {
    console.error("[meeting proposal submit]", error);
    return NextResponse.json(
      { error: "제안을 제출하지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
