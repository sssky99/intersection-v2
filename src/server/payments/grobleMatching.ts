import { type MembershipPlan } from "@/features/membership/membershipTypes";
import { createAdminClient } from "./grobleContext";

export const activeApplicationStatuses = [
  "payment_pending",
  "waitlisted",
  "on_hold",
  "approved",
] as const;

export type ProfileRow = {
  user_id: string;
};

export type ApplicationRow = {
  application_group_id: string;
  user_id: string;
  deposit_amount: number;
  created_at: string;
};

export type PaymentIntentMatchRow = {
  intent_id: number | string;
  application_group_id: string;
};

export type MembershipIntentMatchRow = {
  intent_id: number | string;
  plan: MembershipPlan;
  credit_amount: number;
};

export async function pendingMembershipMatch({
  sellerReference,
  buyerPhone,
  finalAmount,
  paidAt,
}: {
  sellerReference: string | null;
  buyerPhone: string | null;
  finalAmount: number | null;
  paidAt: string | null;
}) {
  if (sellerReference && finalAmount !== null) {
    const { data: referencedIntent, error: referenceError } =
      await createAdminClient()
        .from("membership_payment_intents")
        .select("id,user_id,plan,expected_amount,credit_amount")
        .eq("seller_reference", sellerReference)
        .maybeSingle<{
          id: number | string;
          user_id: string;
          plan: MembershipPlan;
          expected_amount: number;
          credit_amount: number;
        }>();
    if (referenceError) throw referenceError;
    if (
      referencedIntent &&
      (referencedIntent.expected_amount === finalAmount ||
        referencedIntent.expected_amount - referencedIntent.credit_amount ===
          finalAmount)
    ) {
      return {
        status: "matched" as const,
        userId: referencedIntent.user_id,
        intentId: referencedIntent.id,
        plan: referencedIntent.plan,
        creditAmount: referencedIntent.credit_amount,
      };
    }
  }

  if (!buyerPhone || finalAmount === null || !paidAt) {
    return {
      status: "unmatched" as const,
      userId: null,
      intentId: null,
      plan: null,
      creditAmount: 0,
    };
  }

  const paidAtDate = new Date(paidAt);
  if (!Number.isFinite(paidAtDate.getTime())) {
    return {
      status: "unmatched" as const,
      userId: null,
      intentId: null,
      plan: null,
      creditAmount: 0,
    };
  }

  const admin = createAdminClient();
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("user_id")
    .eq("phone_normalized", buyerPhone)
    .is("archived_at", null)
    .limit(2)
    .returns<ProfileRow[]>();
  if (profileError) throw profileError;
  if (!profiles || profiles.length === 0) {
    return {
      status: "unmatched" as const,
      userId: null,
      intentId: null,
      plan: null,
      creditAmount: 0,
    };
  }
  if (profiles.length > 1) {
    return {
      status: "ambiguous" as const,
      userId: null,
      intentId: null,
      plan: null,
      creditAmount: 0,
    };
  }

  const userId = profiles[0].user_id;
  const { data: intents, error: intentError } = await admin.rpc(
    "match_membership_payment_intent",
    {
      p_user_id: userId,
      p_paid_at: paidAtDate.toISOString(),
      p_amount: finalAmount,
    },
  );
  if (intentError) throw intentError;

  const matches = (intents ?? []) as MembershipIntentMatchRow[];
  if (matches.length > 1) {
    return {
      status: "ambiguous" as const,
      userId,
      intentId: null,
      plan: null,
      creditAmount: 0,
    };
  }
  if (matches.length === 0) {
    return {
      status: "unmatched" as const,
      userId,
      intentId: null,
      plan: null,
      creditAmount: 0,
    };
  }

  return {
    status: "matched" as const,
    userId,
    intentId: matches[0].intent_id,
    plan: matches[0].plan,
    creditAmount: matches[0].credit_amount,
  };
}

export async function existingMembershipMatch(eventId: string) {
  const admin = createAdminClient();
  const { data: transaction, error: transactionError } = await admin
    .from("payment_transactions")
    .select("user_id,payment_kind,membership_payment_intent_id")
    .eq("provider", "groble")
    .eq("provider_event_id", eventId)
    .maybeSingle<{
      user_id: string | null;
      payment_kind: string;
      membership_payment_intent_id: number | string | null;
    }>();
  if (transactionError) throw transactionError;
  if (
    !transaction?.user_id ||
    transaction.membership_payment_intent_id === null ||
    ![
      "membership_initial",
      "membership_upgrade",
      "membership_renewal",
    ].includes(transaction.payment_kind)
  ) {
    return null;
  }

  const { data: intent, error: intentError } = await admin
    .from("membership_payment_intents")
    .select("plan,credit_amount")
    .eq("id", transaction.membership_payment_intent_id)
    .eq("user_id", transaction.user_id)
    .maybeSingle<{ plan: MembershipPlan; credit_amount: number }>();
  if (intentError) throw intentError;
  if (!intent) return null;

  return {
    status: "matched" as const,
    userId: transaction.user_id,
    intentId: transaction.membership_payment_intent_id,
    plan: intent.plan,
    creditAmount: intent.credit_amount,
  };
}

export async function existingApplicationMatch(eventId: string) {
  const admin = createAdminClient();
  const { data: transaction, error } = await admin
    .from("payment_transactions")
    .select("user_id,application_group_id")
    .eq("provider", "groble")
    .eq("provider_event_id", eventId)
    .eq("payment_kind", "one_time")
    .maybeSingle<{
      user_id: string | null;
      application_group_id: string | null;
    }>();
  if (error) throw error;
  if (!transaction?.user_id || !transaction.application_group_id) return null;
  const { data: intent, error: intentError } = await admin
    .from("meeting_date_payment_intents")
    .select("id")
    .eq("user_id", transaction.user_id)
    .eq("application_group_id", transaction.application_group_id)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: number | string }>();
  if (intentError) throw intentError;
  return {
    status: "matched" as const,
    userId: transaction.user_id,
    groupId: transaction.application_group_id,
    intentId: intent?.id ?? null,
  };
}

export async function pendingApplicationMatch({
  buyerPhone,
  finalAmount,
  paidAt,
}: {
  buyerPhone: string | null;
  finalAmount: number | null;
  paidAt: string | null;
}) {
  if (!buyerPhone || finalAmount === null) {
    return { status: "unmatched" as const, userId: null, groupId: null };
  }

  const admin = createAdminClient();
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("user_id")
    .eq("phone_normalized", buyerPhone)
    .is("archived_at", null)
    .limit(2)
    .returns<ProfileRow[]>();
  if (profileError) throw profileError;
  if (!profiles || profiles.length === 0) {
    return { status: "unmatched" as const, userId: null, groupId: null };
  }
  if (profiles.length > 1) {
    return { status: "ambiguous" as const, userId: null, groupId: null };
  }

  const userId = profiles[0].user_id;
  if (paidAt) {
    const paidAtDate = new Date(paidAt);
    if (Number.isFinite(paidAtDate.getTime())) {
      const { data: paymentIntents, error: paymentIntentError } =
        await admin.rpc("match_meeting_date_payment_intent", {
          p_user_id: userId,
          p_paid_at: paidAtDate.toISOString(),
          p_amount: finalAmount,
        });
      if (paymentIntentError) throw paymentIntentError;

      const intentMatches = (paymentIntents ?? []) as PaymentIntentMatchRow[];
      if (intentMatches.length > 1) {
        return {
          status: "ambiguous" as const,
          userId,
          groupId: null,
          intentId: null,
        };
      }
      if (intentMatches.length === 1) {
        return {
          status: "matched" as const,
          userId,
          groupId: intentMatches[0].application_group_id,
          intentId: intentMatches[0].intent_id,
        };
      }
    }
  }

  const { count: paymentIntentCount, error: paymentIntentHistoryError } =
    await admin
      .from("meeting_date_payment_intents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
  if (paymentIntentHistoryError) throw paymentIntentHistoryError;
  if ((paymentIntentCount ?? 0) > 0) {
    return {
      status: "unmatched" as const,
      userId,
      groupId: null,
      intentId: null,
    };
  }

  // Compatibility for applications created before payment-intent tracking:
  // only auto-match when exactly one eligible application group exists.
  const { data: applications, error: applicationError } = await admin
    .from("meeting_date_applications")
    .select("application_group_id,user_id,deposit_amount,created_at")
    .eq("user_id", userId)
    .eq("deposit_status", "payment_pending")
    .eq("deposit_amount", finalAmount)
    .in("status", [...activeApplicationStatuses])
    .limit(20)
    .returns<ApplicationRow[]>();
  if (applicationError) throw applicationError;

  const applicationGroups = new Set(
    (applications ?? []).map((application) => application.application_group_id),
  );
  if (applicationGroups.size === 0) {
    return {
      status: "unmatched" as const,
      userId,
      groupId: null,
      intentId: null,
    };
  }
  if (applicationGroups.size > 1) {
    return {
      status: "ambiguous" as const,
      userId,
      groupId: null,
      intentId: null,
    };
  }

  return {
    status: "matched" as const,
    userId,
    groupId: Array.from(applicationGroups)[0],
    intentId: null,
  };
}
