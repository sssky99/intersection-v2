import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const migration = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, "utf8");
const original = migration("20260813193000_prepare_membership_checkout");
const fixed = migration("20260908110544_preserve_paid_membership_on_application_checkout");
const intentMigration = migration("20260729120000_unified_payments_and_membership_intents");
const activate = intentMigration.slice(
  intentMigration.indexOf("create or replace function public.activate_membership_payment_intent("),
  intentMigration.indexOf("create or replace function public.match_membership_payment_intent("),
);
const userId = "00000000-0000-4000-8000-000000000001";
let db: PGlite;
const profile = async () => (await db.query("select * from profiles")).rows[0];
const checkout = (plan = "one_month", applicationId = 1) => db.query(
  "select * from prepare_membership_checkout($1, $2, $3, 20000, 0, 'test-reference')",
  [userId, applicationId, plan],
);

describe("application checkout database function", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table profiles (
        user_id uuid primary key, membership_status text, membership_plan text,
        membership_start_date date, membership_end_date date,
        membership_purchase_clicked_at timestamptz, membership_updated_at timestamptz
      );
      create table meeting_date_applications (id bigint primary key, user_id uuid);
      create table membership_payment_intents (
        id bigint generated always as identity primary key, user_id uuid, plan text,
        expected_amount integer, credit_amount integer, status text,
        opened_at timestamptz, expires_at timestamptz, ended_at timestamptz,
        created_at timestamptz, updated_at timestamptz,
        meeting_date_application_id bigint, seller_reference text,
        experiment_id text, landing_variant text, acquisition_context jsonb
      );
      insert into meeting_date_applications values (1, '${userId}');
    `);
    await db.exec(activate);
  }, 20000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await db.exec(fixed);
    await db.exec(`
      truncate profiles, membership_payment_intents;
      insert into profiles values ('${userId}', 'active', 'one_month',
        '2099-09-09', '2099-10-08', null, '2026-09-08T06:17:01Z');
    `);
  });

  it("reproduces the old regression, then preserves the same paid profile with the fix", async () => {
    await db.exec(original);
    await checkout();
    expect(await profile()).toMatchObject({ membership_status: "pending" });
    await db.exec("update profiles set membership_status = 'active'");
    const paid = await profile();
    await db.exec(fixed);
    await checkout();
    expect(await profile()).toEqual(paid);
  });

  it.each(["one_month", "three_months", "six_months"])("preserves paid dates and plan on %s checkout", async (plan) => {
    const paid = await profile();
    expect((await checkout(plan)).rows).toHaveLength(1);
    expect(await profile()).toEqual(paid);
    expect((await db.query("select plan, meeting_date_application_id, seller_reference from membership_payment_intents")).rows[0])
      .toMatchObject({ plan, meeting_date_application_id: 1, seller_reference: "test-reference" });
  });

  it.each([null, "none", "pending", "expired", "cancelled"])("still prepares unpaid %s profiles", async (status) => {
    await db.query("update profiles set membership_status = $1", [status]);
    await checkout();
    expect(await profile()).toMatchObject({ membership_status: "pending" });
  });

  it("rejects another user's application without creating an intent", async () => {
    const paid = await profile();
    await expect(checkout("one_month", 999)).rejects.toThrow("Meeting date application was not found");
    expect(await profile()).toEqual(paid);
    expect((await db.query("select * from membership_payment_intents")).rows).toHaveLength(0);
  });

  it("does not expose checkout to anonymous or authenticated callers", async () => {
    const result = await db.query(`select
      has_function_privilege('anon', 'prepare_membership_checkout(uuid,bigint,text,integer,integer,text,text,text,jsonb)', 'execute') as anon,
      has_function_privilege('authenticated', 'prepare_membership_checkout(uuid,bigint,text,integer,integer,text,text,text,jsonb)', 'execute') as authenticated,
      has_function_privilege('service_role', 'prepare_membership_checkout(uuid,bigint,text,integer,integer,text,text,text,jsonb)', 'execute') as service`);
    expect(result.rows[0]).toEqual({ anon: false, authenticated: false, service: true });
  });
});
