import type { MembershipPlan } from "@/features/membership/membershipTypes";

export const membershipPlanAmounts: Record<MembershipPlan, number> = {
  one_month: 20_000,
  three_months: 50_000,
  six_months: 90_000,
};

export const oneTimeMembershipCreditAmount = 10_000;

