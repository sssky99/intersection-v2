import { NextResponse } from "next/server";
import {
  hasMeetingProposalParticipation,
  isMeetingProposalOperator,
  meetingProposalEligibleParticipationStatuses,
  meetingProposalRequirementMessage,
  type MeetingProposalProfileRow,
} from "@/lib/meetingProposalAccess";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ProposalRequirementCode = "participation_required";

function proposalRequirementResponse(
  code: ProposalRequirementCode,
  status: 403,
) {
  return NextResponse.json(
    {
      error: meetingProposalRequirementMessage,
      code,
    },
    { status },
  );
}

export async function ensureMeetingProposalEligibility(
  supabase: SupabaseServerClient,
  userId: string,
  profile: Pick<MeetingProposalProfileRow, "is_test_participant">,
) {
  if (isMeetingProposalOperator(profile)) return null;

  const { count, error } = await supabase
    .from("meeting_waitlist")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", [...meetingProposalEligibleParticipationStatuses]);

  if (error) {
    console.error("[meeting proposal eligibility]", error);
    return NextResponse.json(
      { error: "제안 자격을 확인하지 못했어요." },
      { status: 500 },
    );
  }

  if (!hasMeetingProposalParticipation(count ?? 0)) {
    return proposalRequirementResponse("participation_required", 403);
  }

  return null;
}
