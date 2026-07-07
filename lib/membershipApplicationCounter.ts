import type { createAdminClient } from "@/lib/supabase/admin";

export const membershipApplicationCounterKey =
  "free_deposit_message_registrations";
export const membershipApplicationFallbackCount = 66;
export const membershipApplicationLimitCount = 100;

type ServiceCounter = {
  base_count: number | null;
  limit_count: number | null;
};

type AdminClient = ReturnType<typeof createAdminClient>;

export async function membershipApplicationCounter(admin: AdminClient) {
  const [counterResult, applicationCountResult] = await Promise.all([
    admin
      .from("service_counters")
      .select("base_count,limit_count")
      .eq("counter_key", membershipApplicationCounterKey)
      .maybeSingle<ServiceCounter>(),
    admin
      .from("deposit_message_registrations")
      .select("id", { count: "exact", head: true }),
  ]);

  if (counterResult.error) {
    console.error(
      "Membership application counter lookup error:",
      counterResult.error,
    );
  }

  if (applicationCountResult.error) {
    console.error(
      "Membership application count lookup error:",
      applicationCountResult.error,
    );
  }

  const baseCount =
    typeof counterResult.data?.base_count === "number"
      ? counterResult.data.base_count
      : membershipApplicationFallbackCount;
  const applicationCount = applicationCountResult.count ?? 0;

  return {
    count: baseCount + applicationCount,
    baseCount,
    applicationCount,
    limitCount:
      typeof counterResult.data?.limit_count === "number"
        ? counterResult.data.limit_count
        : membershipApplicationLimitCount,
  };
}

export async function incrementMembershipApplicationCounter(
  admin: AdminClient,
  userId: string,
) {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("deposit_message_registrations")
    .insert({
      user_id: userId,
      first_ticket_instance_id: null,
      created_at: now,
      updated_at: now,
    });

  if (error && error.code !== "23505") {
    console.error("Membership application counter increment error:", error);
  }
}
