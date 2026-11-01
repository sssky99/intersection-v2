import { describe, expect, it } from "vitest";
import { legacyPreferenceQuestions, preferenceProfileVersion, preferenceQuestionCatalog, preferenceQuestions, preferenceQuestionsForVersion } from "./preferenceQuestions";

describe("signup matching questionnaire", () => {
  it("keeps the agreed sequence, stable historical IDs, and identity questions last", () => {
    expect(preferenceQuestions.map((q) => q.id)).toEqual([6, 7, 8, 19, 25, 26, 27, 11, 12, 37, 14, 28, 36, 32, 33, 34, 35, 18, 17, 31]);
    expect(preferenceQuestions.find((q) => q.id === 37)?.description).toBe("요즘 특별히 즐기는 취미가 없다면, 관심이 가는 취미를 골라주세요.");
    expect(preferenceQuestions.find((q) => q.id === 18)?.optional).toBe(true);
    expect(preferenceQuestions.find((q) => q.id === 36)?.placeholder).toBe(preferenceQuestionCatalog.find((q) => q.id === 30)?.placeholder);
    expect(new Set(preferenceQuestionCatalog.map((q) => q.order ?? q.id)).size).toBe(preferenceQuestionCatalog.length);
    expect(preferenceQuestions.some((q) => [15, 21, 22, 23, 29, 30].includes(q.id))).toBe(false);
  });

  it("does not force existing members or saved old drafts onto new questions", () => {
    expect(preferenceQuestionsForVersion("preferences-v14")).toBe(legacyPreferenceQuestions);
    expect(legacyPreferenceQuestions.map((q) => q.id)).toEqual([6, 7, 8, 11, 12, 13, 15, 17, 18, 19, 21, 22, 23, 25, 26, 27, 28, 29, 30, 31]);
    expect(preferenceQuestionsForVersion(preferenceProfileVersion)).toBe(preferenceQuestions);
    expect(preferenceQuestionCatalog.find((q) => q.id === 13)?.description ?? "").not.toContain("관심이 가는 취미");
  });
});
