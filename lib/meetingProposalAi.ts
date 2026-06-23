import OpenAI from "openai";
import type {
  MeetingProposalDraft,
  MeetingProposalInput,
} from "@/types/meetingProposal";
import { normalizeProposalHashtags } from "@/lib/meetingProposalTags";

export const meetingProposalDraftModel = "gpt-5.5";

const proposalDraftTextFormat = {
  type: "json_schema",
  name: "meeting_proposal_draft",
  description: "A Korean invitation draft for a member-proposed gathering.",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: {
        type: "string",
        description: "A concise Korean title. Usually preserve the user's title.",
      },
      shortDescription: {
        type: "string",
        description: "One short Korean sentence introducing the gathering.",
      },
      hashtags: {
        type: "array",
        minItems: 2,
        maxItems: 3,
        items: {
          type: "string",
          description:
            "One short hashtag keyword without #, spaces, punctuation, or explanation text.",
        },
      },
      activities: {
        type: "array",
        minItems: 3,
        maxItems: 4,
        items: { type: "string" },
      },
      vibe: {
        type: "object",
        additionalProperties: false,
        properties: {
          temperature: { type: "integer", minimum: 1, maximum: 5 },
          texture: { type: "integer", minimum: 1, maximum: 5 },
          tone: { type: "integer", minimum: 1, maximum: 5 },
          rhythm: { type: "integer", minimum: 1, maximum: 5 },
          alcohol: { type: "integer", minimum: 1, maximum: 5 },
          romance: { type: "integer", minimum: 1, maximum: 5 },
        },
        required: [
          "temperature",
          "texture",
          "tone",
          "rhythm",
          "alcohol",
          "romance",
        ],
      },
      flow: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: { type: "string" },
      },
    },
    required: [
      "title",
      "shortDescription",
      "hashtags",
      "activities",
      "vibe",
      "flow",
    ],
  },
} as const;

const fallbackVibe = {
  temperature: 3,
  texture: 3,
  tone: 3,
  rhythm: 3,
  alcohol: 2,
  romance: 2,
} as const;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringList(value: unknown, fallback: string[]) {
  const items = Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  return items.length > 0 ? items.slice(0, 5) : fallback;
}

function clampLegacyScore(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(5, Math.max(1, Math.round(value)));
}

function hasRequiredText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasRequiredList(value: unknown, minLength: number) {
  return (
    Array.isArray(value) &&
    value.filter((item) => typeof item === "string" && item.trim()).length >=
      minLength
  );
}

function hasRequiredVibe(value: unknown) {
  if (typeof value !== "object" || !value) return false;
  const vibe = value as Record<string, unknown>;
  return [
    "temperature",
    "texture",
    "tone",
    "rhythm",
    "alcohol",
    "romance",
  ].every((axis) => {
    const score = vibe[axis];
    return (
      typeof score === "number" &&
      Number.isFinite(score) &&
      score >= 1 &&
      score <= 5
    );
  });
}

function assertDraftHasRequiredFields(value: unknown) {
  if (typeof value !== "object" || !value) {
    throw new Error("Meeting proposal draft is not an object.");
  }

  const draft = value as Record<string, unknown>;
  if (!hasRequiredText(draft.title)) {
    throw new Error("Meeting proposal draft is missing title.");
  }
  if (!hasRequiredText(draft.shortDescription)) {
    throw new Error("Meeting proposal draft is missing shortDescription.");
  }
  if (!hasRequiredList(draft.hashtags, 2)) {
    throw new Error("Meeting proposal draft is missing hashtags.");
  }
  if (!hasRequiredList(draft.activities, 3)) {
    throw new Error("Meeting proposal draft is missing activities.");
  }
  if (!hasRequiredVibe(draft.vibe)) {
    throw new Error("Meeting proposal draft is missing vibe.");
  }
  if (!hasRequiredList(draft.flow, 3)) {
    throw new Error("Meeting proposal draft is missing flow.");
  }
}

function normalizeDraft(value: unknown, input: MeetingProposalInput): MeetingProposalDraft {
  const draft = typeof value === "object" && value ? value as Record<string, unknown> : {};
  const vibe = typeof draft.vibe === "object" && draft.vibe
    ? draft.vibe as Record<string, unknown>
    : {};
  const fallback = buildFallbackProposalDraft(input);

  return {
    title: cleanText(draft.title) || input.title,
    shortDescription:
      cleanText(draft.shortDescription) || fallback.shortDescription,
    hashtags: normalizeProposalHashtags(draft.hashtags, {
      blockedTags: [input.region, input.specificPlace],
      fallback: fallback.hashtags,
    }),
    activities: cleanStringList(draft.activities, fallback.activities).slice(0, 4),
    vibe: {
      temperature: clampLegacyScore(
        vibe.temperature,
        fallback.vibe.temperature ?? 3,
      ),
      texture: clampLegacyScore(vibe.texture, fallback.vibe.texture ?? 3),
      tone: clampLegacyScore(vibe.tone, fallback.vibe.tone ?? 3),
      rhythm: clampLegacyScore(vibe.rhythm, fallback.vibe.rhythm ?? 3),
      alcohol: clampLegacyScore(vibe.alcohol, fallback.vibe.alcohol ?? 2),
      romance: clampLegacyScore(vibe.romance, fallback.vibe.romance ?? 2),
    },
    flow: cleanStringList(draft.flow, fallback.flow).slice(0, 5),
  };
}

async function requestGptDraft(client: OpenAI, input: MeetingProposalInput) {
  const response = await client.responses.create({
    model: meetingProposalDraftModel,
    reasoning: { effort: "low" },
    instructions: [
      "You write Korean drafts for an operator-reviewed gathering proposal feature.",
      "Do not imply that the user is directly publishing an invitation.",
      "Use warm, concise Korean copy that fits a small curated offline gathering.",
      "For hashtags, return 2-3 short Korean keyword strings only: no # prefix, no spaces, no punctuation, no sentences, no questions, no English meta instructions, and no JSON guidance.",
      "Use mood, interest, or activity keywords only. Do not use region or place names, or generic gathering words such as 모임, 만남, 자리, or 교집합.",
      "Bad hashtag example: \"농장체험 이랑? no spaces? Need JSON valid\". Good examples: \"농장체험\", \"자연\", \"취향대화\".",
      "Return only JSON matching the provided schema.",
      "Vibe scores must use the existing legacy 1-5 scale: 1 means the left label, 5 means the right label.",
      "Vibe axes: temperature calm to lively, texture everyday to deep, tone empathy to analysis, rhythm planned to spontaneous, alcohol no alcohol to alcohol, romance comfortable to possibility of romance.",
    ].join("\n"),
    input: JSON.stringify(input, null, 2),
    text: {
      format: proposalDraftTextFormat,
    },
    max_output_tokens: 1000,
  });

  const text = response.output_text.trim();
  if (!text) throw new Error("OpenAI returned an empty meeting proposal draft.");

  const parsed = JSON.parse(text) as unknown;
  assertDraftHasRequiredFields(parsed);
  return normalizeDraft(parsed, input);
}

export function buildFallbackProposalDraft(
  input: MeetingProposalInput,
): MeetingProposalDraft {
  const title = input.title.trim();
  const region = input.region.trim() || "원하는 지역";
  const userHashtags = normalizeProposalHashtags(input.userHashtags, {
    blockedTags: [region, input.specificPlace],
  });
  const inferredTags = userHashtags.length
    ? userHashtags
    : ["취향대화", "새로운경험", "편한대화"];

  return {
    title,
    shortDescription: `${region}에서 ${input.activityDescription.trim() || "가볍게 취향을 나누는"} 자리예요.`,
    hashtags: inferredTags,
    activities: [
      "가볍게 인사하고 이 자리를 제안한 이유를 나눠요.",
      input.activityDescription.trim() || "서로의 취향과 관심사를 천천히 나눠요.",
      "분위기에 맞춰 자연스럽게 대화를 이어가요.",
    ],
    vibe: fallbackVibe,
    flow: [
      "처음에는 간단히 인사하고 자리에 앉아요.",
      "제안자가 이 자리를 떠올린 이유를 한마디로 소개해요.",
      "준비된 활동이나 대화 주제로 천천히 이어가요.",
      "마무리 전 좋았던 순간을 가볍게 나눠요.",
    ],
  };
}

export async function generateMeetingProposalDraft(
  input: MeetingProposalInput,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      draft: buildFallbackProposalDraft(input),
      source: "fallback" as const,
      notice: "OPENAI_API_KEY가 없어 임시 초안을 만들었어요.",
    };
  }

  const client = new OpenAI({ apiKey });
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return {
        draft: await requestGptDraft(client, input),
        source: "generated" as const,
        notice: null,
      };
    } catch (error) {
      lastError = error;
      console.warn("[meeting proposal draft] GPT-5.5 attempt failed", {
        attempt,
        error,
      });
    }
  }

  return {
    draft: buildFallbackProposalDraft(input),
    source: "fallback" as const,
    notice:
      "GPT-5.5 응답을 JSON으로 확인하지 못해 임시 초안을 만들었어요.",
  };
}
