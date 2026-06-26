export const operatorTestAccounts = [
  {
    userId: "90132eb5-f557-40e5-a5a1-f536e301d52c",
    name: "수호",
    email: "seongmin.local-test@intersection.local",
  },
  {
    userId: "11330923-3127-45f3-9a5e-069d99c64b42",
    name: "재현",
    email: "jaehyun.local-test@intersection.local",
  },
  {
    userId: "3df57c3a-96b3-4349-8d76-de7fa4d87257",
    name: "정우",
    email: "jeongwoo.local-test@intersection.local",
  },
] as const;

export type OperatorTestAccount = (typeof operatorTestAccounts)[number];

export function operatorTestAccountByUserId(userId: string) {
  return operatorTestAccounts.find((account) => account.userId === userId) ?? null;
}
