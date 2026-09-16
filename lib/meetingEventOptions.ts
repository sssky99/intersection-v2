export type MeetingEventOptions = {
  groupActivity: boolean;
  extraFee: { enabled: boolean; description: string; amount: number };
};

export function readMeetingEventOptions(value: unknown): MeetingEventOptions {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const fee = source.extraFee && typeof source.extraFee === "object"
    ? source.extraFee as Record<string, unknown> : {};
  return {
    groupActivity: source.groupActivity !== false,
    extraFee: {
      enabled: fee.enabled === true,
      description: typeof fee.description === "string" ? fee.description.trim() : "",
      amount: typeof fee.amount === "number" && Number.isSafeInteger(fee.amount) && fee.amount > 0 ? fee.amount : 0,
    },
  };
}

export function validateMeetingEventOptions(value: Record<string, unknown>): string | null {
  if (typeof value.groupActivity !== "boolean") return "단체 여부를 확인해주세요.";
  const fee = value.extraFee as Record<string, unknown> | null;
  if (!fee || typeof fee !== "object" || typeof fee.enabled !== "boolean") return "추가 예약 비용 설정을 확인해주세요.";
  if (typeof fee.description !== "string" || fee.description.trim().length > 80) return "추가 예약 비용 설명은 80자 이내로 입력해주세요.";
  if (typeof fee.amount !== "number" || !Number.isSafeInteger(fee.amount) || fee.amount < 0 || fee.amount > 100000000)
    return "추가 예약 비용은 0~100,000,000원의 정수로 입력해주세요.";
  if (fee.enabled && (!fee.description.trim() || fee.amount <= 0)) return "추가 예약 비용 설명과 0원보다 큰 금액을 입력해주세요.";
  return null;
}
