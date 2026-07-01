import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import {
  AppHome,
  type AppTab,
  type OperatorAccountSwitcher,
} from "@/features/app/AppHome";
import { loadTicketQuestionTemplates } from "@/features/onboarding/loadTicketQuestionTemplates";
import { getAuthenticatedProfile } from "@/lib/onboarding";
import {
  decryptOperatorReturnSession,
  isOperatorAccount,
  OPERATOR_RETURN_SESSION_COOKIE,
} from "@/lib/operatorSessionSwitch";
import {
  operatorTestAccountByUserId,
  operatorTestAccounts,
} from "@/lib/operatorTestAccounts";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasUsablePublicIntro } from "@/lib/textQuality";

type MeetingsPageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
    profileComplete?: string | string[];
  }>;
};

function initialTabFromSearchParam(value: string | string[] | undefined): AppTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "browse" ||
    tab === "chat" ||
    tab === "profile"
    ? tab
    : "recommend";
}

export default async function MeetingsPage({ searchParams }: MeetingsPageProps) {
  const params = await searchParams;
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) redirect("/");
  if (!profile.questions_completed) redirect("/onboarding/questions");
  if (!profile.profile_completed) redirect("/onboarding/profile");
  const introUsable = hasUsablePublicIntro(profile.public_intro);
  const profileCompleteParam = Array.isArray(params?.profileComplete)
    ? params?.profileComplete[0]
    : params?.profileComplete;
  const hasUnrevealedGeneratedIntro = Boolean(
    profile.public_intro_generated_at &&
      profile.public_intro_revealed_generated_at !==
        profile.public_intro_generated_at,
  );
  const shouldOpenCompletionModal =
    hasUnrevealedGeneratedIntro ||
    (profileCompleteParam === "1" && !introUsable);
  if (!introUsable && !shouldOpenCompletionModal) redirect("/profile/result");

  const ticketQuestionTemplates = await loadTicketQuestionTemplates();
  const cookieStore = await cookies();
  const returnSession = decryptOperatorReturnSession(
    cookieStore.get(OPERATOR_RETURN_SESSION_COOKIE)?.value,
  );
  const currentTestAccount = operatorTestAccountByUserId(user.id);
  const { data: authoritativeUserData } =
    await createAdminClient().auth.admin.getUserById(user.id);
  const operatorAccountSwitcher: OperatorAccountSwitcher = isOperatorAccount(
    authoritativeUserData.user ?? user,
    profile,
  )
    ? {
        mode: "operator",
        accounts: operatorTestAccounts.map(({ userId, name }) => ({
          userId,
          name,
        })),
      }
    : currentTestAccount && returnSession?.targetUserId === user.id
      ? { mode: "test" }
      : null;

  return (
    <MobileFrame>
      <AppHome
        userId={user.id}
        profile={profile}
        initialTab={initialTabFromSearchParam(params?.tab)}
        initialProfileCompletionOpen={shouldOpenCompletionModal}
        ticketQuestionTemplates={ticketQuestionTemplates}
        operatorAccountSwitcher={operatorAccountSwitcher}
      />
    </MobileFrame>
  );
}
