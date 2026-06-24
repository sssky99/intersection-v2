import "server-only";

import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  MeetingProposalCoverImage,
  MeetingProposalInput,
} from "@/types/meetingProposal";

const pexelsSearchEndpoint = "https://api.pexels.com/v1/search";
const reviewModel = "gpt-5.5";
const blockedAltTerms = [
  "people",
  "person",
  "man",
  "woman",
  "couple",
  "crowd",
  "portrait",
  "party",
  "illustration",
  "cartoon",
  "character",
  "vector",
  "render",
  "graphic",
  "advertisement",
  "poster",
  "logo",
  "text",
];

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  alt: string | null;
  photographer: string;
  photographer_url: string;
  src: {
    portrait?: string;
    large2x?: string;
    large?: string;
    medium?: string;
  };
};

type PexelsResponse = {
  photos?: PexelsPhoto[];
};

type CoverCandidate = {
  photoId: string;
  imageUrl: string;
  pageUrl: string;
  photographer: string;
  photographerUrl: string;
  alt: string;
  width: number;
  height: number;
};

type ImageReview = {
  photo_id: string;
  approved: boolean;
  score: number;
  people_risk: "low" | "medium" | "high";
  brand_tone_risk: "low" | "medium" | "high";
  reason: string;
};

const imageReviewFormat = {
  type: "json_schema",
  name: "meeting_cover_image_reviews",
  description:
    "Quality review decisions for Pexels cover-image candidates for a Korean curated gathering ticket.",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      reviews: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            photo_id: { type: "string" },
            approved: { type: "boolean" },
            score: { type: "integer", minimum: 0, maximum: 10 },
            people_risk: {
              type: "string",
              enum: ["low", "medium", "high"],
            },
            brand_tone_risk: {
              type: "string",
              enum: ["low", "medium", "high"],
            },
            reason: { type: "string" },
          },
          required: [
            "photo_id",
            "approved",
            "score",
            "people_risk",
            "brand_tone_risk",
            "reason",
          ],
        },
      },
    },
    required: ["reviews"],
  },
} as const;

function activitySearchQuery({
  activityDescription,
  place,
  title,
}: Pick<MeetingProposalInput, "activityDescription" | "place"> & {
  title?: string;
}) {
  const text = [
    activityDescription,
    place?.category,
    place?.name,
    title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(영화|시네마|극장|cinema|movie)/.test(text)) {
    return "empty cinema seats movie theater interior";
  }
  if (/(카페|커피|coffee|cafe)/.test(text)) {
    return "cozy cafe interior table coffee still life";
  }
  if (/(전시|미술관|갤러리|museum|gallery|exhibition)/.test(text)) {
    return "quiet art gallery interior museum exhibition wall";
  }
  if (/(식사|맛집|저녁|점심|레스토랑|restaurant|dinner|brunch)/.test(text)) {
    return "cozy restaurant table dinner setting still life";
  }
  if (/(산책|공원|걷기|park|walk)/.test(text)) {
    return "quiet city street park path detail";
  }
  if (/(술|와인|칵테일|바(?:\s|$)|bar\b|wine|cocktail)/.test(text)) {
    return "quiet cocktail bar interior wine glass table";
  }
  if (/(보드게임|게임|board game|tabletop)/.test(text)) {
    return "board game table tabletop game pieces still life";
  }
  if (/(책|독서|북토크|서점|book|reading)/.test(text)) {
    return "cozy bookstore reading table quiet interior";
  }
  if (/(공방|만들기|도예|craft|workshop)/.test(text)) {
    return "cozy craft workshop table detail interior";
  }

  return "quiet cozy interior table space still life";
}

function imageUrl(photo: PexelsPhoto) {
  return photo.src.portrait ?? photo.src.large2x ?? photo.src.large ?? photo.src.medium ?? null;
}

function isUsablePhoto(photo: PexelsPhoto, excludedPhotoIds: Set<string>) {
  const selectedImageUrl = imageUrl(photo);
  const alt = (photo.alt ?? "").toLowerCase();
  const isVertical = photo.height >= photo.width * 1.12;
  const isLargeEnough = photo.width >= 500 && photo.height >= 800;

  return Boolean(
    selectedImageUrl &&
      isVertical &&
      isLargeEnough &&
      !excludedPhotoIds.has(String(photo.id)) &&
      !blockedAltTerms.some((term) => alt.includes(term)),
  );
}

async function recentlyUsedPexelsPhotoIds() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ticket_templates")
    .select("pexels_photo_id")
    .eq("image_source", "pexels")
    .not("pexels_photo_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;

  return new Set(
    (data ?? [])
      .map((row) => row.pexels_photo_id)
      .filter((photoId): photoId is string => Boolean(photoId)),
  );
}

async function pexelsCandidates({
  input,
  title,
}: {
  input: MeetingProposalInput;
  title?: string;
}) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];

  const query = activitySearchQuery({
    activityDescription: input.activityDescription,
    place: input.place,
    title,
  });
  const url = new URL(pexelsSearchEndpoint);
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", "portrait");
  url.searchParams.set("size", "large");
  url.searchParams.set("per_page", "24");

  const [response, excludedPhotoIds] = await Promise.all([
    fetch(url, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(12_000),
    }),
    recentlyUsedPexelsPhotoIds(),
  ]);
  if (!response.ok) {
    throw new Error(`Pexels search failed with ${response.status}.`);
  }

  const data = (await response.json()) as PexelsResponse;
  return (data.photos ?? [])
    .filter((photo) => isUsablePhoto(photo, excludedPhotoIds))
    .map((photo): CoverCandidate => ({
      photoId: String(photo.id),
      imageUrl: imageUrl(photo)!,
      pageUrl: photo.url,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      alt: photo.alt?.trim() ?? "",
      width: photo.width,
      height: photo.height,
    }))
    .slice(0, 8);
}

function isImageReview(value: unknown): value is ImageReview {
  if (!value || typeof value !== "object") return false;
  const review = value as Record<string, unknown>;
  return (
    typeof review.photo_id === "string" &&
    typeof review.approved === "boolean" &&
    typeof review.score === "number" &&
    Number.isFinite(review.score) &&
    ["low", "medium", "high"].includes(String(review.people_risk)) &&
    ["low", "medium", "high"].includes(String(review.brand_tone_risk)) &&
    typeof review.reason === "string"
  );
}

async function reviewCandidates(candidates: CoverCandidate[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || candidates.length === 0) return [];

  const client = new OpenAI({ apiKey });
  const candidateList = candidates
    .map(
      (candidate, index) =>
        `${index + 1}. photo_id=${candidate.photoId}; alt=${candidate.alt || "(none)"}; ${candidate.width}x${candidate.height}`,
    )
    .join("\n");
  const response = await client.responses.create({
    model: reviewModel,
    reasoning: { effort: "low" },
    instructions: [
      "You are reviewing Pexels images for a Korean curated offline gathering ticket cover.",
      "Review every supplied image in order and return exactly one JSON review per provided photo_id.",
      "Reject images with prominent faces, people as the main subject, dating-ad aesthetics, western party vibes, illustrations, characters, AI-looking art, or central text/logos.",
      "Approve only calm, natural space, object, interior, table, seat, street, or atmosphere-centered images.",
      "Set people_risk and brand_tone_risk to low only when the image is safe for this ticket cover.",
      "Return only JSON matching the schema.",
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Candidates, in the exact image order below:\n${candidateList}`,
          },
          ...candidates.map((candidate) => ({
            type: "input_image" as const,
            image_url: candidate.imageUrl,
            detail: "low" as const,
          })),
        ],
      },
    ],
    text: { format: imageReviewFormat },
    max_output_tokens: 1600,
  });

  const output = response.output_text.trim();
  if (!output) throw new Error("GPT-5.5 returned an empty image review.");

  const parsed = JSON.parse(output) as { reviews?: unknown };
  const candidateIds = new Set(candidates.map((candidate) => candidate.photoId));
  return Array.isArray(parsed.reviews)
    ? parsed.reviews.filter(isImageReview).filter((review) => candidateIds.has(review.photo_id))
    : [];
}

export async function selectMeetingProposalCoverImage({
  input,
  title,
}: {
  input: MeetingProposalInput;
  title?: string;
}): Promise<{ coverImage: MeetingProposalCoverImage | null; notice: string | null }> {
  try {
    const candidates = await pexelsCandidates({ input, title });
    if (candidates.length === 0) {
      return {
        coverImage: null,
        notice: "자동 대표 이미지를 찾지 못했어요. 미리보기에서 직접 사진을 올릴 수 있어요.",
      };
    }

    const reviews = await reviewCandidates(candidates);
    const reviewById = new Map(reviews.map((review) => [review.photo_id, review]));
    const approved = candidates
      .map((candidate) => ({ candidate, review: reviewById.get(candidate.photoId) }))
      .filter(
        (
          value,
        ): value is { candidate: CoverCandidate; review: ImageReview } =>
          Boolean(
            value.review?.approved &&
              value.review.score >= 7 &&
              value.review.people_risk === "low" &&
              value.review.brand_tone_risk === "low",
          ),
      )
      .sort((left, right) => right.review.score - left.review.score);

    if (approved.length === 0) {
      return {
        coverImage: null,
        notice: "자동 대표 이미지가 검수 기준을 통과하지 못했어요. 미리보기에서 직접 사진을 올릴 수 있어요.",
      };
    }

    const pool = approved.slice(0, Math.min(5, approved.length));
    const selected = pool[Math.floor(Math.random() * pool.length)];

    return {
      coverImage: {
        imageUrl: selected.candidate.imageUrl,
        imageSource: "pexels",
        imageSelectionMethod: "auto",
        pexelsPhotoId: selected.candidate.photoId,
        pexelsPageUrl: selected.candidate.pageUrl,
        photographer: selected.candidate.photographer,
        photographerUrl: selected.candidate.photographerUrl,
        imageReviewModel: reviewModel,
      },
      notice: null,
    };
  } catch (error) {
    console.warn("[meeting proposal cover image] automatic selection failed", error);
    return {
      coverImage: null,
      notice: "자동 대표 이미지를 준비하지 못했어요. 미리보기에서 직접 사진을 올릴 수 있어요.",
    };
  }
}
