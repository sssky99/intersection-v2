import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { AppHome, type AppTab } from "@/features/app/AppHome";
import {
  ADMIN_USER_VIEW_COOKIE,
  decryptAdminUserViewSession,
} from "@/lib/adminUserView";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileRow } from "@/types/profile";

type UserViewPageProps = {
  searchParams?: Promise<{ tab?: string | string[] }>;
};

function selectedTab(value: string | string[] | undefined): AppTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "browse" || tab === "chat" || tab === "profile"
    ? tab
    : "recommend";
}

export default async function AdminUserViewPage({
  searchParams,
}: UserViewPageProps) {
  const cookieStore = await cookies();
  if (
    !isAdminSessionTokenValid(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
  ) {
    redirect("/admin");
  }

  const view = decryptAdminUserViewSession(
    cookieStore.get(ADMIN_USER_VIEW_COOKIE)?.value,
  );
  if (!view) redirect("/admin");

  const admin = createAdminClient();
  const [{ data: profile }, { data: answerRows }] = await Promise.all([
    admin
      .from("profiles")
      .select("*")
      .eq("user_id", view.targetUserId)
      .maybeSingle<ProfileRow>(),
    admin
      .from("user_answers")
      .select("question_order,answer_value,answer_values,answer_text,other_text")
      .eq("user_id", view.targetUserId)
      .order("question_order"),
  ]);
  if (!profile) redirect("/admin");

  const params = await searchParams;
  return (
    <MobileFrame>
      <AppHome
        userId={profile.user_id}
        profile={profile}
        initialAnswerRows={answerRows ?? []}
        initialTab={selectedTab(params?.tab)}
        readOnlyView={{ targetName: view.targetName }}
      />
    </MobileFrame>
  );
}
