import Link from "next/link";
import { redirect } from "next/navigation";
import { FiftyQLandingClient } from "@/app/FiftyQLandingClient";
import {
  feedbackDeepLinkPath,
  normalizeFeedbackParticipationId,
} from "@/lib/feedbackDeepLink";
import { createClient } from "@/lib/supabase/server";
import { FeedbackAccountSwitchButton } from "./FeedbackAccountSwitchButton";

export const dynamic = "force-dynamic";

type FeedbackDeepLinkPageProps = {
  params: Promise<{ participationId: string }>;
};

type ParticipationAccessRow = {
  id: number | string;
  user_id: string;
  status: string;
};

function FeedbackLinkNotice({
  title,
  body,
  accountSwitchPath,
}: {
  title: string;
  body: string;
  accountSwitchPath?: string;
}) {
  return (
    <main className="flex min-h-dvh justify-center bg-[#e9e9e5] text-[#24211d] md:px-4">
      <section className="flex min-h-dvh w-full max-w-[430px] items-center bg-[#f7f4ed] px-6 md:my-4 md:min-h-[calc(100dvh-32px)] md:rounded-[32px] md:border md:border-black/[0.06] md:shadow-frame">
        <div className="w-full rounded-[28px] border border-black/10 bg-[#faf8f3] px-6 py-8 text-center shadow-[0_18px_50px_rgba(36,33,29,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/35">
            feedback
          </p>
          <h1 className="mt-3 text-[23px] font-black">{title}</h1>
          <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-6 text-black/55">
            {body}
          </p>
          <Link
            href="/meetings?tab=browse"
            className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-[#24211d] px-6 text-sm font-black text-white"
          >
            내 티켓 보기
          </Link>
          {accountSwitchPath && (
            <div>
              <FeedbackAccountSwitchButton returnPath={accountSwitchPath} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default async function FeedbackDeepLinkPage({
  params,
}: FeedbackDeepLinkPageProps) {
  const { participationId: rawParticipationId } = await params;
  const participationId = normalizeFeedbackParticipationId(rawParticipationId);

  if (!participationId) {
    return (
      <FeedbackLinkNotice
        title="올바르지 않은 피드백 링크예요"
        body="문자로 받은 링크가 모두 열렸는지 확인해주세요."
      />
    );
  }

  const returnPath = feedbackDeepLinkPath(participationId);
  const supabase = await createClient({ timeoutMs: 3000 });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user) {
    if (authError && authError.name !== "AuthSessionMissingError") {
      console.error("Feedback deep link auth lookup failed:", authError.message);
    }

    return (
      <FiftyQLandingClient
        initialHasSeenIntro
        trackLandingView={false}
        completionPath={returnPath}
        authSource="feedback_deeplink"
      />
    );
  }

  const { data, error } = await supabase
    .from("ticket_participations")
    .select("id,user_id,status")
    .eq("id", participationId)
    .eq("user_id", user.id)
    .maybeSingle<ParticipationAccessRow>();

  if (error) {
    console.error("Feedback deep link participation lookup failed:", error.message);
    throw new Error("Feedback participation lookup failed.");
  }

  if (!data || data.user_id !== user.id) {
    return (
      <FeedbackLinkNotice
        title="이 피드백 링크를 열 수 없어요"
        body={"현재 로그인한 계정의 모임 링크가 아니에요.\n문자를 받은 전화번호로 다시 로그인해주세요."}
        accountSwitchPath={returnPath}
      />
    );
  }

  if (data.status === "feedback_done") {
    return (
      <FeedbackLinkNotice
        title="이미 피드백을 남겼어요"
        body="제출한 피드백은 안전하게 저장되어 있어요."
      />
    );
  }

  if (data.status !== "approved") {
    return (
      <FeedbackLinkNotice
        title="지금은 피드백을 작성할 수 없어요"
        body="피드백 대상 여부나 작성 기간을 확인해주세요."
      />
    );
  }

  redirect(`/meetings?tab=browse&feedback=${participationId}`);
}
