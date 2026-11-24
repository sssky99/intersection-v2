import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayKoreaDateString } from "@/features/membership/membershipTypes";
import {
  grobleMembershipProduct,
  grobleSubscriptionEvents,
  projectGrobleSubscriptions,
  reconcileGrobleMemberships,
  type GrobleLedgerEntry,
  type GrobleMemberAccess,
  type GrobleMembershipEffect,
  type GrobleSnapshotRow,
  type GrobleSubscriptionEvent,
} from "@/server/payments/grobleSubscriptionOverview";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const eventFields = "event_id,event_type,merchant_uid,buyer_phone_normalized,occurred_at,payload";
const pageSize = 250;
const maxPages = 8;

export async function GET(request: NextRequest) {
  if (!isAdminSessionTokenValid(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401, headers });
  }
  try {
    const db = createAdminClient();
    const { data: snapshot, error } = await db.from("groble_subscription_snapshots")
      .select("captured_at,total_count,subscriptions")
      .eq("product_code", grobleMembershipProduct)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ captured_at: string; total_count: number; subscriptions: GrobleSnapshotRow[] }>();
    if (error) throw error;
    if (!snapshot) return NextResponse.json({ snapshot: null }, { headers });

    const checkedAt = new Date().toISOString();
    const later: GrobleSubscriptionEvent[] = [];
    let incomplete = false;
    for (let page = 0; page <= maxPages; page++) {
      const { data, error: eventError } = await db.from("groble_webhook_events")
        .select(eventFields)
        .in("event_type", grobleSubscriptionEvents)
        .eq("payload->data->object->content->>id", grobleMembershipProduct)
        .gt("occurred_at", snapshot.captured_at)
        .lte("received_at", checkedAt)
        .order("received_at").order("id")
        .range(page * pageSize, page * pageSize + pageSize - 1)
        .returns<GrobleSubscriptionEvent[]>();
      if (eventError) throw eventError;
      if (!data?.length) break;
      if (page === maxPages) {
        incomplete = true;
        break;
      }
      later.push(...data);
      if (data.length < pageSize) break;
    }

    const snapshotOrders = snapshot.subscriptions.map(({ order }) => order);
    const readOrders = async <T,>(orders: string[], load: (batch: string[]) => PromiseLike<{
      data: T[] | null;
      error: unknown;
    }>) => {
      const rows: T[] = [];
      for (let offset = 0; offset < orders.length; offset += 100) {
        const { data, error: readError } = await load(orders.slice(offset, offset + 100));
        if (readError) throw readError;
        rows.push(...(data ?? []));
      }
      return rows;
    };
    const originals = await readOrders(snapshotOrders, (orders) => db.from("groble_webhook_events")
      .select(eventFields).eq("event_type", "subscription_payment.completed")
      .eq("payload->data->object->content->>id", grobleMembershipProduct)
      .in("merchant_uid", orders).returns<GrobleSubscriptionEvent[]>());
    const overview = projectGrobleSubscriptions(snapshot.subscriptions, originals, later);
    const currentOrders = overview.rows.map(({ order }) => order);
    const [ledger, effects] = await Promise.all([
      readOrders(currentOrders, (orders) => db.from("payment_transactions")
        .select("id,merchant_uid,user_id,status")
        .eq("provider", "groble").in("merchant_uid", orders)
        .returns<GrobleLedgerEntry[]>()),
      readOrders(currentOrders, (orders) => db.from("membership_payment_effects")
        .select("transaction_id,merchant_uid,user_id,cancelled_at").in("merchant_uid", orders)
        .returns<GrobleMembershipEffect[]>()),
    ]);
    const userIds = [...new Set(ledger.flatMap(({ user_id }) => user_id ? [user_id] : []))];
    const profiles = await readOrders(userIds, (ids) => db.from("profiles")
      .select("user_id,name,membership_status,membership_start_date,membership_end_date,archived_at")
      .in("user_id", ids).returns<GrobleMemberAccess[]>());
    const membership = reconcileGrobleMemberships(
      overview.rows, ledger, effects, profiles, todayKoreaDateString(new Date(checkedAt)),
    );

    return NextResponse.json({
      snapshot: snapshot.captured_at,
      checkedAt,
      incomplete,
      ...overview,
      ...membership,
    }, { headers });
  } catch (error) {
    console.error("[admin groble subscriptions] read", error);
    return NextResponse.json({ error: "그로블 구독 현황을 불러오지 못했습니다." }, { status: 500, headers });
  }
}
