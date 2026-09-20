import { describe, expect, it } from "vitest";
import type { AdminWaitlistRow } from "./waitlistAdminTypes";
import { isPaidUnassigned, summarizeReadiness } from "./waitlistReadiness";

function applicant(id: string, gender: string, overrides: Partial<AdminWaitlistRow> = {}) {
  return { user_id: id, status: "waitlisted", deposit_status: null, ticket_instance_id: null,
    profile: { gender }, ...overrides } as AdminWaitlistRow;
}
function members(women: number, men: number) {
  return [...Array.from({ length: women }, (_, i) => applicant(`w${i}`, "여성")),
    ...Array.from({ length: men }, (_, i) => applicant(`m${i}`, "남성"))];
}

describe("waitlist recruitment readiness", () => {
  it.each([[7, 7, "상"], [5, 12, "중"], [6, 6, "중"], [12, 4, "하"], [0, 0, "하"]])(
    "uses the scarcer gender: women %i men %i => %s", (women, men, grade) => {
      expect(summarizeReadiness(members(Number(women), Number(men))).grade).toBe(grade);
    });
  it("distinguishes five from six for the minimum attendance requirement", () => {
    expect(summarizeReadiness(members(5, 10)).womenNeeded).toBe(1);
    expect(summarizeReadiness(members(6, 6)).womenNeeded).toBe(0);
  });
  it("excludes unpaid, cancelled, refunded and unselected applications", () => {
    const rows = [applicant("1", "여성", { status: "payment_pending" }),
      applicant("2", "여성", { status: "cancelled" }),
      applicant("3", "여성", { deposit_status: "refunded" }),
      applicant("4", "여성", { deposit_status: "refund_pending" }),
      applicant("5", "여성", { status: "not_selected" }),
      applicant("6", "여성", { deposit_status: "payment_pending" })];
    expect(summarizeReadiness(rows)).toMatchObject({ women: 0, unassigned: 0 });
  });
  it("retains approved members in readiness but excludes them from work remaining", () => {
    const rows = members(6, 6);
    rows[0] = { ...rows[0], status: "approved", ticket_instance_id: "group-a" };
    expect(summarizeReadiness(rows)).toMatchObject({ women: 6, men: 6, unassigned: 11 });
    expect(isPaidUnassigned(applicant("held", "여성", { status: "on_hold", ticket_instance_id: "group-a" }))).toBe(false);
  });
  it("counts a person once and does not assume an unknown gender", () => {
    const row = applicant("same", "여성");
    expect(summarizeReadiness([row, row, applicant("unknown", "")])).toMatchObject({ women: 1, men: 0, unknown: 1, unassigned: 2 });
  });
});
