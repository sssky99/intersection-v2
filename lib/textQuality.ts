export function isCorruptText(value: string | null | undefined) {
  if (!value) return false;

  const compact = value.replace(/\s/g, "");
  if (!compact) return false;
  if (value.includes("�")) return true;

  const questionMarks = (value.match(/\?/g) ?? []).length;
  const hangulChars = (value.match(/[가-힣]/g) ?? []).length;
  const hasRepeatedQuestionMarks = /\?{2,}/.test(value);
  const questionMarkRatio = questionMarks / compact.length;

  return (
    questionMarks >= 6 &&
    hasRepeatedQuestionMarks &&
    (hangulChars < 5 || questionMarkRatio > 0.12)
  );
}

export function hasUsablePublicIntro(value: string | null | undefined) {
  return Boolean(value?.trim()) && !isCorruptText(value);
}
