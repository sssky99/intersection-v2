export const foodAndPlantEmojis = [
  "🍎",
  "🍊",
  "🍋",
  "🍐",
  "🍑",
  "🍒",
  "🍓",
  "🥝",
  "🍅",
  "🥕",
  "🌽",
  "🥐",
  "🍞",
  "🍙",
  "🍜",
  "🍪",
  "🌱",
  "🌿",
  "☘️",
  "🍀",
  "🌵",
  "🌷",
  "🌻",
  "🌼",
] as const;

const emojiGraphemePattern =
  /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Presentation}\u20E3]/u;

export function singleEmojiFromInput(value: string) {
  const [firstGrapheme] = Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
      value.trim(),
    ),
    (part) => part.segment,
  );

  return firstGrapheme && emojiGraphemePattern.test(firstGrapheme)
    ? firstGrapheme
    : null;
}

export function assignedProfileEmoji(userId: string) {
  let hash = 2166136261;

  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return foodAndPlantEmojis[(hash >>> 0) % foodAndPlantEmojis.length];
}

export function resolvedProfileEmoji(
  profile: { user_id: string; public_emoji?: string | null },
) {
  return profile.public_emoji?.trim() || assignedProfileEmoji(profile.user_id);
}
