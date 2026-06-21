import OpenAI from "openai";

export const publicProfileModel = "gpt-5.5";

const publicProfileTextFormat = {
  type: "json_schema",
  name: "public_profile",
  description:
    "A short public profile introduction and optional emoji for a member.",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      publicEmoji: {
        type: ["string", "null"],
        description:
          "A single emoji that represents the profile, or null when no suitable emoji is available.",
      },
      publicIntro: {
        type: "string",
        description:
          "The complete Korean public introduction text. Preserve paragraph breaks inside this string.",
      },
    },
    required: ["publicEmoji", "publicIntro"],
  },
} as const;

export async function generateProfileText({
  instructions,
  input,
}: {
  instructions: string;
  input: unknown;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: publicProfileModel,
    reasoning: { effort: "low" },
    instructions,
    input: JSON.stringify(input, null, 2),
    text: {
      format: publicProfileTextFormat,
    },
    max_output_tokens: 900,
  });

  const text = response.output_text.trim();
  if (!text) {
    throw new Error("OpenAI returned an empty public profile.");
  }

  return text;
}
