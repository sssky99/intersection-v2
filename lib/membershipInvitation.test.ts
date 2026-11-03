import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { calculateMembershipEndDate } from "@/features/membership/membershipTypes";
import { membershipInvitationHash, validMembershipInvitationToken } from "./membershipInvitationToken";

const user = "00000000-0000-0000-0000-000000000001";
const otherUser = "00000000-0000-0000-0000-000000000002";
const hash = "a".repeat(64);
const otherHash = "b".repeat(64);
let db: PGlite;

async function claim(userId = user, tokenHash = hash) {
  const result = await db.query<{ result: { outcome: string; end_date: string; extended: boolean } }>("select public.claim_membership_invitation($1, $2) as result", [userId, tokenHash]);
  return result.rows[0].result;
}
async function member(userId = user) {
  return (await db.query<{ membership_status: string; membership_start_date: string; membership_end_date: string; membership_plan: string }>("select membership_status, membership_start_date::text, membership_end_date::text, membership_plan from profiles where user_id=$1", [userId])).rows[0];
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create table public.profiles(user_id uuid primary key references auth.users(id),
      questions_completed boolean default true, profile_completed boolean default true,
      membership_status text default 'none', membership_plan text,
      membership_start_date date, membership_end_date date, membership_updated_at timestamptz);
    grant usage on schema public to anon, authenticated, service_role;
    grant select, update on public.profiles to service_role;`);
  await db.exec(readFileSync("supabase/migrations/20261103053456_membership_invitation_grants.sql", "utf8"));
}, 20000);
beforeEach(async () => {
  await db.exec("truncate membership_invitation_grants, membership_invitations, profiles, auth.users cascade;");
  await db.query("insert into auth.users(id) values ($1), ($2)", [user, otherUser]);
  await db.query("insert into profiles(user_id) values ($1), ($2)", [user, otherUser]);
  await db.query("insert into membership_invitations(token_hash, label) values ($1, '초대장'), ($2, '다른 초대장')", [hash, otherHash]);
});
afterAll(async () => { await db?.close(); });

describe("one-time invitation membership grants", () => {
  it("activates one calendar month from today's Korea date with a receipt", async () => {
    const today = (await db.query<{ day: string }>("select (now() at time zone 'Asia/Seoul')::date::text as day")).rows[0].day;
    expect(await claim()).toMatchObject({ outcome: "granted", extended: false });
    expect(await member()).toMatchObject({ membership_status: "active", membership_plan: "one_month", membership_start_date: today, membership_end_date: calculateMembershipEndDate(today, "one_month") });
    expect((await db.query("select * from membership_invitation_grants")).rows).toHaveLength(1);
  });
  it("repeated and simultaneous requests cannot extend the same account twice", async () => {
    const responses = await Promise.all(Array.from({ length: 6 }, () => claim()));
    expect(responses.filter((response) => response.outcome === "granted")).toHaveLength(1);
    expect(responses.filter((response) => response.outcome === "already_granted")).toHaveLength(5);
    const original = await member();
    expect((await claim()).outcome).toBe("already_granted");
    expect(await member()).toEqual(original);
    expect((await db.query<{ count: number }>("select redeemed_count as count from membership_invitations where token_hash=$1", [hash])).rows[0].count).toBe(1);
  });
  it("cannot exceed a shared invitation limit when two accounts claim together", async () => {
    await db.query("update membership_invitations set max_redemptions=1 where token_hash=$1", [hash]);
    const responses = await Promise.all([claim(user), claim(otherUser)]);
    expect(responses.map((response) => response.outcome).sort()).toEqual(["granted", "invitation_full"]);
    expect((await db.query("select * from membership_invitation_grants")).rows).toHaveLength(1);
  });
  it("cannot obtain a second free month using another invitation link", async () => {
    await claim();
    const original = await member();
    expect((await claim(user, otherHash)).outcome).toBe("already_granted");
    expect(await member()).toEqual(original);
  });
  it("extends active membership without shortening its remaining period or changing its plan", async () => {
    const start = "2026-01-01";
    const end = "2030-01-30";
    await db.query("update profiles set membership_status='active', membership_plan='six_months', membership_start_date=$1, membership_end_date=$2 where user_id=$3", [start, end, user]);
    expect(await claim()).toMatchObject({ outcome: "granted", extended: true });
    expect(await member()).toMatchObject({ membership_plan: "six_months", membership_start_date: start, membership_end_date: calculateMembershipEndDate("2030-01-31", "one_month") });
  });
  it("preserves future memberships and handles leap-year month ends", async () => {
    await db.query("update profiles set membership_status='active', membership_plan='three_months', membership_start_date='2032-01-01', membership_end_date='2032-01-30' where user_id=$1", [user]);
    await claim();
    expect(await member()).toMatchObject({ membership_start_date: "2032-01-01", membership_end_date: "2032-02-28", membership_plan: "three_months" });
  });
  it.each(["expired", "cancelled", "none", "pending"])("starts a new month for %s membership", async (status) => {
    await db.query("update profiles set membership_status=$1, membership_end_date='2020-01-01' where user_id=$2", [status, user]);
    expect(await claim()).toMatchObject({ outcome: "granted", extended: false });
    expect((await member()).membership_status).toBe("active");
  });
  it("keeps unfinished registration eligible for a later retry", async () => {
    await db.query("update profiles set profile_completed=false where user_id=$1", [user]);
    expect((await claim()).outcome).toBe("profile_incomplete");
    expect((await member()).membership_status).toBe("none");
    await db.query("update profiles set profile_completed=true where user_id=$1", [user]);
    expect((await claim()).outcome).toBe("granted");
  });
  it("rejects unknown, expired, disabled and exhausted invitations without grants", async () => {
    expect((await claim(user, "c".repeat(64))).outcome).toBe("invalid_invitation");
    await db.query("update membership_invitations set expires_at=now()-interval '1 second' where token_hash=$1", [hash]);
    expect((await claim()).outcome).toBe("invalid_invitation");
    await db.query("update membership_invitations set expires_at=null, enabled=false where token_hash=$1", [hash]);
    expect((await claim()).outcome).toBe("invalid_invitation");
    await db.query("update membership_invitations set enabled=true, max_redemptions=1 where token_hash=$1", [hash]);
    expect((await claim()).outcome).toBe("granted");
    expect((await claim(otherUser)).outcome).toBe("invitation_full");
    expect((await member(otherUser)).membership_status).toBe("none");
  });
  it("rolls back the membership and link usage count if receipt creation fails", async () => {
    await db.exec("alter table membership_invitation_grants add constraint fail_receipt check (false) not valid");
    try { await expect(claim()).rejects.toThrow(); }
    finally { await db.exec("alter table membership_invitation_grants drop constraint fail_receipt"); }
    expect((await member()).membership_status).toBe("none");
    expect((await db.query<{ count: number }>("select redeemed_count as count from membership_invitations where token_hash=$1", [hash])).rows[0].count).toBe(0);
    expect((await claim()).outcome).toBe("granted");
  });
  it("prevents anonymous and authenticated clients from directly issuing grants", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      try {
        await expect(claim()).rejects.toThrow(/permission denied/);
        await expect(db.query("select * from membership_invitations")).rejects.toThrow(/permission denied/);
      } finally { await db.exec("reset role"); }
    }
  });
  it("uses high-entropy bearer tokens and stores only their hash", () => {
    const token = "A".repeat(43);
    expect(validMembershipInvitationToken(token)).toBe(true);
    expect(validMembershipInvitationToken("guessable-code")).toBe(false);
    expect(validMembershipInvitationToken(token + "/")).toBe(false);
    expect(membershipInvitationHash(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(membershipInvitationHash(token)).not.toContain(token);
  });
});
