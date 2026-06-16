export type MembershipStatus =
  | "none"
  | "active"
  | "expired"
  | "pending"
  | "cancelled";
export type MembershipPlan = "one_month" | "three_months" | "six_months";

export const membershipStatuses: MembershipStatus[] = [
  "none",
  "active",
  "expired",
  "pending",
  "cancelled",
];

export const membershipPlans: MembershipPlan[] = [
  "one_month",
  "three_months",
  "six_months",
];

export const membershipStatusLabels: Record<MembershipStatus, string> = {
  none: "없음(미선택)",
  active: "멤버십 적용중",
  expired: "멤버십 만료",
  pending: "결제 확인 전",
  cancelled: "취소",
};

export const membershipPlanLabels: Record<MembershipPlan, string> = {
  one_month: "1개월 멤버십",
  three_months: "3개월 멤버십",
  six_months: "6개월 멤버십",
};

export const membershipPlanMonths: Record<MembershipPlan, number> = {
  one_month: 1,
  three_months: 3,
  six_months: 6,
};

export function isMembershipStatus(value: unknown): value is MembershipStatus {
  return (
    typeof value === "string" &&
    membershipStatuses.includes(value as MembershipStatus)
  );
}

export function isMembershipPlan(value: unknown): value is MembershipPlan {
  return typeof value === "string" && membershipPlans.includes(value as MembershipPlan);
}

export function todayKoreaDateString(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function displayMembershipStatus({
  status,
  endDate,
}: {
  status: string | null | undefined;
  endDate: string | null | undefined;
}): MembershipStatus | null {
  if (!isMembershipStatus(status)) return null;

  // TODO: 추후 배치 작업에서 종료일이 지난 active를 DB상 expired로 자동 반영.
  if (status === "active" && endDate && endDate < todayKoreaDateString()) {
    return "expired";
  }

  return status;
}

function parseDateOnly(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);

  if (!year || !month || !day) return null;

  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysInUtcMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function calculateMembershipEndDate(
  startDate: string,
  plan: MembershipPlan,
) {
  const parsed = parseDateOnly(startDate);
  if (!parsed) return "";

  const months = membershipPlanMonths[plan];
  const targetMonthIndex = parsed.getUTCMonth() + months;
  const targetYear =
    parsed.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const targetDay = Math.min(
    parsed.getUTCDate(),
    daysInUtcMonth(targetYear, normalizedMonthIndex),
  );
  const endDate = new Date(
    Date.UTC(targetYear, normalizedMonthIndex, targetDay),
  );
  endDate.setUTCDate(endDate.getUTCDate() - 1);

  return formatDateOnly(endDate);
}
