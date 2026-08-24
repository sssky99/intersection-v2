import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  calculateMembershipEndDate,
  hasCurrentMembershipAccess,
  todayKoreaDateString,
  type MembershipPlan,
} from "@/features/membership/membershipTypes";
import { incrementMembershipApplicationCounter } from "@/lib/membershipApplicationCounter";
import { grobleCompletedPaymentKind } from "@/lib/groblePaymentEvent";
import { reportMetaPurchase } from "@/lib/metaConversions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxBodyBytes = 1024 * 1024;
const signatureToleranceSeconds = 5 * 60;
const activeApplicationStatuses = [
  "payment_pending",
  "waitlisted",
  "on_hold",
  "approved",
] as const;

type JsonRecord = Record<string, unknown>;
type WebhookEnvelope = {
  id: string;
  type: string;
  version: string | null;
  occurredAt: string | null;
  object: JsonRecord;
  payload: JsonRecord;
};
type ProfileRow = {
  user_id: string;
};
type ApplicationRow = {
  application_group_id: string;
  user_id: string;
  deposit_amount: number;
  created_at: string;
};
type PaymentIntentMatchRow = {
  intent_id: number | string;
  application_group_id: string;
};
type MembershipIntentMatchRow = {
  intent_id: number | string;
  plan: MembershipPlan;
  credit_amount: number;
};
type MatchedMembershipPayment = {
  status: "matched";
  userId: string;
  intentId: number | string;
  plan: MembershipPlan;
  creditAmount: number;
};
type PaymentKind =
  | "one_time"
  | "membership_initial"
  | "membership_upgrade"
  | "membership_renewal";
type PaymentTransactionRow = {
  id: number | string;
  user_id: string | null;
  payment_kind: PaymentKind | "unknown";
  amount: number;
  application_group_id: string | null;
  membership_payment_intent_id: number | string | null;
};
type MembershipProfileRow = {
  membership_status: string | null;
  membership_plan: MembershipPlan | null;
  membership_start_date: string | null;
  membership_end_date: string | null;
  membership_updated_at: string | null;
};

function jsonRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizePhone(value: unknown) {
  let digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  if (digits.startsWith("82") && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  }
  return digits.length >= 10 && digits.length <= 11 ? digits : null;
}

function parseEnvelope(rawBody: string): WebhookEnvelope | null {
  const parsed = jsonRecord(JSON.parse(rawBody) as unknown);
  const data = jsonRecord(parsed?.data);
  const object = jsonRecord(data?.object);
  const id = text(parsed?.id);
  const type = text(parsed?.type);

  if (!parsed || !object || !id || !type) return null;

  return {
    id,
    type,
    version: text(parsed.version),
    occurredAt: text(parsed.occurredAt),
    object,
    payload: parsed,
  };
}

function validTimestamp(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return false;
  const timestamp = Number(value);
  if (!Number.isSafeInteger(timestamp)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - timestamp) <= signatureToleranceSeconds;
}

function matchesSignature(signature: string, expected: string) {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const actualBuffer = Buffer.from(signature.toLowerCase(), "hex");
  const expectedBuffer = Buffer.from(expected.toLowerCase(), "hex");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function verifySignature({
  rawBody,
  timestamp,
  signatures,
}: {
  rawBody: string;
  timestamp: string;
  signatures: string[];
}) {
  const secrets = [
    process.env.GROBLE_WEBHOOK_SECRET,
    process.env.GROBLE_WEBHOOK_SECRET_PREVIOUS,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (secrets.length === 0) {
    throw new Error("GROBLE_WEBHOOK_SECRET is not configured.");
  }

  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`, "utf8")
      .digest("hex");
    return signatures.some((signature) => matchesSignature(signature, expected));
  });
}

function objectParts(object: JsonRecord) {
  const buyer = jsonRecord(object.buyer);
  const pricing = jsonRecord(object.pricing);
  const payment = jsonRecord(object.payment);
  const cancelRequest = jsonRecord(object.cancelRequest);

  return {
    merchantUid: text(object.merchantUid),
    sellerReference: text(object.sellerReference),
    buyerPhone: normalizePhone(buyer?.phoneNumber),
    buyerName:
      text(buyer?.name) ??
      text(buyer?.fullName) ??
      text(buyer?.buyerName) ??
      text(object.buyerName),
    finalAmount: number(pricing?.finalAmount),
    purchasedAt: text(payment?.purchasedAt),
    cancelRequestedAt: text(cancelRequest?.requestedAt),
  };
}

async function eventStatus(
  idempotencyKey: string,
  values: Record<string, unknown>,
) {
  const { error } = await createAdminClient()
    .from("groble_webhook_events")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("idempotency_key", idempotencyKey);
  if (error) throw error;
}

async function pendingMembershipMatch({
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

async function existingMembershipMatch(eventId: string) {
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

async function pendingApplicationMatch({
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

async function membershipPaymentKind({
  userId,
  creditAmount,
}: {
  userId: string;
  creditAmount: number;
}): Promise<PaymentKind> {
  if (creditAmount > 0) return "membership_upgrade";

  const { count, error } = await createAdminClient()
    .from("payment_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("payment_kind", [
      "membership_initial",
      "membership_upgrade",
      "membership_renewal",
    ]);
  if (error) throw error;
  return (count ?? 0) > 0 ? "membership_renewal" : "membership_initial";
}

function addDateOnlyDays(value: string, days: number) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return value;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function sameInstant(left: string | null, right: string) {
  if (!left) return false;
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return (
    Number.isFinite(leftTime) &&
    Number.isFinite(rightTime) &&
    leftTime === rightTime
  );
}

async function processMembershipPayment({
  envelope,
  idempotencyKey,
  details,
  match,
}: {
  envelope: WebhookEnvelope;
  idempotencyKey: string;
  details: ReturnType<typeof objectParts>;
  match: MatchedMembershipPayment;
}) {
  if (details.finalAmount === null) {
    throw new Error("Membership payment amount is missing.");
  }

  const paidAt =
    details.purchasedAt ?? envelope.occurredAt ?? new Date().toISOString();
  const paymentKind = await membershipPaymentKind({
    userId: match.userId,
    creditAmount: match.creditAmount,
  });
  const admin = createAdminClient();
  const { data: existingTransaction, error: existingTransactionError } =
    await admin
      .from("payment_transactions")
      .select("payment_kind")
      .eq("provider", "groble")
      .eq("provider_event_id", envelope.id)
      .maybeSingle<{ payment_kind: PaymentKind }>();
  if (existingTransactionError) throw existingTransactionError;
  const resolvedPaymentKind = existingTransaction?.payment_kind ?? paymentKind;
  const { data: membershipIntent, error: membershipIntentError } = await admin
    .from("membership_payment_intents")
    .select("meeting_date_application_id,opened_at")
    .eq("id", match.intentId)
    .eq("user_id", match.userId)
    .single<{
      meeting_date_application_id: number | string | null;
      opened_at: string;
    }>();
  if (membershipIntentError) throw membershipIntentError;

  let linkedApplicationId = membershipIntent.meeting_date_application_id;
  if (linkedApplicationId === null) {
    const openedAt = new Date(membershipIntent.opened_at);
    if (Number.isFinite(openedAt.getTime())) {
      const compatibilityWindowStart = new Date(
        openedAt.getTime() - 15 * 60 * 1000,
      ).toISOString();
      const { data: compatibilityApplications, error: compatibilityError } =
        await admin
          .from("meeting_date_applications")
          .select("id")
          .eq("user_id", match.userId)
          .eq("status", "payment_pending")
          .eq("deposit_status", "payment_pending")
          .gte("created_at", compatibilityWindowStart)
          .lte("created_at", membershipIntent.opened_at)
          .order("created_at", { ascending: false })
          .limit(2)
          .returns<Array<{ id: number | string }>>();
      if (compatibilityError) throw compatibilityError;
      if (compatibilityApplications?.length === 1) {
        linkedApplicationId = compatibilityApplications[0].id;
      }
    }
  }

  const { error: transactionError } = await admin
    .from("payment_transactions")
    .upsert(
      {
        provider: "groble",
        provider_event_id: envelope.id,
        merchant_uid: details.merchantUid,
        user_id: match.userId,
        payment_kind: resolvedPaymentKind,
        product_code: `membership:${match.plan}`,
        amount: details.finalAmount,
        status: "completed",
        occurred_at: paidAt,
        membership_payment_intent_id: match.intentId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,provider_event_id" },
    );
  if (transactionError) throw transactionError;

  const { error: intentUpdateError } = await admin
    .from("membership_payment_intents")
    .update({
      status: "completed",
      ended_at: paidAt,
      completed_at: paidAt,
      groble_payment_event_id: envelope.id,
      meeting_date_application_id: linkedApplicationId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", match.intentId)
    .eq("user_id", match.userId);
  if (intentUpdateError) throw intentUpdateError;

  let linkedTicketInstanceId: string | null = null;
  let linkedMeetingDate: string | null = null;
  if (linkedApplicationId !== null) {
    const { data: linkedApplication, error: linkedApplicationError } = await admin
      .from("meeting_date_applications")
      .select("id,status,meeting_date,assigned_ticket_instance_id")
      .eq("id", linkedApplicationId)
      .eq("user_id", match.userId)
      .maybeSingle<{
        id: number | string;
        status: string;
        meeting_date: string;
        assigned_ticket_instance_id: string | null;
      }>();
    if (linkedApplicationError) throw linkedApplicationError;
    if (!linkedApplication) {
      throw new Error("Linked meeting date application was not found.");
    }

    linkedTicketInstanceId = linkedApplication.assigned_ticket_instance_id;
    linkedMeetingDate = linkedApplication.meeting_date;
    if (linkedApplication.status === "payment_pending") {
      const { error: applicationUpdateError } = await admin
        .from("meeting_date_applications")
        .update({
          status: "waitlisted",
          groble_merchant_uid: details.merchantUid,
          groble_payment_event_id: envelope.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", linkedApplication.id)
        .eq("user_id", match.userId)
        .eq("status", "payment_pending");
      if (applicationUpdateError) throw applicationUpdateError;
    }

    if (linkedTicketInstanceId) {
      const { error: participationUpdateError } = await admin
        .from("ticket_participations")
        .update({
          status: "waitlisted",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", match.userId)
        .eq("ticket_instance_id", linkedTicketInstanceId)
        .eq("status", "payment_pending");
      if (participationUpdateError) throw participationUpdateError;
    }
  }

  const { data: membershipProfile, error: membershipProfileError } = await admin
    .from("profiles")
    .select(
      "membership_status,membership_plan,membership_start_date,membership_end_date,membership_updated_at",
    )
    .eq("user_id", match.userId)
    .single<MembershipProfileRow>();
  if (membershipProfileError) throw membershipProfileError;

  const alreadyApplied = sameInstant(
    membershipProfile.membership_updated_at,
    paidAt,
  );
  const previouslyActive = hasCurrentMembershipAccess({
    status: membershipProfile.membership_status,
    startDate: membershipProfile.membership_start_date,
    endDate: membershipProfile.membership_end_date,
  });
  const paidAtDate = new Date(paidAt);
  const paidDate = todayKoreaDateString(
    Number.isFinite(paidAtDate.getTime()) ? paidAtDate : new Date(),
  );
  const isRenewal =
    resolvedPaymentKind === "membership_renewal" &&
    previouslyActive &&
    Boolean(membershipProfile.membership_end_date);
  const periodBaseDate = isRenewal
    ? addDateOnlyDays(membershipProfile.membership_end_date!, 1)
    : linkedMeetingDate ?? paidDate;
  const membershipStartDate = isRenewal
    ? membershipProfile.membership_start_date ?? paidDate
    : periodBaseDate;
  const membershipEndDate = alreadyApplied
    ? membershipProfile.membership_end_date ??
      calculateMembershipEndDate(periodBaseDate, match.plan)
    : calculateMembershipEndDate(periodBaseDate, match.plan);

  const { error: membershipUpdateError } = await admin
    .from("profiles")
    .update({
      membership_status: "active",
      membership_plan: match.plan,
      membership_start_date: membershipStartDate,
      membership_end_date: membershipEndDate,
      membership_updated_at: paidAt,
    })
    .eq("user_id", match.userId);
  if (membershipUpdateError) throw membershipUpdateError;

  if (!previouslyActive && !alreadyApplied) {
    await incrementMembershipApplicationCounter(admin, match.userId);
  }

  const ticketInteractionQuery = admin
    .from("ticket_user_interactions")
    .select(
      "ticket_instance_id,ticket_template_id,opened_at,responded_at,payment_started_at",
    )
    .eq("user_id", match.userId);
  const { data: pendingTicketInteraction, error: pendingTicketInteractionError } =
    linkedTicketInstanceId
      ? await ticketInteractionQuery
          .eq("ticket_instance_id", linkedTicketInstanceId)
          .maybeSingle<{
            ticket_instance_id: string;
            ticket_template_id: string;
            opened_at: string | null;
            responded_at: string | null;
            payment_started_at: string | null;
          }>()
      : await ticketInteractionQuery
          .eq("status", "payment_pending")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle<{
            ticket_instance_id: string;
            ticket_template_id: string;
            opened_at: string | null;
            responded_at: string | null;
            payment_started_at: string | null;
          }>();
  if (pendingTicketInteractionError) throw pendingTicketInteractionError;

  if (pendingTicketInteraction) {
    const { error: interactionError } = await admin
      .from("ticket_user_interactions")
      .upsert(
        {
          user_id: match.userId,
          ticket_instance_id: pendingTicketInteraction.ticket_instance_id,
          ticket_template_id: pendingTicketInteraction.ticket_template_id,
          status: "payment_confirmed",
          opened_at: pendingTicketInteraction.opened_at ?? paidAt,
          responded_at: pendingTicketInteraction.responded_at ?? paidAt,
          payment_started_at:
            pendingTicketInteraction.payment_started_at ?? paidAt,
          payment_confirmed_at: paidAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,ticket_instance_id" },
      );
    if (interactionError) throw interactionError;
  }

  await syncProfileNameFromPayment({
    userId: match.userId,
    buyerName: details.buyerName,
  });

  await eventStatus(idempotencyKey, {
    processing_status: "processed",
    merchant_uid: details.merchantUid,
    matched_user_id: match.userId,
    matched_membership_payment_intent_id: match.intentId,
    payment_kind: resolvedPaymentKind,
    payment_amount: details.finalAmount,
    processed_at: new Date().toISOString(),
  });
  await reportMetaPurchase(admin, envelope.id);
  return "processed";
}

async function syncProfileNameFromPayment({
  userId,
  buyerName,
}: {
  userId: string;
  buyerName: string | null;
}) {
  const normalizedBuyerName = buyerName?.trim();
  if (!normalizedBuyerName) return;

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("name,nickname")
    .eq("user_id", userId)
    .maybeSingle<{ name: string | null; nickname: string | null }>();
  if (profileError) throw profileError;
  if (!profile) return;

  const currentName = profile.name?.trim() ?? "";
  if (currentName === normalizedBuyerName) return;

  const nickname = profile.nickname?.trim() || currentName || null;
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      name: normalizedBuyerName,
      nickname,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (updateError) throw updateError;
}

async function processPaymentCompleted(
  envelope: WebhookEnvelope,
  idempotencyKey: string,
) {
  const details = objectParts(envelope.object);
  const paymentOccurredAt = details.purchasedAt ?? envelope.occurredAt;
  const completedPaymentKind = grobleCompletedPaymentKind(envelope.type);

  if (completedPaymentKind === "membership") {
    const membershipMatch =
      (await existingMembershipMatch(envelope.id)) ??
      (await pendingMembershipMatch({
        ...details,
        paidAt: paymentOccurredAt,
      }));

    if (
      membershipMatch.status === "matched" &&
      membershipMatch.userId &&
      membershipMatch.intentId !== null &&
      membershipMatch.plan
    ) {
      return processMembershipPayment({
        envelope,
        idempotencyKey,
        details,
        match: {
          ...membershipMatch,
          status: "matched",
          userId: membershipMatch.userId,
          intentId: membershipMatch.intentId,
          plan: membershipMatch.plan,
        },
      });
    }

    await eventStatus(idempotencyKey, {
      processing_status: membershipMatch.status,
      matched_user_id: membershipMatch.userId,
      processed_at: new Date().toISOString(),
    });
    return membershipMatch.status;
  }

  const match = await pendingApplicationMatch({
    ...details,
    paidAt: paymentOccurredAt,
  });

  if (match.status !== "matched" || !match.userId || !match.groupId) {
    await eventStatus(idempotencyKey, {
      processing_status: match.status,
      matched_user_id: match.userId,
      processed_at: new Date().toISOString(),
    });
    return match.status;
  }

  const paidAt = paymentOccurredAt ?? new Date().toISOString();
  const admin = createAdminClient();
  const { error: transactionError } = await admin
    .from("payment_transactions")
    .upsert(
      {
        provider: "groble",
        provider_event_id: envelope.id,
        merchant_uid: details.merchantUid,
        user_id: match.userId,
        payment_kind: "one_time",
        product_code: "meeting_date_ticket",
        amount: details.finalAmount,
        status: "completed",
        occurred_at: paidAt,
        application_group_id: match.groupId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,provider_event_id" },
    );
  if (transactionError) throw transactionError;

  const { error: updateError } = await admin
    .from("meeting_date_applications")
    .update({
      status: "waitlisted",
      deposit_status: "confirmed",
      deposit_confirmed_at: paidAt,
      groble_merchant_uid: details.merchantUid,
      groble_payment_event_id: envelope.id,
      updated_at: new Date().toISOString(),
    })
    .eq("application_group_id", match.groupId)
    .eq("user_id", match.userId);
  if (updateError) throw updateError;

  const { data: paidApplications, error: paidApplicationsError } = await admin
    .from("meeting_date_applications")
    .select("assigned_ticket_instance_id")
    .eq("application_group_id", match.groupId)
    .eq("user_id", match.userId)
    .not("assigned_ticket_instance_id", "is", null)
    .returns<Array<{ assigned_ticket_instance_id: string | null }>>();
  if (paidApplicationsError) throw paidApplicationsError;

  const paidTicketIds = Array.from(
    new Set(
      (paidApplications ?? [])
        .map((row) => row.assigned_ticket_instance_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (paidTicketIds.length > 0) {
    const { data: paidTicketInstances, error: paidTicketInstancesError } =
      await admin
        .from("ticket_instances")
        .select("id,template_id")
        .in("id", paidTicketIds)
        .returns<Array<{ id: string; template_id: string }>>();
    if (paidTicketInstancesError) throw paidTicketInstancesError;

    const { data: existingInteractions, error: existingInteractionsError } =
      await admin
        .from("ticket_user_interactions")
        .select(
          "ticket_instance_id,opened_at,responded_at,payment_started_at",
        )
        .eq("user_id", match.userId)
        .in("ticket_instance_id", paidTicketIds)
        .returns<
          Array<{
            ticket_instance_id: string;
            opened_at: string | null;
            responded_at: string | null;
            payment_started_at: string | null;
          }>
        >();
    if (existingInteractionsError) throw existingInteractionsError;
    const existingInteractionMap = new Map(
      (existingInteractions ?? []).map((row) => [row.ticket_instance_id, row]),
    );

    const { error: interactionError } = await admin
      .from("ticket_user_interactions")
      .upsert(
        (paidTicketInstances ?? []).map((ticket) => {
          const existing = existingInteractionMap.get(ticket.id);
          return {
            user_id: match.userId,
            ticket_instance_id: ticket.id,
            ticket_template_id: ticket.template_id,
            status: "payment_confirmed",
            opened_at: existing?.opened_at ?? paidAt,
            responded_at: existing?.responded_at ?? paidAt,
            payment_started_at: existing?.payment_started_at ?? paidAt,
            payment_confirmed_at: paidAt,
            updated_at: new Date().toISOString(),
          };
        }),
        { onConflict: "user_id,ticket_instance_id" },
      );
    if (interactionError) throw interactionError;
  }

  await syncProfileNameFromPayment({
    userId: match.userId,
    buyerName: details.buyerName,
  });

  if (match.intentId !== null) {
    const { error: intentUpdateError } = await admin
      .from("meeting_date_payment_intents")
      .update({
        status: "completed",
        ended_at: paidAt,
        completed_at: paidAt,
        groble_payment_event_id: envelope.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.intentId)
      .eq("user_id", match.userId);
    if (intentUpdateError) throw intentUpdateError;
  }

  await eventStatus(idempotencyKey, {
    processing_status: "processed",
    merchant_uid: details.merchantUid,
    matched_user_id: match.userId,
    matched_application_group_id: match.groupId,
    matched_payment_intent_id: match.intentId,
    payment_kind: "one_time",
    payment_amount: details.finalAmount,
    processed_at: new Date().toISOString(),
  });
  await reportMetaPurchase(admin, envelope.id);
  return "processed";
}

async function processCancelRequested(
  envelope: WebhookEnvelope,
  idempotencyKey: string,
) {
  const details = objectParts(envelope.object);
  if (!details.merchantUid) {
    await eventStatus(idempotencyKey, {
      processing_status: "unmatched",
      processed_at: new Date().toISOString(),
    });
    return "unmatched";
  }

  const admin = createAdminClient();
  const { data: transactions, error: transactionLookupError } = await admin
    .from("payment_transactions")
    .select(
      "id,user_id,payment_kind,amount,application_group_id,membership_payment_intent_id",
    )
    .eq("provider", "groble")
    .eq("merchant_uid", details.merchantUid)
    .limit(2)
    .returns<PaymentTransactionRow[]>();
  if (transactionLookupError) throw transactionLookupError;

  if ((transactions ?? []).length > 1) {
    await eventStatus(idempotencyKey, {
      processing_status: "ambiguous",
      merchant_uid: details.merchantUid,
      processed_at: new Date().toISOString(),
    });
    return "ambiguous";
  }

  const transaction = transactions?.[0] ?? null;
  if (transaction) {
    const cancelRequestedAt =
      details.cancelRequestedAt ??
      envelope.occurredAt ??
      new Date().toISOString();
    const { error: transactionUpdateError } = await admin
      .from("payment_transactions")
      .update({
        status: "cancel_requested",
        cancel_requested_at: cancelRequestedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);
    if (transactionUpdateError) throw transactionUpdateError;

    if (transaction.payment_kind !== "one_time") {
      await eventStatus(idempotencyKey, {
        processing_status: "processed",
        merchant_uid: details.merchantUid,
        matched_user_id: transaction.user_id,
        matched_membership_payment_intent_id:
          transaction.membership_payment_intent_id,
        payment_kind: transaction.payment_kind,
        payment_amount: transaction.amount,
        processed_at: new Date().toISOString(),
      });
      return "processed";
    }
  }

  const { data: rows, error: lookupError } = await admin
    .from("meeting_date_applications")
    .select("application_group_id,user_id,deposit_amount,created_at")
    .eq(
      "groble_merchant_uid",
      details.merchantUid,
    )
    .limit(20)
    .returns<ApplicationRow[]>();
  if (lookupError) throw lookupError;

  const matches = new Map<string, ApplicationRow>();
  for (const row of rows ?? []) {
    matches.set(`${row.user_id}:${row.application_group_id}`, row);
  }
  if (matches.size !== 1) {
    const status = matches.size === 0 ? "unmatched" : "ambiguous";
    await eventStatus(idempotencyKey, {
      processing_status: status,
      merchant_uid: details.merchantUid,
      processed_at: new Date().toISOString(),
    });
    return status;
  }

  const match = Array.from(matches.values())[0];
  const { error: updateError } = await admin
    .from("meeting_date_applications")
    .update({
      deposit_status: "refund_pending",
      payment_cancel_requested_at:
        details.cancelRequestedAt ?? envelope.occurredAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("application_group_id", match.application_group_id)
    .eq("user_id", match.user_id);
  if (updateError) throw updateError;

  await eventStatus(idempotencyKey, {
    processing_status: "processed",
    merchant_uid: details.merchantUid,
    matched_user_id: match.user_id,
    matched_application_group_id: match.application_group_id,
    payment_kind: "one_time",
    payment_amount: details.finalAmount,
    processed_at: new Date().toISOString(),
  });
  return "processed";
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const rawBody = await request.text().catch(() => "");
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > maxBodyBytes) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const timestamp = request.headers.get("x-groble-timestamp");
  const signatures = [
    request.headers.get("x-groble-signature"),
    request.headers.get("x-groble-signature-previous"),
  ].filter((value): value is string => Boolean(value));
  const idempotencyKey = request.headers.get("x-groble-idempotency-key")?.trim();

  if (!validTimestamp(timestamp) || signatures.length === 0 || !idempotencyKey) {
    return NextResponse.json({ error: "Invalid webhook headers." }, { status: 401 });
  }

  try {
    if (!verifySignature({ rawBody, timestamp: timestamp!, signatures })) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
  } catch (error) {
    console.error("[groble-webhook] signature configuration error", error);
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  let envelope: WebhookEnvelope | null = null;
  try {
    envelope = parseEnvelope(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
  if (!envelope) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const details = objectParts(envelope.object);
  const admin = createAdminClient();
  const { error: insertError } = await admin.from("groble_webhook_events").insert({
    event_id: envelope.id,
    idempotency_key: idempotencyKey,
    event_type: envelope.type,
    schema_version: envelope.version,
    occurred_at: envelope.occurredAt,
    merchant_uid: details.merchantUid,
    buyer_phone_normalized: details.buyerPhone,
    payload: envelope.payload,
  });

  if (insertError && insertError.code !== "23505") {
    console.error("[groble-webhook] event insert failed", insertError);
    return NextResponse.json({ error: "Event could not be stored." }, { status: 500 });
  }

  if (insertError?.code === "23505") {
    const { data: existing, error: existingError } = await admin
      .from("groble_webhook_events")
      .select("processing_status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle<{ processing_status: string }>();
    if (existingError) {
      return NextResponse.json({ error: "Event could not be checked." }, { status: 500 });
    }
    if (existing?.processing_status !== "failed") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  try {
    let status: string;
    if (
      envelope.type === "payment.completed" ||
      envelope.type === "subscription_payment.completed"
    ) {
      status = await processPaymentCompleted(envelope, idempotencyKey);
    } else if (envelope.type === "payment.cancel_requested") {
      status = await processCancelRequested(envelope, idempotencyKey);
    } else {
      status = "ignored";
      await eventStatus(idempotencyKey, {
        processing_status: status,
        processed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("[groble-webhook] processing failed", error);
    await eventStatus(idempotencyKey, {
      processing_status: "failed",
      last_error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error",
    }).catch(() => undefined);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
