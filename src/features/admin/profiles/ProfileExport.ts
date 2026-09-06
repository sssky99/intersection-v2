"use client";
import {
  preferenceQuestionCatalog,
  usesPreferenceProfile,
} from "@/data/preferenceQuestions";
import {
  isProfileArchetypeId,
  profileArchetypes,
} from "@/data/profileArchetypes";
import { profileAdditionalQuestions } from "@/data/profileDetailQuestions";
import { profileQuestions } from "@/data/profileQuestions";
import {
  type AdminProfile,
  type AdminProfileAnswer,
} from "@/features/admin/adminProfile";
import {
  membershipStatusLabels,
  type MembershipStatus,
} from "@/features/membership/membershipTypes";
import { parseTicketRatingAnswer } from "@/features/onboarding/ticketRating";
import type { ProfileQuestion, QuestionOption } from "@/types/question";

export const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function adminProfileArchetype(profile: AdminProfile) {
  if (!isProfileArchetypeId(profile.profile_archetype_id)) return null;
  return profileArchetypes[profile.profile_archetype_id];
}

export function adminProfileArchetypeLabel(profile: AdminProfile) {
  const archetype = adminProfileArchetype(profile);
  return archetype
    ? `${archetype.koreanName} · ${archetype.englishName}`
    : "미배정";
}

export function questionOrder(question: ProfileQuestion) {
  return question.order ?? question.id;
}

export function questionsForProfile(
  profile: Pick<AdminProfile, "profile_experience_version">,
) {
  return usesPreferenceProfile(profile)
    ? [...preferenceQuestionCatalog, ...profileAdditionalQuestions]
    : profileQuestions;
}

export function questionForOrder(
  order: number,
  questions: ProfileQuestion[] = profileQuestions,
) {
  return questions.find((question) => questionOrder(question) === order);
}

export function optionMeta(option: string | QuestionOption) {
  return typeof option === "string"
    ? { value: option, label: option, hasTextInput: false }
    : option;
}

export function selectedValues(answer: AdminProfileAnswer) {
  if (answer.answer_values?.length) return answer.answer_values;
  return answer.answer_value ? [answer.answer_value] : [];
}

export function selectedOptionDisplay(
  question: ProfileQuestion,
  value: string,
  otherText?: string | null,
) {
  const options = question.options ?? [];
  const index = options.findIndex(
    (option) => optionMeta(option).value === value,
  );
  const option = index >= 0 ? optionMeta(options[index]) : null;
  const label = option?.label ?? value;
  const suffix =
    option?.hasTextInput && otherText?.trim() ? ` (${otherText.trim()})` : "";

  return `${index >= 0 ? `${index + 1}번. ` : ""}${label}${suffix}`;
}

export function answerText(answer: AdminProfileAnswer) {
  return (
    answer.answer_text?.trim() ||
    answer.other_text?.trim() ||
    answer.answer_value?.trim() ||
    answer.answer_values?.join(", ") ||
    ""
  );
}

export function answerDisplayForExport(
  answer: AdminProfileAnswer,
  questions: ProfileQuestion[],
) {
  const ticketRating = parseTicketRatingAnswer(answer.answer_text);
  if (ticketRating) return `${ticketRating.title} (${ticketRating.rating}점)`;

  const question = questionForOrder(answer.question_order, questions);
  if (!question || question.type === "text") return answerText(answer);

  const values = selectedValues(answer);
  if (values.length === 0) return answerText(answer);

  return values
    .map((value, index) => {
      const displayText = selectedOptionDisplay(
        question,
        value,
        answer.other_text,
      );

      return question.category === "관심 분야"
        ? `${index + 1}순위. ${displayText.replace(/^\d+번\.\s*/, "")}`
        : displayText;
    })
    .join(" / ");
}

export function tsvCell(value: string | number | boolean | null | undefined) {
  return String(value ?? "")
    .replace(/\t/g, " ")
    .replace(/\r\n|\n|\r/g, " ");
}

export function compactTsvLabel(value: string) {
  return tsvCell(value).replace(/\s+/g, " ").trim();
}

export function answerExportColumns(profiles: AdminProfile[]) {
  const questionSets = [
    profiles.some((profile) => !usesPreferenceProfile(profile))
      ? { key: "legacy" as const, label: "기존", questions: profileQuestions }
      : null,
    profiles.some((profile) => usesPreferenceProfile(profile))
      ? {
          key: "preferences" as const,
          label: "신규",
          questions: [
            ...preferenceQuestionCatalog,
            ...profileAdditionalQuestions,
          ],
        }
      : null,
  ].filter(
    (
      item,
    ): item is {
      key: "legacy" | "preferences";
      label: string;
      questions: ProfileQuestion[];
    } => Boolean(item),
  );
  const showSetLabel = questionSets.length > 1;

  return questionSets.flatMap((questionSet) =>
    questionSet.questions
      .map((question) => ({
        questionSet: questionSet.key,
        setLabel: showSetLabel ? questionSet.label : "",
        order: questionOrder(question),
        question,
      }))
      .sort((left, right) => left.order - right.order),
  );
}

export function answerExportHeader(
  column: ReturnType<typeof answerExportColumns>[number],
) {
  const question = column.question;
  if (!question) return `Q${column.order}`;

  return compactTsvLabel(
    `${column.setLabel ? `[${column.setLabel}] ` : ""}Q${column.order}. ${question.category} - ${question.question}`,
  );
}

export function seoulDateStamp() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function downloadApplicantAnswersTsv(profiles: AdminProfile[]) {
  const columns = answerExportColumns(profiles);
  const headers = [
    "user_id",
    "신청일",
    "이름",
    "닉네임",
    "전화번호",
    "성별",
    "출생연도",
    "MBTI",
    "성향 유형",
    "프로필 완료",
    "질문 완료",
    "멤버십 상태",
    ...columns.map(answerExportHeader),
  ];
  const rows = profiles.map((profile) => {
    const profileQuestionSet = usesPreferenceProfile(profile)
      ? "preferences"
      : "legacy";
    const questions = questionsForProfile(profile);
    const answersByOrder = new Map(
      (profile.answers ?? []).map((answer) => [answer.question_order, answer]),
    );

    return [
      profile.user_id,
      formatCreatedAt(profile.created_at),
      profile.name,
      profile.nickname,
      profile.phone,
      profile.gender,
      profile.birth_year,
      profile.mbti,
      adminProfileArchetypeLabel(profile),
      completionText(profile.profile_completed),
      completionText(profile.questions_completed),
      membershipStatusLabels[membershipStatusValue(profile)],
      ...columns.map((column) => {
        if (column.questionSet !== profileQuestionSet) return "";
        const answer = answersByOrder.get(column.order);
        return answer ? answerDisplayForExport(answer, questions) : "";
      }),
    ];
  });
  const tsv = [headers, ...rows]
    .map((row) => row.map(tsvCell).join("\t"))
    .join("\n");
  const blob = new Blob(["\ufeff", tsv], {
    type: "text/tab-separated-values;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `applicant-answers-${seoulDateStamp()}.tsv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function formatCreatedAt(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return dateFormatter.format(date);
}

export function completionText(value: boolean | null) {
  return value ? "완료" : "미완료";
}

export function membershipStatusValue(profile: AdminProfile): MembershipStatus {
  return profile.membership_status ?? "none";
}
