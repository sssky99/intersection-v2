import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import {
  AppHome,
  type AppTab,
  type OperatorAccountSwitcher,
} from "@/features/app/AppHome";
import { getAuthenticatedProfile } from "@/lib/onboarding";
import {
  decryptOperatorReturnSession,
  isOperatorAccount,
  OPERATOR_RETURN_SESSION_COOKIE,
} from "@/lib/operatorSessionSwitch";
import {
  loadOperatorTestAccountByUserId,
  loadOperatorTestAccounts,
} from "@/lib/operatorTestAccounts";
import { createAdminClient } from "@/lib/supabase/admin";

type MeetingsPageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
    legacyPreview?: string | string[];
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

const previewMatchProfileNames = [
  "안민후",
  "김보원",
  "홍지혜",
  "김민철",
  "함채우",
] as const;

const previewOtherMemberProfiles = [
  { name: "김재원", birthYear: "2006" },
  { name: "김민주", birthYear: "2000" },
  { name: "이원지", birthYear: "2006" },
  { name: "강유진", birthYear: "2004" },
  { name: "유도현", birthYear: "2007" },
  { name: "이기태", birthYear: "2005" },
] as const;

const previewSelfReplacementProfile = {
  name: "이준규",
  birthYear: "2007",
} as const;

async function loadPreviewMatchPhotoUrls(
  currentUserId: string,
  selfReplacementPhotoUrl: string | null,
) {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("user_id,name,photo_url,created_at")
    .in("name", [...previewMatchProfileNames])
    .not("photo_url", "is", null)
    .eq("profile_completed", true)
    .order("created_at", { ascending: false });

  const newestPhotoByName = new Map<string, string>();
  for (const row of data ?? []) {
    const name = row.name?.trim();
    const photoUrl = row.photo_url?.trim();
    if (name && photoUrl && !newestPhotoByName.has(name)) {
      newestPhotoByName.set(name, photoUrl);
    }
  }

  return previewMatchProfileNames
    .map((name) => {
      const profile = (data ?? []).find((row) => row.name?.trim() === name);
      if (profile?.user_id === currentUserId && selfReplacementPhotoUrl) {
        return selfReplacementPhotoUrl;
      }
      return newestPhotoByName.get(name);
    })
    .filter((photoUrl): photoUrl is string => Boolean(photoUrl));
}

async function loadPreviewOtherMemberPhotoUrls(
  currentUserId: string,
  selfReplacementPhotoUrl: string | null,
) {
  const names = previewOtherMemberProfiles.map(({ name }) => name);
  const { data } = await createAdminClient()
    .from("profiles")
    .select("user_id,name,birth_year,photo_url")
    .in("name", names)
    .not("photo_url", "is", null)
    .eq("profile_completed", true);

  return previewOtherMemberProfiles
    .map(({ name, birthYear }) => {
      const profile = data?.find(
        (profile) =>
          profile.name?.trim() === name &&
          String(profile.birth_year) === birthYear,
      );
      if (profile?.user_id === currentUserId && selfReplacementPhotoUrl) {
        return selfReplacementPhotoUrl;
      }
      return profile?.photo_url?.trim();
    })
    .filter((photoUrl): photoUrl is string => Boolean(photoUrl));
}

async function loadPreviewSelfReplacementPhotoUrl() {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("photo_url")
    .eq("name", previewSelfReplacementProfile.name)
    .eq("birth_year", previewSelfReplacementProfile.birthYear)
    .eq("profile_completed", true)
    .not("photo_url", "is", null)
    .maybeSingle();

  return data?.photo_url?.trim() || null;
}

export default async function MeetingsPage({ searchParams }: MeetingsPageProps) {
  const params = await searchParams;
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) redirect("/");
  if (!profile.questions_completed) redirect("/onboarding/questions");
  const legacyPreviewParam = Array.isArray(params?.legacyPreview)
    ? params?.legacyPreview[0]
    : params?.legacyPreview;
  const legacyResultPreview =
    process.env.NODE_ENV === "development" && legacyPreviewParam === "1";

  const cookieStore = await cookies();
  const returnSession = decryptOperatorReturnSession(
    cookieStore.get(OPERATOR_RETURN_SESSION_COOKIE)?.value,
  );
  const currentTestAccount = await loadOperatorTestAccountByUserId(user.id);
  const { data: authoritativeUserData } =
    await createAdminClient().auth.admin.getUserById(user.id);
  const operatorMode = isOperatorAccount(
    authoritativeUserData.user ?? user,
    profile,
  );
  const testAccounts = operatorMode ? await loadOperatorTestAccounts() : [];
  const operatorAccountSwitcher: OperatorAccountSwitcher = operatorMode
    ? {
        mode: "operator",
        accounts: testAccounts.map(({ userId, name }) => ({
          userId,
          name,
        })),
      }
    : currentTestAccount && returnSession?.targetUserId === user.id
      ? { mode: "test" }
      : null;
  const selfReplacementPhotoUrl = await loadPreviewSelfReplacementPhotoUrl();
  const [previewMatchPhotoUrls, previewOtherMemberPhotoUrls] = await Promise.all([
    loadPreviewMatchPhotoUrls(user.id, selfReplacementPhotoUrl),
    loadPreviewOtherMemberPhotoUrls(user.id, selfReplacementPhotoUrl),
  ]);

  return (
    <MobileFrame>
      <AppHome
        userId={user.id}
        profile={profile}
        initialTab={initialTabFromSearchParam(params?.tab)}
        initialLegacyResultPreview={legacyResultPreview}
        operatorAccountSwitcher={operatorAccountSwitcher}
        previewMatchPhotoUrls={previewMatchPhotoUrls}
        previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
      />
    </MobileFrame>
  );
}
