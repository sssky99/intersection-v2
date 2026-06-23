const defaultBlockedTags = new Set([
  "모임",
  "만남",
  "자리",
  "교집합",
  "해시태그",
  "태그",
  "hashtag",
  "hashtags",
  "json",
  "valid",
  "need",
  "needs",
  "no",
  "only",
  "space",
  "spaces",
  "korea",
  "korean",
]);

const tagPattern = /^[\p{Script=Hangul}A-Za-z0-9]+$/u;

function tagLength(value: string) {
  return Array.from(value).length;
}

function normalizeBlockedTag(value: string) {
  return value.trim().replace(/^#+/, "").toLocaleLowerCase("ko-KR");
}

function tagCandidates(value: string) {
  return value
    .split(/[#,\n\r]+/)
    .map((item) =>
      item
        .trim()
        .replace(/^#+/, "")
        .replace(/[\u200B-\u200D\uFEFF]/g, ""),
    )
    .filter(Boolean);
}

export function normalizeProposalHashtags(
  value: unknown,
  {
    blockedTags = [],
    fallback = [],
    limit = 3,
  }: {
    blockedTags?: Array<string | null | undefined>;
    fallback?: string[];
    limit?: number;
  } = {},
): string[] {
  const blocked = new Set(defaultBlockedTags);
  for (const tag of blockedTags) {
    if (!tag) continue;
    blocked.add(normalizeBlockedTag(tag));
    for (const candidate of tagCandidates(tag)) {
      for (const part of candidate.split(/\s+/)) {
        if (part) blocked.add(normalizeBlockedTag(part));
      }
    }
  }

  const rawItems = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? [value]
      : [];
  const tags: string[] = [];

  for (const rawItem of rawItems) {
    for (const candidate of tagCandidates(rawItem)) {
      const normalized = candidate.normalize("NFKC");
      const normalizedKey = normalized.toLocaleLowerCase("ko-KR");

      if (
        !normalized ||
        /\s/.test(normalized) ||
        tagLength(normalized) > 10 ||
        !tagPattern.test(normalized) ||
        blocked.has(normalizedKey) ||
        tags.some((tag) => tag.toLocaleLowerCase("ko-KR") === normalizedKey)
      ) {
        continue;
      }

      tags.push(normalized);
      if (tags.length >= limit) return tags;
    }
  }

  if (tags.length > 0) return tags;

  return fallback.length > 0
    ? normalizeProposalHashtags(fallback, { blockedTags, limit })
    : [];
}
