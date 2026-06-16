import OpenAI from "openai";

export const publicProfileModel = "gpt-5.4-mini";

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
    max_output_tokens: 900,
  });

  const text = response.output_text.trim();
  if (!text) {
    throw new Error("OpenAI returned an empty public profile.");
  }

  return text;
}
