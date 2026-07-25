import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

type TestProfile = {
  user_id: string;
  name: string | null;
  nickname: string | null;
};

export type OperatorTestAccount = {
  userId: string;
  name: string;
  email: string;
};

export function isOperatorSwitchEnabled(user: User) {
  return (
    user.user_metadata?.local_test_user === true ||
    user.user_metadata?.operator_switch_enabled === true
  );
}

function accountFromProfile(profile: TestProfile, user: User | null) {
  if (!user?.email || !isOperatorSwitchEnabled(user)) return null;

  return {
    userId: profile.user_id,
    name: profile.name?.trim() || profile.nickname?.trim() || "테스트 사용자",
    email: user.email,
  } satisfies OperatorTestAccount;
}

export async function loadOperatorTestAccountByUserId(userId: string) {
  if (!userId) return null;

  const admin = createAdminClient();
  const [
    { data: profile, error: profileError },
    { data: userData, error: userError },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("user_id,name,nickname")
      .eq("user_id", userId)
      .eq("is_test_participant", true)
      .maybeSingle<TestProfile>(),
    admin.auth.admin.getUserById(userId),
  ]);

  if (profileError || userError || !profile) return null;
  return accountFromProfile(profile, userData.user);
}

export async function loadOperatorTestAccounts() {
  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("user_id,name,nickname")
    .eq("is_test_participant", true)
    .returns<TestProfile[]>();

  if (error || !profiles?.length) return [];

  const accounts = await Promise.all(
    profiles.map(async (profile) => {
      const { data, error: userError } =
        await admin.auth.admin.getUserById(profile.user_id);
      if (userError) return null;
      return accountFromProfile(profile, data.user);
    }),
  );

  return accounts
    .filter((account): account is OperatorTestAccount => account !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
