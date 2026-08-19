export type AlgorithmParameterMode = "similar" | "different";

export type AlgorithmParameter = {
  questionOrder: number;
  mode: AlgorithmParameterMode;
  position?: number;
  updatedAt?: string | null;
};

export const maximumAlgorithmParameters = 3;

export function parseAlgorithmParameters(
  value: unknown,
): AlgorithmParameter[] | null {
  if (!Array.isArray(value) || value.length > maximumAlgorithmParameters) {
    return null;
  }

  const parameters: AlgorithmParameter[] = [];
  const questionOrders = new Set<number>();

  for (const item of value) {
    if (!item || typeof item !== "object") return null;

    const questionOrder = (item as { questionOrder?: unknown }).questionOrder;
    const mode = (item as { mode?: unknown }).mode;
    if (
      typeof questionOrder !== "number" ||
      !Number.isSafeInteger(questionOrder) ||
      questionOrder <= 0 ||
      (mode !== "similar" && mode !== "different") ||
      questionOrders.has(questionOrder)
    ) {
      return null;
    }

    questionOrders.add(questionOrder);
    parameters.push({ questionOrder, mode });
  }

  return parameters;
}
