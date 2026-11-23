import { profileArchetypeIds, type ProfileArchetypeId } from "./profileArchetypes";
import type { StoredAnswerRow } from "@/types/question";

// Provisional scoring for the redesigned signup questionnaire.
export function classifyLocalSignup(rows: StoredAnswerRow[]): ProfileArchetypeId {
  const answers = new Map(rows.map(row => [row.question_order, Number(row.answer_value)]));
  function scaled(number: number, maximum: number) {
    const value = answers.get(2000 + number);
    return value && value >= 1 && value <= maximum ? (value - 1) / (maximum - 1) : 0.5;
  }
  const social = (1 - scaled(2, 5) + scaled(5, 5) + scaled(17, 7) + scaled(18, 7)) / 4;
  const trust = scaled(3, 5);
  const imagination = scaled(7, 5);
  const risk = scaled(8, 7);
  const dialogue = scaled(9, 7);
  const purpose = scaled(13, 7);
  const change = scaled(14, 4);
  const comfort = scaled(15, 4);
  const independence = scaled(16, 4);
  const scores: Record<ProfileArchetypeId, number> = {
    romantic: (2 * trust + social + purpose) / 4,
    sentimental: (2 * imagination + trust + 1 - social) / 4,
    bohemian: (3 * independence + 1 - scaled(11, 7)) / 4,
    adventurer: (3 * risk + change) / 4,
    experientialist: (2 * change + risk + social) / 4,
    stoic: (2 * comfort + scaled(4, 5) + scaled(11, 7)) / 4,
    searcher: (2 * dialogue + imagination + 1 - social) / 4,
    idealist: (2 * purpose + trust + dialogue) / 4,
    artisan: (2 * imagination + independence + 1 - risk) / 4,
    visionary: (2 * change + imagination + purpose) / 4,
  };
  return profileArchetypeIds.reduce((best, id) => scores[id] > scores[best] ? id : best);
}
