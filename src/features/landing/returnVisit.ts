export type LandingEntry = "member" | "resume" | "landing" | "intro";

export function landingEntry({ hasAuthCookie, phase, answerCount }: {
  hasAuthCookie: boolean;
  hasSeenIntro: boolean;
  phase: string;
  answerCount: number;
}): LandingEntry {
  if (hasAuthCookie) return "member";
  if (phase === "auth" || phase === "questions" || answerCount > 0) return "resume";
  // Public visitors enter the landing directly, regardless of intro-video history.
  return "landing";
}
