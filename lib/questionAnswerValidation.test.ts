import { describe, expect, it } from "vitest";
import { preferenceQuestions } from "@/data/preferenceQuestions";
import type { StoredAnswerRow } from "@/types/question";
import { validQuestionAnswer } from "./questionAnswerValidation";
import { countryAnswerText, countryExperiencesLabel, parseCountryExperiences } from "./signupQuestionValues";

const row = (order: number, overrides: Partial<StoredAnswerRow> = {}): StoredAnswerRow => ({ question_order: order, answer_value: null, answer_values: null, answer_text: null, other_text: null, ...overrides });
const q = (id: number) => preferenceQuestions.find((question) => question.id === id)!;

describe("new signup answer validation", () => {
  it("renders old country picker answers as country names while preserving ordinary free text", () => {
    expect(countryAnswerText('[{"countryName":"일본","experience":"both"},{"countryName":"프랑스","experience":"travel"}]')).toBe("일본, 프랑스");
    expect(countryAnswerText('[{"countryCode":"JP","experience":"travel"}]')).toBe("일본");
    expect(countryAnswerText("[]")).toBe("아직 해외 거주·여행 경험은 없어요.");
    expect(countryAnswerText("일본, 프랑스\n태국")).toBe("일본, 프랑스\n태국");
    expect(countryAnswerText("")).toBe("");
  });
  it("accepts one numeric preference and rejects removed range and uncertainty options", () => {
    for (const id of [32, 33]) {
      for (const answer_value of ["1", "4", "7"]) expect(validQuestionAnswer(q(id), row(id, { answer_value }))).toBe(true);
      for (const answer_value of ["0", "8", "range_3_6", "range_any", "range_unsure", ""]) expect(validQuestionAnswer(q(id), row(id, { answer_value }))).toBe(false);
    }
  });
  it("distinguishes no country experience from a missing answer and rejects malformed or duplicate data", () => {
    const answer_text = JSON.stringify([{ countryCode: "JP", experience: "travel" }, { countryCode: "FR", experience: "lived" }]);
    expect(parseCountryExperiences(answer_text)).not.toBeNull();
    expect(parseCountryExperiences("[]")).toEqual([]);
    for (const value of [null, "", "일본", "{}", '[{"countryCode":"ZZ","experience":"travel"}]', '[{"countryCode":"JP","experience":"unknown"}]', '[{"countryCode":"JP","experience":"travel"},{"countryCode":"JP","experience":"lived"}]']) expect(parseCountryExperiences(value)).toBeNull();
    expect(countryExperiencesLabel(answer_text)).toContain("일본 · 여행");
    expect(countryExperiencesLabel("[]")).toBe("해외 거주·여행 경험이 없어요.");
    expect(parseCountryExperiences("[null]")).toBeNull();
  });
  it("permits an unanswered optional free-text but not unanswered required questions", () => {
    expect(validQuestionAnswer(q(18))).toBe(true);
    expect(validQuestionAnswer(q(18), row(18, { answer_text: "" }))).toBe(true);
    expect(validQuestionAnswer(q(37))).toBe(false);
  });
  it("accepts typed country names and preserves them in display labels", () => {
    const answer_text = JSON.stringify([{ countryName: "일본", experience: "both" }, { countryName: "프랑스", experience: "travel" }]);
    expect(parseCountryExperiences(answer_text)).not.toBeNull();
    expect(countryExperiencesLabel(answer_text)).toBe("일본 · 여행·거주 / 프랑스 · 여행");
    for (const countryName of ["", "   ", " 일본", "a".repeat(51), "일본\n"]) {
      expect(parseCountryExperiences(JSON.stringify([{ countryName, experience: "travel" }]))).toBeNull();
    }
    expect(parseCountryExperiences('[{"countryName":"France","experience":"travel"},{"countryName":"france","experience":"lived"}]')).toBeNull();
    expect(parseCountryExperiences('[{"countryName":"일본","countryCode":"JP","experience":"travel"}]')).toBeNull();
  });
  it("accepts multiple countries in one free-text answer without experience classifications", () => {
    for (const answer_text of ["일본, 프랑스, 태국", "일본\n미국\n베트남", "아직 해외여행 경험은 없어요"]) {
      expect(validQuestionAnswer(q(36), row(36, { answer_text }))).toBe(true);
    }
    expect(validQuestionAnswer(q(36), row(36, { answer_text: "  " }))).toBe(false);
  });
  it("enforces limits, exclusive choices, duplicates and other-text requirements", () => {
    expect(validQuestionAnswer(q(34), row(34, { answer_values: ["no_preference"] }))).toBe(true);
    for (const answer_values of [["no_preference", "group_role_listener"], ["unsure", "no_preference"], ["group_role_listener", "group_role_listener"], ["group_role_listener", "group_role_leader", "group_role_reactor"]]) expect(validQuestionAnswer(q(34), row(34, { answer_values }))).toBe(false);
    expect(validQuestionAnswer(q(37), row(37, { answer_values: ["other"] }))).toBe(false);
    expect(validQuestionAnswer(q(37), row(37, { answer_values: ["other"], other_text: "클라이밍" }))).toBe(true);
  });
  it("validates real dates rather than date-shaped strings", () => {
    expect(validQuestionAnswer(q(17), row(17, { answer_text: "2000-02-29" }))).toBe(true);
    expect(validQuestionAnswer(q(17), row(17, { answer_text: "2001-02-29" }))).toBe(false);
  });
});
