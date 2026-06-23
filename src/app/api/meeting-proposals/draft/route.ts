import { NextResponse } from "next/server";
import {
  hasActiveProposalMembership,
  type MeetingProposalProfileRow,
} from "@/lib/meetingProposalAccess";
import { generateMeetingProposalDraft } from "@/lib/meetingProposalAi";
import { normalizeProposalHashtags } from "@/lib/meetingProposalTags";
import { createClient } from "@/lib/supabase/server";
import type { MeetingProposalInput } from "@/types/meetingProposal";

type DraftRequest = Partial<MeetingProposalInput>;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function tags(
  value: unknown,
  blockedTags: Array<string | null | undefined> = [],
) {
  return normalizeProposalHashtags(value, { blockedTags });
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function proposalInput(body: DraftRequest): MeetingProposalInput | null {
  const input: MeetingProposalInput = {
    imageUrl: text(body.imageUrl),
    title: text(body.title),
    activityDescription: text(body.activityDescription),
    eventDate: text(body.eventDate),
    eventTime: text(body.eventTime),
    region: text(body.region),
    specificPlace: text(body.specificPlace) || null,
    userHashtags: [],
  };
  input.userHashtags = tags(body.userHashtags, [
    input.region,
    input.specificPlace,
  ]);

  if (
    !input.title ||
    !input.activityDescription ||
    !validDate(input.eventDate) ||
    !validTime(input.eventTime) ||
    !input.region
  ) {
    return null;
  }

  return input;
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

  const body = (await request.json().catch(() => null)) as DraftRequest | null;
  const input = proposalInput(body ?? {});

  if (!input) {
    return NextResponse.json(
      { error: "제목, 활동, 날짜, 시간, 지역을 모두 입력해주세요." },
      { status: 400 },
    );
  }

  try {
    const result = await generateMeetingProposalDraft(input);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[meeting proposal draft]", error);
    return NextResponse.json(
      { error: "AI 초안을 만들지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
