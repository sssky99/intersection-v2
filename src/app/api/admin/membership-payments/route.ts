import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  isAdminSessionTokenValid,
} from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleVerifiedGrobleWebhook } from "@/server/payments/grobleDelivery";
import { parseEnvelope } from "@/server/payments/grobleVerification";
export const dynamic = "force-dynamic";
const authorized = (request: NextRequest) =>
  isAdminSessionTokenValid(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
const unauthorized = () =>
  NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
export async function GET(request: NextRequest) {
  if (!authorized(request)) return unauthorized();
  try {
    const client = createAdminClient();
    const [events, effects] = await Promise.all([
      client
        .from("groble_webhook_events")
        .select(
          "event_id,merchant_uid,processing_status,last_error,received_at",
        )
        .in("event_type", [
          "subscription_payment.completed",
          "subscription_payment.cancelled",
          "subscription_payment.refunded",
        ])
        .in("processing_status", [
          "received",
          "failed",
          "unmatched",
          "ambiguous",
        ])
        .order("received_at", { ascending: false })
        .limit(30),
      client
        .from("membership_payment_effects")
        .select(
          "transaction_id,merchant_uid,after_state,applied_at,cancelled_at,cancellation_revoked_access,profile:profiles(name)",
        )
        .order("applied_at", { ascending: false })
        .limit(30),
    ]);
    if (events.error) throw events.error;
    if (effects.error) throw effects.error;
    return NextResponse.json(
      { events: events.data ?? [], effects: effects.data ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[membership payments] read", error);
    return NextResponse.json(
      { error: "결제 처리 기록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
export async function POST(request: NextRequest) {
  if (!authorized(request)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (typeof body?.eventId !== "string" || body.eventId.length > 200)
    return NextResponse.json(
      { error: "알림을 선택해주세요." },
      { status: 400 },
    );
  try {
    const client = createAdminClient();
    const { data: event, error } = await client
      .from("groble_webhook_events")
      .select("event_id,event_type,idempotency_key,processing_status,payload")
      .eq("event_id", body.eventId)
      .maybeSingle();
    if (error) throw error;
    if (!event)
      return NextResponse.json(
        { error: "알림을 찾을 수 없습니다." },
        { status: 404 },
      );
    if (
      ![
        "subscription_payment.completed",
        "subscription_payment.cancelled",
        "subscription_payment.refunded",
      ].includes(event.event_type) ||
      !["failed", "received"].includes(event.processing_status)
    )
      return NextResponse.json(
        {
          error:
            "처리 실패 또는 처리 대기 중인 멤버십 알림만 재처리할 수 있습니다.",
        },
        { status: 409 },
      );
    const envelope = parseEnvelope(JSON.stringify(event.payload));
    if (
      !envelope ||
      envelope.id !== event.event_id ||
      envelope.type !== event.event_type
    )
      throw new Error("Stored event identity mismatch");
    const { data: attempt, error: attemptError } = await client
      .from("membership_payment_retry_attempts")
      .insert({ event_id: event.event_id })
      .select("id")
      .single();
    if (attemptError) throw attemptError;
    const result = await handleVerifiedGrobleWebhook(
      envelope,
      event.idempotency_key,
    );
    const { error: auditError } = await client
      .from("membership_payment_retry_attempts")
      .update({ response_status: result.status })
      .eq("id", attempt.id);
    if (auditError) throw auditError;
    return result;
  } catch (error) {
    console.error("[membership payments] retry", error);
    return NextResponse.json(
      { error: "재처리하지 못했습니다. 처리 오류를 확인해주세요." },
      { status: 500 },
    );
  }
}
