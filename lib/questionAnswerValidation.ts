import type { ProfileQuestion, StoredAnswerRow } from "@/types/question";

export function validQuestionAnswer(question: ProfileQuestion, row?: StoredAnswerRow): boolean {
  if (!row) return Boolean(question.optional);
  if (question.optional && !row.answer_text?.trim()) return true;
  const options = (question.options ?? []).map((option) => typeof option === "string" ? { value: option } : option);
  const allowed = new Set(options.map((option) => option.value));
  if (question.type === "text") {
    if (question.id === 17) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(row.answer_text ?? "");
      if (!match) return false;
      const [year, month, day] = match.slice(1).map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return year >= 1980 && year <= new Date().getFullYear() - 19 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    }
    return Boolean(row.answer_text?.trim());
  }
  const values = question.type === "multi_choice" ? row.answer_values ?? [] : [row.answer_value ?? ""];
  if (!values.length || !values.every((value) => allowed.has(value)) || new Set(values).size !== values.length) return false;
  if (question.type === "multi_choice" && (values.length < (question.minSelections ?? 1) || (question.maxSelections && values.length > question.maxSelections))) return false;
  if (values.length > 1 && options.some((option) => "exclusive" in option && option.exclusive && values.includes(option.value))) return false;
  return !options.some((option) => "hasTextInput" in option && option.hasTextInput && values.includes(option.value)) || Boolean(row.other_text?.trim());
}
