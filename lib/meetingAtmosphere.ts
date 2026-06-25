import type { Gender } from "@/types/user";
import { birthYearNumber } from "@/lib/meetingAgeVisibility";

export type MeetingAtmosphereAgeBandId =
  | "20-early"
  | "20-middle"
  | "20-late"
  | "30-early"
  | "30-middle";

export type MeetingAtmosphereGenderMood = "female" | "male" | "balanced";

export type MeetingAtmosphereAgeBand = {
  id: MeetingAtmosphereAgeBandId;
  label: string;
};

export type MeetingAtmosphereProfile = {
  gender?: Gender | string | null;
  birthYear?: string | number | null;
  ageBandId?: MeetingAtmosphereAgeBandId | string | null;
  genderMood?: MeetingAtmosphereGenderMood | string | null;
};

export type MeetingAtmosphereLine = {
  key: "age" | "gender";
  label: string;
  text: string;
};

export type MeetingAtmosphereSummary = {
  ageBand: MeetingAtmosphereAgeBand | null;
  agePhrase: string;
  genderMood: MeetingAtmosphereGenderMood;
  genderPhrase: string;
};

export type MeetingAtmosphereDefaults = {
  ageBandId: MeetingAtmosphereAgeBandId | null;
  genderMood: MeetingAtmosphereGenderMood | null;
};

const unknownAgePhrase = "신청자들의 나이 분위기를 곧 보여드릴게요.";

export const meetingAtmosphereAgeBands: MeetingAtmosphereAgeBand[] = [
  { id: "20-early", label: "20대 초반" },
  { id: "20-middle", label: "20대 중반" },
  { id: "20-late", label: "20대 후반" },
  { id: "30-early", label: "30대 초반" },
  { id: "30-middle", label: "30대 중반" },
];

export const meetingAtmosphereGenderMoodLabels: Record<
  MeetingAtmosphereGenderMood,
  string
> = {
  male: "남성 선호",
  female: "여성 선호",
  balanced: "모두 선호",
};

const ageBandMap = new Map(
  meetingAtmosphereAgeBands.map((band) => [band.id, band]),
);

export function normalizeMeetingAtmosphereAgeBandId(
  value: unknown,
): MeetingAtmosphereAgeBandId | null {
  return meetingAtmosphereAgeBands.some((band) => band.id === value)
    ? (value as MeetingAtmosphereAgeBandId)
    : null;
}

export function normalizeMeetingAtmosphereGenderMood(
  value: unknown,
): MeetingAtmosphereGenderMood | null {
  if (value === "female" || value === "male" || value === "balanced") {
    return value;
  }

  return null;
}

export function meetingAtmosphereAgeBandById(
  id: MeetingAtmosphereAgeBandId | string | null | undefined,
) {
  return normalizeMeetingAtmosphereAgeBandId(id)
    ? ageBandMap.get(id as MeetingAtmosphereAgeBandId) ?? null
    : null;
}

function ageFromBirthYear(
  birthYear: string | number | null | undefined,
  now = new Date(),
) {
  const year = birthYearNumber(birthYear);
  if (!year) return null;

  const age = now.getFullYear() + 1 - year;
  return age > 0 && age < 100 ? age : null;
}

function ageSeason(age: number) {
  const lastDigit = age % 10;
  if (lastDigit <= 3) return "early";
  if (lastDigit <= 6) return "middle";
  return "late";
}

function ageBandFromAge(age: number): MeetingAtmosphereAgeBand {
  const season = ageSeason(age);
  const decade = Math.floor(age / 10) * 10;

  if (decade < 30) {
    if (season === "middle") return meetingAtmosphereAgeBands[1];
    if (season === "late") return meetingAtmosphereAgeBands[2];
    return meetingAtmosphereAgeBands[0];
  }

  if (season === "early") return meetingAtmosphereAgeBands[3];
  return meetingAtmosphereAgeBands[4];
}

export function normalizeProfileGender(value: unknown): Gender | null {
  if (
    value === "여성" ||
    value === "남성" ||
    value === "비공개" ||
    value === ""
  ) {
    return value;
  }

  return null;
}

export function meetingAtmosphereAgePhraseFromBand(
  ageBandId: MeetingAtmosphereAgeBandId | string | null | undefined,
) {
  const ageBand = meetingAtmosphereAgeBandById(ageBandId);
  return ageBand
    ? `주로 ${ageBand.label}이 많이 신청했어요.`
    : unknownAgePhrase;
}

export function meetingAtmosphereAgePhrase(
  birthYear: string | number | null | undefined,
  now = new Date(),
) {
  const age = ageFromBirthYear(birthYear, now);
  if (!age) return unknownAgePhrase;

  return meetingAtmosphereAgePhraseFromBand(ageBandFromAge(age).id);
}

export function meetingAtmosphereGenderPhraseFromMood(
  mood: MeetingAtmosphereGenderMood | string | null | undefined,
) {
  const normalizedMood = normalizeMeetingAtmosphereGenderMood(mood);
  if (normalizedMood === "female") {
    return "주로 여성분들이 많이 신청했어요.";
  }
  if (normalizedMood === "male") {
    return "주로 남성분들이 많이 신청했어요.";
  }
  return "성별 모두 많은 관심을 보이고 있어요.";
}

export function meetingAtmosphereGenderPhrase(
  gender: Gender | string | null | undefined,
) {
  return meetingAtmosphereGenderPhraseFromMood(
    meetingAtmosphereGenderMood(gender),
  );
}

export function meetingAtmosphereGenderMood(
  gender: Gender | string | null | undefined,
): MeetingAtmosphereGenderMood {
  const normalizedGender = normalizeProfileGender(gender);
  if (normalizedGender === "여성") return "female";
  if (normalizedGender === "남성") return "male";
  return "balanced";
}

export function meetingAtmosphereSummary(
  profile: MeetingAtmosphereProfile | null | undefined,
  now = new Date(),
): MeetingAtmosphereSummary {
  const explicitAgeBand = meetingAtmosphereAgeBandById(profile?.ageBandId);
  const age = explicitAgeBand ? null : ageFromBirthYear(profile?.birthYear, now);
  const ageBand = explicitAgeBand ?? (age ? ageBandFromAge(age) : null);
  const genderMood =
    normalizeMeetingAtmosphereGenderMood(profile?.genderMood) ??
    meetingAtmosphereGenderMood(profile?.gender);

  return {
    ageBand,
    agePhrase: ageBand
      ? meetingAtmosphereAgePhraseFromBand(ageBand.id)
      : unknownAgePhrase,
    genderMood,
    genderPhrase: meetingAtmosphereGenderPhraseFromMood(genderMood),
  };
}

export function meetingAtmosphereLines(
  profile: MeetingAtmosphereProfile | null | undefined,
): MeetingAtmosphereLine[] {
  const summary = meetingAtmosphereSummary(profile);

  return [
    {
      key: "age",
      label: "나이",
      text: summary.agePhrase,
    },
    {
      key: "gender",
      label: "성별",
      text: summary.genderPhrase,
    },
  ];
}

export function meetingAtmosphereDefaultsFromProfiles(
  profiles: Array<{
    gender?: Gender | string | null;
    birthYear?: string | number | null;
    birth_year?: string | number | null;
  }>,
  now = new Date(),
): MeetingAtmosphereDefaults {
  const ageCounts = new Map<MeetingAtmosphereAgeBandId, number>();
  let femaleCount = 0;
  let maleCount = 0;

  for (const profile of profiles) {
    const age = ageFromBirthYear(profile.birthYear ?? profile.birth_year, now);
    if (age) {
      const ageBand = ageBandFromAge(age).id;
      ageCounts.set(ageBand, (ageCounts.get(ageBand) ?? 0) + 1);
    }

    const gender = normalizeProfileGender(profile.gender);
    if (gender === "여성") femaleCount += 1;
    if (gender === "남성") maleCount += 1;
  }

  const ageBandId =
    [...ageCounts.entries()].sort(
      ([leftId, leftCount], [rightId, rightCount]) =>
        rightCount - leftCount ||
        meetingAtmosphereAgeBands.findIndex((band) => band.id === leftId) -
          meetingAtmosphereAgeBands.findIndex((band) => band.id === rightId),
    )[0]?.[0] ?? null;

  return {
    ageBandId,
    genderMood:
      femaleCount > maleCount
        ? "female"
        : maleCount > femaleCount
          ? "male"
          : "balanced",
  };
}
