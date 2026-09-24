export type LandingEntry = "member" | "resume" | "landing" | "intro";

export function landingEntry({ hasAuthCookie, hasSeenIntro, phase, answerCount }: {
  hasAuthCookie: boolean;
  hasSeenIntro: boolean;
  phase: string;
  answerCount: number;
}): LandingEntry {
  if (hasAuthCookie) return "member";
  if (phase === "auth" || phase === "questions" || answerCount > 0) return "resume";
  return hasSeenIntro ? "landing" : "intro";
}
