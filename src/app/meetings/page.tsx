import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
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
import { normalizeFeedbackParticipationId } from "@/lib/feedbackDeepLink";
import { createAdminClient } from "@/lib/supabase/admin";

type MeetingsPageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
    account?: string | string[];
    feedback?: string | string[];
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

type PreviewPhotoProfile = {
  user_id: string;
  name: string | null;
  birth_year: string | number | null;
  photo_url: string | null;
  created_at: string;
};

const loadPreviewPhotoProfiles = unstable_cache(
  async () => {
    const names = Array.from(
      new Set([
        ...previewMatchProfileNames,
        ...previewOtherMemberProfiles.map(({ name }) => name),
        previewSelfReplacementProfile.name,
      ]),
    );
    const { data } = await createAdminClient()
      .from("profiles")
      .select("user_id,name,birth_year,photo_url,created_at")
      .in("name", names)
      .not("photo_url", "is", null)
      .eq("profile_completed", true)
      .order("created_at", { ascending: false })
      .returns<PreviewPhotoProfile[]>();

    return data ?? [];
  },
  ["meetings-preview-photo-profiles-v1"],
  { revalidate: 300 },
);

function loadPreviewMatchPhotoUrls(
  profiles: PreviewPhotoProfile[],
  currentUserId: string,
  selfReplacementPhotoUrl: string | null,
) {
  const newestPhotoByName = new Map<string, string>();
  for (const row of profiles) {
    const name = row.name?.trim();
    const photoUrl = row.photo_url?.trim();
    if (name && photoUrl && !newestPhotoByName.has(name)) {
      newestPhotoByName.set(name, photoUrl);
    }
  }

  return previewMatchProfileNames
    .map((name) => {
      const profile = profiles.find((row) => row.name?.trim() === name);
      if (profile?.user_id === currentUserId && selfReplacementPhotoUrl) {
        return selfReplacementPhotoUrl;
      }
      return newestPhotoByName.get(name);
    })
    .filter((photoUrl): photoUrl is string => Boolean(photoUrl));
}

function loadPreviewOtherMemberPhotoUrls(
  profiles: PreviewPhotoProfile[],
  currentUserId: string,
  selfReplacementPhotoUrl: string | null,
) {
  return previewOtherMemberProfiles
    .map(({ name, birthYear }) => {
      const profile = profiles.find(
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

function loadPreviewSelfReplacementPhotoUrl(profiles: PreviewPhotoProfile[]) {
  const profile = profiles.find(
    (row) =>
      row.name?.trim() === previewSelfReplacementProfile.name &&
      String(row.birth_year) === previewSelfReplacementProfile.birthYear,
  );
  return profile?.photo_url?.trim() || null;
}

export default async function MeetingsPage({ searchParams }: MeetingsPageProps) {
  const params = await searchParams;
  const { supabase, user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) redirect("/");
  if (!profile.questions_completed) redirect("/onboarding/questions");
  const requestedFeedbackParticipationId = normalizeFeedbackParticipationId(
    params?.feedback,
  );
  let initialFeedbackParticipationId: string | null = null;
  if (requestedFeedbackParticipationId) {
    const { data: feedbackParticipation, error: feedbackParticipationError } =
      await supabase
        .from("ticket_participations")
        .select("id,user_id,status")
        .eq("id", requestedFeedbackParticipationId)
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle<{ id: number | string; user_id: string; status: string }>();

    if (feedbackParticipationError) {
      console.error(
        "Feedback deep link ownership recheck failed:",
        feedbackParticipationError.message,
      );
    } else if (feedbackParticipation?.user_id === user.id) {
      initialFeedbackParticipationId = String(feedbackParticipation.id);
    }
  }
  const legacyPreviewParam = Array.isArray(params?.legacyPreview)
    ? params?.legacyPreview[0]
    : params?.legacyPreview;
  const legacyResultPreview =
    process.env.NODE_ENV === "development" && legacyPreviewParam === "1";

  const cookieStore = await cookies();
  const returnSession = decryptOperatorReturnSession(
    cookieStore.get(OPERATOR_RETURN_SESSION_COOKIE)?.value,
  );
  const operatorMode = isOperatorAccount(user, profile);
  const currentTestAccount =
    !operatorMode && profile.is_test_participant === true
      ? await loadOperatorTestAccountByUserId(user.id, user)
      : null;
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
  const previewPhotoProfiles = await loadPreviewPhotoProfiles();
  const selfReplacementPhotoUrl = loadPreviewSelfReplacementPhotoUrl(
    previewPhotoProfiles,
  );
  const previewMatchPhotoUrls = loadPreviewMatchPhotoUrls(
    previewPhotoProfiles,
    user.id,
    selfReplacementPhotoUrl,
  );
  const previewOtherMemberPhotoUrls = loadPreviewOtherMemberPhotoUrls(
    previewPhotoProfiles,
    user.id,
    selfReplacementPhotoUrl,
  );

  return (
    <MobileFrame>
      <AppHome
        userId={user.id}
        profile={profile}
        initialTab={
          initialFeedbackParticipationId
            ? "browse"
            : initialTabFromSearchParam(params?.tab)
        }
        initialFeedbackParticipationId={initialFeedbackParticipationId}
        initialProfileAccountOpen={
          (Array.isArray(params?.account) ? params.account[0] : params?.account) === "1"
        }
        initialLegacyResultPreview={legacyResultPreview}
        operatorAccountSwitcher={operatorAccountSwitcher}
        previewMatchPhotoUrls={previewMatchPhotoUrls}
        previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
      />
    </MobileFrame>
  );
}
