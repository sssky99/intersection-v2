import { createClient } from "@supabase/supabase-js";

const applyChanges = process.argv.includes("--apply");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function loadAllUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

const users = await loadAllUsers();
const candidates = users.filter(
  (user) =>
    user.user_metadata?.local_test_user === true ||
    user.user_metadata?.operator_switch_enabled === true,
);
const secureAccounts = users.filter(
  (user) =>
    user.app_metadata?.local_test_user === true ||
    user.app_metadata?.operator_switch_enabled === true,
);

if (candidates.length === 0) {
  console.log(
    JSON.stringify({
      applyChanges,
      candidates: 0,
      migrated: 0,
      secureAccounts: secureAccounts.length,
    }),
  );
  process.exit(0);
}

const candidateIds = candidates.map((user) => user.id);
const { data: profiles, error: profileError } = await supabase
  .from("profiles")
  .select("user_id,is_test_participant")
  .in("user_id", candidateIds);
if (profileError) throw profileError;

const approvedIds = new Set(
  (profiles ?? [])
    .filter((profile) => profile.is_test_participant === true)
    .map((profile) => profile.user_id),
);
const unapproved = candidates.filter((user) => !approvedIds.has(user.id));
if (unapproved.length > 0) {
  throw new Error(
    `Refusing to migrate ${unapproved.length} account(s) without an approved test-participant profile.`,
  );
}

let migrated = 0;
for (const user of candidates) {
  const {
    local_test_user: localTestUser,
    operator_switch_enabled: operatorSwitchEnabled,
    ...safeUserMetadata
  } = user.user_metadata ?? {};
  const appMetadata = {
    ...(user.app_metadata ?? {}),
    ...(localTestUser === true ? { local_test_user: true } : {}),
    ...(operatorSwitchEnabled === true
      ? { operator_switch_enabled: true }
      : {}),
  };

  if (applyChanges) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: appMetadata,
      user_metadata: {
        ...safeUserMetadata,
        local_test_user: null,
        operator_switch_enabled: null,
      },
    });
    if (error) throw error;
  }
  migrated += 1;
}

console.log(
  JSON.stringify({
    applyChanges,
    candidates: candidates.length,
    migrated,
    secureAccounts: new Set([
      ...secureAccounts.map((user) => user.id),
      ...candidates.map((user) => user.id),
    ]).size,
  }),
);
