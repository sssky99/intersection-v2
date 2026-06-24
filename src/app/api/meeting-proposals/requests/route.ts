import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RequestType = "edit" | "cancel";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function requestType(value: unknown): RequestType | null {
  return value === "edit" || value === "cancel" ? value : null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const proposalId = text(body?.proposalId);
  const type = requestType(body?.requestType);
  const message = text(body?.message);

  if (!proposalId || !type || !message) {
    return NextResponse.json(
      { error: "요청 사항과 내용을 모두 입력해주세요." },
      { status: 400 },
    );
  }

  if (message.length > 1200) {
    return NextResponse.json(
      { error: "요청 내용은 1200자 이내로 작성해주세요." },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const { data: proposal, error: proposalError } = await admin
      .from("meeting_proposals")
      .select("id,proposer_id,status")
      .eq("id", proposalId)
      .maybeSingle();

    if (proposalError) throw proposalError;
    if (!proposal) {
      return NextResponse.json(
        { error: "제안을 찾지 못했어요." },
        { status: 404 },
      );
    }

    if (proposal.proposer_id !== user.id) {
      return NextResponse.json(
        { error: "제안자만 수정 또는 취소 요청을 보낼 수 있어요." },
        { status: 403 },
      );
    }

    if (proposal.status === "rejected") {
      return NextResponse.json(
        { error: "반려된 제안에는 요청을 보낼 수 없어요." },
        { status: 400 },
      );
    }

    const { data, error } = await admin
      .from("meeting_proposal_change_requests")
      .insert({
        proposal_id: proposal.id,
        requester_id: user.id,
        request_type: type,
        request_body: message,
        status: "pending_review",
      })
      .select("id,created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      requestId: data.id,
      createdAt: data.created_at,
    });
  } catch (error) {
    console.error("[meeting proposal change request]", error);
    return NextResponse.json(
      { error: "요청을 저장하지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
