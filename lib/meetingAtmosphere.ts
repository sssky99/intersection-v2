import type { Gender } from "@/types/user";
import { birthYearNumber } from "@/lib/meetingAgeVisibility";

export type MeetingAtmosphereProfile = {
  gender?: Gender | string | null;
  birthYear?: string | number | null;
};

export type MeetingAtmosphereLine = {
  key: "age" | "gender";
  label: string;
  text: string;
};

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

export type MeetingAtmosphereSummary = {
  ageBand: MeetingAtmosphereAgeBand | null;
  agePhrase: string;
  genderMood: MeetingAtmosphereGenderMood;
  genderPhrase: string;
};

const unknownAgePhrase = "신청자들의 나이 분위기를 곧 보여드릴게요.";

export const meetingAtmosphereAgeBands: MeetingAtmosphereAgeBand[] = [
  { id: "20-early", label: "20대 초반" },
  { id: "20-middle", label: "20대 중반" },
  { id: "20-late", label: "20대 후반" },
  { id: "30-early", label: "30대 초반" },
  { id: "30-middle", label: "30대 중반" },
];

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

export function meetingAtmosphereAgePhrase(
  birthYear: string | number | null | undefined,
  now = new Date(),
) {
  const age = ageFromBirthYear(birthYear, now);
  if (!age) return unknownAgePhrase;

  return `주로 ${ageBandFromAge(age).label}이 많이 신청했어요.`;
}

export function meetingAtmosphereGenderPhrase(
  gender: Gender | string | null | undefined,
) {
  const normalizedGender = normalizeProfileGender(gender);
  if (normalizedGender === "여성") {
    return "주로 여성분들이 많이 신청했어요.";
  }
  if (normalizedGender === "남성") {
    return "주로 남성분들이 많이 신청했어요.";
  }
  return "남녀 모두 많은 관심을 보이고 있어요.";
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
  const age = ageFromBirthYear(profile?.birthYear, now);
  const ageBand = age ? ageBandFromAge(age) : null;

  return {
    ageBand,
    agePhrase: ageBand
      ? `주로 ${ageBand.label}이 많이 신청했어요.`
      : unknownAgePhrase,
    genderMood: meetingAtmosphereGenderMood(profile?.gender),
    genderPhrase: meetingAtmosphereGenderPhrase(profile?.gender),
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
