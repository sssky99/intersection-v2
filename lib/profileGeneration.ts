import { generateProfileText } from "@/lib/openai";
import {
  buildProfileInput,
  isValidGeneratedIntro,
  parseGeneratedProfileContent,
  profileInstructions,
  type PromptAnswerRow,
} from "@/lib/profilePrompt";
import type { ProfileRow } from "@/types/profile";

export type PublicProfileFallbackReason =
  | "missing_api_key"
  | "invalid_response"
  | "openai_error";

type GeneratedPublicProfile = {
  kind: "generated";
  intro: string;
  emoji: string | null;
  attempts: number;
};

type FallbackPublicProfile = {
  kind: "fallback";
  reason: PublicProfileFallbackReason;
  attempts: number;
};

export type PublicProfileGenerationResult =
  | GeneratedPublicProfile
  | FallbackPublicProfile;

const MAX_GENERATION_ATTEMPTS = 2;

export function fallbackPublicProfileModel(
  reason: PublicProfileFallbackReason,
) {
  return `fallback:${reason}`;
}

export function isFallbackPublicProfileModel(model: string | null | undefined) {
  return model === "fallback" || model?.startsWith("fallback:") === true;
}

export async function generatePublicProfile(
  profile: ProfileRow,
  answers: PromptAnswerRow[],
): Promise<PublicProfileGenerationResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { kind: "fallback", reason: "missing_api_key", attempts: 0 };
  }

  let reason: PublicProfileFallbackReason = "openai_error";

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const raw = await generateProfileText({
        instructions: profileInstructions,
        input: buildProfileInput(profile, answers),
      });
      const generated = parseGeneratedProfileContent(raw);

      if (generated && isValidGeneratedIntro(generated.publicIntro, profile)) {
        return {
          kind: "generated",
          intro: generated.publicIntro.trim(),
          emoji: generated.publicEmoji,
          attempts: attempt,
        };
      }

      reason = "invalid_response";
      console.warn("[public-profile] invalid model response", {
        attempt,
        outputLength: raw?.length ?? 0,
      });
    } catch (error) {
      reason = "openai_error";
      console.warn("[public-profile] generation attempt failed", {
        attempt,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { kind: "fallback", reason, attempts: MAX_GENERATION_ATTEMPTS };
}
