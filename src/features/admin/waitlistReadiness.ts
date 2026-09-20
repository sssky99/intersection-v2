import type { AdminWaitlistRow } from "./waitlistAdminTypes";

// Membership applications need no deposit; their application status records
// payment eligibility. Explicit unpaid/refunded deposits must not count.
export function isPaidApplicant(row: AdminWaitlistRow) {
  return ["waitlisted", "on_hold", "approved"].includes(row.status) &&
    (row.deposit_status === null || row.deposit_status === "confirmed");
}

export function isPaidUnassigned(row: AdminWaitlistRow) {
  return isPaidApplicant(row) && row.status !== "approved" && !row.ticket_instance_id;
}

export function summarizeReadiness(rows: AdminWaitlistRow[]) {
  const eligible = rows.filter(isPaidApplicant);
  const women = new Set(eligible.filter((row) => row.profile?.gender === "여성").map((row) => row.user_id)).size;
  const men = new Set(eligible.filter((row) => row.profile?.gender === "남성").map((row) => row.user_id)).size;
  const unknown = new Set(eligible.filter((row) => !["여성", "남성"].includes(row.profile?.gender ?? "")).map((row) => row.user_id)).size;
  const minimum = Math.min(women, men);
  return {
    women, men, unknown,
    unassigned: new Set(rows.filter(isPaidUnassigned).map((row) => row.user_id)).size,
    grade: minimum >= 7 ? "상" : minimum >= 5 ? "중" : "하",
    womenNeeded: Math.max(0, 6 - women),
    menNeeded: Math.max(0, 6 - men),
  };
}
