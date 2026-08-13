"use client";

import {
  BookOpen,
  Download,
  Image as ImageIcon,
  LogOut,
  Save,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarAdminPanel } from "@/features/admin/CalendarAdminPanel";
import {
  preferenceQuestionCatalog,
  usesPreferenceProfile,
} from "@/data/preferenceQuestions";
import { profileAdditionalQuestions } from "@/data/profileDetailQuestions";
import { profileQuestions } from "@/data/profileQuestions";
import {
  isProfileArchetypeId,
  profileArchetypeAssignmentGuide,
  profileArchetypes,
  profileArchetypeIds,
  profileArchetypeScoreCalibration,
} from "@/data/profileArchetypes";
import { BlindDateAdminPanel } from "@/features/admin/BlindDateAdminPanel";
import { FeedbackAdminPanel } from "@/features/admin/FeedbackAdminPanel";
import { FunnelAdminPanel } from "@/features/admin/FunnelAdminPanel";
import { MembershipAdminPanel } from "@/features/admin/MembershipAdminPanel";
import { MeetingEventAdminPanel } from "@/features/admin/MeetingEventAdminPanel";
import { RoomChatAdminPanel } from "@/features/admin/RoomChatAdminPanel";
import { TicketAdminPanel } from "@/features/admin/TicketAdminPanel";
import { VisitorAdminPanel } from "@/features/admin/VisitorAdminPanel";
import { WaitlistAdminPanel } from "@/features/admin/WaitlistAdminPanel";
import {
  AdminMemberName,
  GenderBadge,
  formatAgeAndBirthYear,
} from "@/features/admin/adminDisplay";
import {
  normalizeAdminProfile,
  type AdminProfile,
  type AdminProfileAnswer,
} from "@/features/admin/adminProfile";
import { parseTicketRatingAnswer } from "@/features/onboarding/ticketRating";
import {
  membershipStatusLabels,
  type MembershipStatus,
} from "@/features/membership/membershipTypes";
import type { ProfileQuestion, QuestionOption } from "@/types/question";

type AdminTab =
  | "applicants"
  | "visitors"
  | "membership"
  | "tickets"
  | "events"
  | "calendar"
  | "waitlist"
  | "rooms"
  | "feedback"
  | "blindDates"
  | "funnel";

type ViewMode = "list" | "cards" | "dropoffs";
type MembershipFilter = "all" | "active" | "inactive";
type CompletionFilter = "all" | "complete" | "incomplete";

const applicantMembershipStatuses: MembershipStatus[] = [
  "none",
  "pending",
  "active",
  "expired",
  "cancelled",
];

const adminTabs: Array<{ id: AdminTab; label: string }> = [
  { id: "applicants", label: "신청자 관리" },
  { id: "visitors", label: "방문자 관리" },
  { id: "membership", label: "멤버십 관리" },
  { id: "tickets", label: "프로그램 관리" },
  { id: "events", label: "행사 관리" },
  { id: "calendar", label: "달력 관리" },
  { id: "waitlist", label: "대기열 관리" },
  { id: "rooms", label: "룸 관리" },
  { id: "feedback", label: "피드백 관리" },
  { id: "blindDates", label: "블라인드 데이트 관리" },
  { id: "funnel", label: "퍼널 관리" },
];

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function display(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function adminProfileArchetype(profile: AdminProfile) {
  if (!isProfileArchetypeId(profile.profile_archetype_id)) return null;
  return profileArchetypes[profile.profile_archetype_id];
}

function adminProfileArchetypeLabel(profile: AdminProfile) {
  const archetype = adminProfileArchetype(profile);
  return archetype
    ? `${archetype.koreanName} · ${archetype.englishName}`
    : "미배정";
}

function isDropoffProfile(
  profile: Pick<AdminProfile, "photo_url" | "profile_archetype_id">,
) {
  const hasSubmittedPhoto = Boolean(profile.photo_url?.trim());
  const hasAssignedArchetype = isProfileArchetypeId(
    profile.profile_archetype_id,
  );

  return !hasSubmittedPhoto || !hasAssignedArchetype;
}

function questionOrder(question: ProfileQuestion) {
  return question.order ?? question.id;
}

function questionsForProfile(
  profile: Pick<AdminProfile, "profile_experience_version">,
) {
  return usesPreferenceProfile(profile)
    ? [...preferenceQuestionCatalog, ...profileAdditionalQuestions]
    : profileQuestions;
}

const additionalQuestionOrders = new Set(
  profileAdditionalQuestions.map(questionOrder),
);

function isAdditionalQuestion(question: ProfileQuestion) {
  return additionalQuestionOrders.has(questionOrder(question));
}

function questionScaleMeta(question: ProfileQuestion) {
  const options = question.options ?? [];
  const numericValues = options.map((option) => {
    const value = optionMeta(option).value;
    return /^\d+$/.test(value) ? Number(value) : null;
  });
  const isNumericScale =
    numericValues.length >= 3 && numericValues.every((value) => value !== null);

  if (!isNumericScale) return null;

  const values = numericValues as number[];
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    min,
    max,
    minLabel: question.scaleMinLabel ?? String(min),
    maxLabel: question.scaleMaxLabel ?? String(max),
  };
}

function answerTypeLabel(question: ProfileQuestion) {
  if (question.type === "text") return "주관식";
  if (question.type === "multi_choice") return "복수 선택";
  return "단일 선택";
}

function questionForOrder(
  order: number,
  questions: ProfileQuestion[] = profileQuestions,
) {
  return questions.find((question) => questionOrder(question) === order);
}

function questionForAnswer(
  answer: AdminProfileAnswer,
  questions: ProfileQuestion[],
) {
  const matches = questions.filter(
    (question) => questionOrder(question) === answer.question_order,
  );
  if (matches.length <= 1) return matches[0];

  return (
    matches.find(
      (question) =>
        question.category === answer.category &&
        question.type === answer.question_type,
    ) ??
    matches.find((question) => question.category === answer.category) ??
    matches[0]
  );
}

function optionMeta(option: string | QuestionOption) {
  return typeof option === "string"
    ? { value: option, label: option, hasTextInput: false }
    : option;
}

function selectedValues(answer: AdminProfileAnswer) {
  if (answer.answer_values?.length) return answer.answer_values;
  return answer.answer_value ? [answer.answer_value] : [];
}

function selectedOptionDisplay(
  question: ProfileQuestion,
  value: string,
  otherText?: string | null,
) {
  const options = question.options ?? [];
  const index = options.findIndex((option) => optionMeta(option).value === value);
  const option = index >= 0 ? optionMeta(options[index]) : null;
  const label = option?.label ?? value;
  const suffix =
    option?.hasTextInput && otherText?.trim() ? ` (${otherText.trim()})` : "";

  return `${index >= 0 ? `${index + 1}번. ` : ""}${label}${suffix}`;
}

function answerText(answer: AdminProfileAnswer) {
  return (
    answer.answer_text?.trim() ||
    answer.other_text?.trim() ||
    answer.answer_value?.trim() ||
    answer.answer_values?.join(", ") ||
    ""
  );
}

function answerDisplayForExport(
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

function tsvCell(value: string | number | boolean | null | undefined) {
  return String(value ?? "")
    .replace(/\t/g, " ")
    .replace(/\r\n|\n|\r/g, " ");
}

function compactTsvLabel(value: string) {
  return tsvCell(value).replace(/\s+/g, " ").trim();
}

function answerExportColumns(profiles: AdminProfile[]) {
  const questionSets = [
    profiles.some((profile) => !usesPreferenceProfile(profile))
      ? { key: "legacy" as const, label: "기존", questions: profileQuestions }
      : null,
    profiles.some((profile) => usesPreferenceProfile(profile))
      ? {
          key: "preferences" as const,
          label: "신규",
          questions: [...preferenceQuestionCatalog, ...profileAdditionalQuestions],
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

function answerExportHeader(
  column: ReturnType<typeof answerExportColumns>[number],
) {
  const question = column.question;
  if (!question) return `Q${column.order}`;

  return compactTsvLabel(
    `${column.setLabel ? `[${column.setLabel}] ` : ""}Q${column.order}. ${question.category} - ${question.question}`,
  );
}

function seoulDateStamp() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function downloadApplicantAnswersTsv(profiles: AdminProfile[]) {
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

function formatCreatedAt(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return dateFormatter.format(date);
}

function formatCreatedAtCompact(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return `${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}

function formatPhoneCompact(value: string | null | undefined) {
  if (!value) return "-";

  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return value;

  const tail = digits.slice(-8);
  return `${tail.slice(0, 4)} - ${tail.slice(4)}`;
}

function completionText(value: boolean | null) {
  return value ? "완료" : "미완료";
}

function membershipStatusValue(profile: AdminProfile): MembershipStatus {
  return profile.membership_status ?? "none";
}

type ProfileDetailPatch = {
  isTestParticipant?: boolean;
  matchingPrecisionBonus?: number;
};

function clampMatchingPrecisionBonus(value: number) {
  return Math.min(5, Math.max(0, Math.round(value)));
}

function adminMatchingPrecisionBonus(profile: AdminProfile | null) {
  const value = profile?.matching_precision_bonus;
  return typeof value === "number" && Number.isFinite(value)
    ? clampMatchingPrecisionBonus(value)
    : 0;
}

function AssignmentCriteriaDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-criteria-title"
        className="flex max-h-[92dvh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[24px] border border-black/10 bg-[#f7f7f5] shadow-[0_30px_100px_rgba(0,0,0,0.22)]"
      >
        <header className="flex items-start justify-between gap-5 border-b border-black/10 bg-white px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
              profile assignment guide
            </p>
            <h2
              id="assignment-criteria-title"
              className="mt-1 text-2xl font-bold tracking-tight"
            >
              유형 배정 기준
            </h2>
            <p className="mt-2 text-sm leading-6 text-black/55">
              현재 프로필 유형 분류 코드에서 실제로 반영하는 응답 방향을
              운영용으로 요약한 표입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="유형 배정 기준 닫기"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-black/55 transition hover:border-black/25 hover:text-black"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="overflow-y-auto px-6 py-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <CriteriaSummaryCard
              label="1. 응답별 점수"
              body="척도형 답변은 낮은 쪽과 높은 쪽 유형에 비례 배분하고, 취미·관심·직업 선택은 관련 유형에 가중 점수를 더합니다."
            />
            <CriteriaSummaryCard
              label="2. 직접 반영 문항"
              body="척도 6~12·20~27번, 그룹 역할 19번, 취미 13번, 관심사 14번, 활동 회피 15번, 직업 28번을 계산합니다. 그 외 문항은 현재 직접 점수화하지 않습니다."
            />
            <CriteriaSummaryCard
              label="3. 유형별 보정"
              body="질문 수와 신호 분포 차이를 보완하기 위해 유형마다 보정계수를 적용한 뒤 최종 점수를 비교합니다."
            />
            <CriteriaSummaryCard
              label="4. 근소한 점수 차"
              body="1·2위 차이가 0.75점 이하 또는 1위 점수의 8% 이하이면 사용자와 답변 기반의 고정값으로 둘 중 하나를 선택합니다."
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-black/10 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full border-collapse text-left">
                <thead className="bg-black/[0.035] text-xs font-bold text-black/55">
                  <tr>
                    <th className="w-[190px] px-5 py-4">유형</th>
                    <th className="w-[270px] px-5 py-4">핵심 성향</th>
                    <th className="px-5 py-4">점수를 높이는 대표 응답</th>
                    <th className="w-[100px] px-5 py-4 text-center">
                      보정계수
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {profileArchetypeIds.map((id) => {
                    const archetype = profileArchetypes[id];
                    const guide = profileArchetypeAssignmentGuide[id];
                    return (
                      <tr
                        key={id}
                        className="border-t border-black/[0.07] align-top"
                      >
                        <td className="px-5 py-4">
                          <p className="font-bold text-black">
                            {archetype.koreanName}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-black/40">
                            {archetype.englishName}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium leading-6 text-black/70">
                          {guide.summary}
                        </td>
                        <td className="px-5 py-4">
                          <ul className="space-y-1.5 text-sm leading-5 text-black/65">
                            {guide.signals.map((signal) => (
                              <li key={signal} className="flex gap-2">
                                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" />
                                <span>{signal}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-5 py-4 text-center text-sm font-bold tabular-nums text-black/65">
                          ×{profileArchetypeScoreCalibration[id].toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900/70">
            이 표는 대표 신호를 요약한 운영 가이드입니다. 실제 결과는 여러
            답변의 누적 가중점수로 정해지므로 특정 답변 하나만으로 유형이
            확정되지는 않습니다.
          </p>
        </div>
      </section>
    </div>
  );
}

function CriteriaSummaryCard({ label, body }: { label: string; body: string }) {
  return (
    <article className="rounded-2xl border border-black/10 bg-white p-4">
      <p className="text-sm font-bold">{label}</p>
      <p className="mt-2 text-xs font-medium leading-5 text-black/55">{body}</p>
    </article>
  );
}

export function AdminPageClient({
  initialAuthenticated,
}: {
  initialAuthenticated: boolean;
}) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [accessKey, setAccessKey] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("applicants");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [membershipSaveError, setMembershipSaveError] = useState<string | null>(
    null,
  );
  const [savingMembershipUserId, setSavingMembershipUserId] = useState<
    string | null
  >(null);
  const [savingProfileUserId, setSavingProfileUserId] = useState<string | null>(
    null,
  );
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileSaveNotice, setProfileSaveNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [membershipFilter, setMembershipFilter] =
    useState<MembershipFilter>("all");
  const [completionFilter, setCompletionFilter] =
    useState<CompletionFilter>("all");
  const [ticketFocusId, setTicketFocusId] = useState<string | null>(null);
  const [assignmentCriteriaOpen, setAssignmentCriteriaOpen] = useState(false);
  const [visitedTabs, setVisitedTabs] = useState<
    Partial<Record<AdminTab, boolean>>
  >({ applicants: true });

  useEffect(() => {
    if (!assignmentCriteriaOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAssignmentCriteriaOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [assignmentCriteriaOpen]);

  const loadProfiles = useCallback(async (force = false) => {
    if (!authenticated) return;
    if (profilesLoading) return;
    if (!force && profilesLoaded) return;

    setProfilesLoading(true);
    setProfilesError(null);

    try {
      const response = await fetch("/api/admin/profiles", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setAuthenticated(false);
        setProfiles([]);
        setProfilesLoaded(false);
        setSelectedProfileId(null);
        return;
      }

      if (!response.ok) {
        throw new Error("profiles-load-failed");
      }

      const data = (await response.json()) as { profiles?: AdminProfile[] };
      const nextProfiles = data.profiles ?? [];
      setProfiles(nextProfiles);
      setProfilesLoaded(true);
      setSelectedProfileId((current) => current ?? nextProfiles[0]?.user_id ?? null);
    } catch {
      setProfilesError("신청자 목록을 불러오지 못했습니다.");
    } finally {
      setProfilesLoading(false);
    }
  }, [authenticated, profilesLoaded, profilesLoading]);

  useEffect(() => {
    if (activeTab !== "applicants" || profilesLoaded || profilesLoading) return;
    void loadProfiles();
  }, [activeTab, loadProfiles, profilesLoaded, profilesLoading]);

  const selectTab = (tabId: AdminTab) => {
    setActiveTab(tabId);
    setVisitedTabs((current) =>
      current[tabId] ? current : { ...current, [tabId]: true },
    );
  };

  const openTicketFromCalendar = (ticketId: string) => {
    setTicketFocusId(ticketId);
    setActiveTab("tickets");
    setVisitedTabs((current) =>
      current.tickets ? current : { ...current, tickets: true },
    );
  };

  const changeMembershipStatus = async (
    userId: string,
    status: MembershipStatus,
  ) => {
    if (savingMembershipUserId === userId) return;

    const previousProfile = profiles.find(
      (profile) => profile.user_id === userId,
    );
    if (!previousProfile) return;

    const optimisticProfile = normalizeAdminProfile({
      ...previousProfile,
      membership_status: status,
      membership_updated_at: new Date().toISOString(),
    });

    setMembershipSaveError(null);
    setSavingMembershipUserId(userId);
    setProfiles((current) =>
      current.map((profile) =>
        profile.user_id === userId ? optimisticProfile : profile,
      ),
    );

    try {
      const response = await fetch("/api/admin/profiles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        profile?: AdminProfile;
      } | null;

      if (response.status === 401) {
        setAuthenticated(false);
        setProfiles([]);
        setProfilesLoaded(false);
        setSelectedProfileId(null);
        return;
      }

      if (!response.ok || !data?.profile) {
        throw new Error(data?.error ?? "membership-save-failed");
      }

      setProfiles((current) =>
        current.map((profile) =>
          profile.user_id === userId ? data.profile! : profile,
        ),
      );
    } catch {
      setProfiles((current) =>
        current.map((profile) =>
          profile.user_id === userId ? previousProfile : profile,
        ),
      );
      setMembershipSaveError("멤버십 상태를 저장하지 못했습니다.");
    } finally {
      setSavingMembershipUserId(null);
    }
  };

  const saveProfileDetails = async (
    userId: string,
    patch: ProfileDetailPatch,
  ) => {
    if (savingProfileUserId === userId) return;

    setProfileSaveError(null);
    setProfileSaveNotice(null);
    setSavingProfileUserId(userId);

    try {
      const response = await fetch("/api/admin/profiles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...patch }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        profile?: AdminProfile;
      } | null;

      if (response.status === 401) {
        setAuthenticated(false);
        setProfiles([]);
        setProfilesLoaded(false);
        setSelectedProfileId(null);
        return;
      }

      if (!response.ok || !data?.profile) {
        throw new Error(data?.error ?? "profile-save-failed");
      }

      setProfiles((current) =>
        current.map((profile) =>
          profile.user_id === userId ? data.profile! : profile,
        ),
      );
      setProfileSaveNotice("프로필 상세 정보를 저장했어요.");
    } catch (error) {
      setProfileSaveError(
        error instanceof Error
          ? error.message
          : "프로필 상세 정보를 저장하지 못했어요.",
      );
    } finally {
      setSavingProfileUserId(null);
    }
  };

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    const baseProfiles = profiles.filter((profile) => {
      return viewMode === "dropoffs"
        ? isDropoffProfile(profile)
        : !isDropoffProfile(profile);
    });

    if (viewMode === "dropoffs") {
      return baseProfiles;
    }

    return baseProfiles.filter((profile) => {
      const matchesSearch =
        query.length === 0 ||
        `${profile.name ?? ""} ${profile.phone ?? ""} ${adminProfileArchetypeLabel(profile)}`
          .toLowerCase()
          .includes(query);
      const matchesGender =
        genderFilter === "all" || profile.gender === genderFilter;
      const matchesMembership =
        membershipFilter === "all" ||
        (membershipFilter === "active"
          ? Boolean(profile.active_membership)
          : !profile.active_membership);
      const completed =
        Boolean(profile.profile_completed) && Boolean(profile.questions_completed);
      const matchesCompletion =
        completionFilter === "all" ||
        (completionFilter === "complete" ? completed : !completed);

      return (
        matchesSearch &&
        matchesGender &&
        matchesMembership &&
        matchesCompletion
      );
    });
  }, [
    completionFilter,
    genderFilter,
    membershipFilter,
    profiles,
    search,
    viewMode,
  ]);

  const rosterProfileCount = useMemo(
    () => profiles.filter((profile) => !isDropoffProfile(profile)).length,
    [profiles],
  );
  const dropoffProfileCount = profiles.length - rosterProfileCount;

  useEffect(() => {
    if (filteredProfiles.length === 0) {
      setSelectedProfileId(null);
      return;
    }

    if (
      selectedProfileId &&
      filteredProfiles.some((profile) => profile.user_id === selectedProfileId)
    ) {
      return;
    }

    setSelectedProfileId(filteredProfiles[0].user_id);
  }, [filteredProfiles, selectedProfileId]);

  const selectedProfile =
    profiles.find((profile) => profile.user_id === selectedProfileId) ?? null;

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setAuthError(data?.error ?? "관리자 키가 올바르지 않습니다.");
        return;
      }

      setAccessKey("");
      setAuthenticated(true);
      setActiveTab("applicants");
      setVisitedTabs({ applicants: true });
    } catch {
      setAuthError("관리자 인증 중 오류가 발생했습니다.");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => null);
    setAuthenticated(false);
    setProfiles([]);
    setProfilesLoaded(false);
    setSelectedProfileId(null);
    setActiveTab("applicants");
    setVisitedTabs({ applicants: true });
    setAssignmentCriteriaOpen(false);
  };

  if (!authenticated) {
    return (
      <main className="min-h-dvh bg-[#f7f7f5] px-6 py-10 text-black">
        <section className="mx-auto mt-[12vh] w-full max-w-[420px] rounded-2xl border border-black/10 bg-white p-7 shadow-[0_20px_70px_rgba(0,0,0,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            admin
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            관리자 키를 입력해주세요
          </h1>
          <p className="mt-2 text-sm leading-6 text-black/55">
            전화번호와 신청자 정보가 포함된 페이지입니다. 관리자 인증 후
            브라우저 세션 동안 접근이 유지됩니다.
          </p>

          <form onSubmit={handleLogin} className="mt-7 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-black/55">
                관리자 키
              </span>
              <input
                type="password"
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value)}
                placeholder="ADMIN_ACCESS_KEY"
                className="mt-2 h-12 w-full rounded-xl border border-black/12 bg-white px-4 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
              />
            </label>

            {authError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading || accessKey.trim().length === 0}
              className="h-12 w-full rounded-xl bg-black text-sm font-bold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/30"
            >
              {authLoading ? "확인 중..." : "관리자 페이지 열기"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f7f7f5] text-black">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1480px] flex-col px-7 py-6">
        <header className="shrink-0 rounded-2xl border border-black/10 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                intersection admin
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">
                  운영 관리자
                </h1>
                <button
                  type="button"
                  onClick={() => setAssignmentCriteriaOpen(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-[#f7f7f5] px-3 text-xs font-bold text-black/60 transition hover:border-accent/40 hover:bg-accent/10 hover:text-black"
                >
                  <BookOpen size={15} aria-hidden />
                  유형 배정 기준
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={logout}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black"
              >
                <LogOut size={16} aria-hidden />
                로그아웃
              </button>
            </div>
          </div>

          <nav className="mt-5 flex flex-wrap gap-2">
            {adminTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                className={cn(
                  "h-10 rounded-xl px-4 text-sm font-semibold transition",
                  activeTab === tab.id
                    ? "bg-black text-white"
                    : "bg-[#f7f7f5] text-black/55 hover:bg-accent/15 hover:text-black",
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        <section className="mt-5 min-h-0 flex-1">
          {visitedTabs.applicants && (
            <div className={cn(activeTab === "applicants" ? "block" : "hidden")}>
              <ApplicantsPanel
                profiles={filteredProfiles}
                totalCount={profiles.length}
                namedCount={rosterProfileCount}
                dropoffCount={dropoffProfileCount}
                selectedProfile={selectedProfile}
                selectedProfileId={selectedProfileId}
                viewMode={viewMode}
                loading={profilesLoading}
                error={profilesError}
                search={search}
                genderFilter={genderFilter}
                membershipFilter={membershipFilter}
                completionFilter={completionFilter}
                membershipSaveError={membershipSaveError}
                savingMembershipUserId={savingMembershipUserId}
                savingProfileUserId={savingProfileUserId}
                profileSaveError={profileSaveError}
                profileSaveNotice={profileSaveNotice}
                onViewModeChange={setViewMode}
                onSearchChange={setSearch}
                onGenderFilterChange={setGenderFilter}
                onMembershipFilterChange={setMembershipFilter}
                onCompletionFilterChange={setCompletionFilter}
                onSelectProfile={setSelectedProfileId}
                onCloseDetail={() => setSelectedProfileId(null)}
                onReload={() => void loadProfiles(true)}
                onAnswersDownload={() => downloadApplicantAnswersTsv(profiles)}
                onMembershipStatusChange={changeMembershipStatus}
                onProfileDetailSave={saveProfileDetails}
              />
            </div>
          )}
          {visitedTabs.membership && (
            <div className={cn(activeTab === "membership" ? "block" : "hidden")}>
              <MembershipAdminPanel />
            </div>
          )}
          {visitedTabs.visitors && (
            <div className={cn(activeTab === "visitors" ? "block" : "hidden")}>
              <VisitorAdminPanel />
            </div>
          )}
          {visitedTabs.tickets && (
            <div className={cn(activeTab === "tickets" ? "block" : "hidden")}>
              <TicketAdminPanel
                focusTicketId={ticketFocusId}
                onFocusTicketHandled={() => setTicketFocusId(null)}
              />
            </div>
          )}
          {visitedTabs.events && (
            <div className={cn(activeTab === "events" ? "block" : "hidden")}>
              <MeetingEventAdminPanel onOpenWaitlist={() => setActiveTab("waitlist")} />
            </div>
          )}
          {visitedTabs.calendar && (
            <div className={cn(activeTab === "calendar" ? "block" : "hidden")}>
              <CalendarAdminPanel onOpenTicket={openTicketFromCalendar} />
            </div>
          )}
          {visitedTabs.waitlist && (
            <div className={cn(activeTab === "waitlist" ? "block" : "hidden")}>
              <WaitlistAdminPanel />
            </div>
          )}
          {activeTab === "rooms" && (
            <RoomChatAdminPanel />
          )}
          {visitedTabs.feedback && (
            <div className={cn(activeTab === "feedback" ? "block" : "hidden")}>
              <FeedbackAdminPanel />
            </div>
          )}
          {visitedTabs.blindDates && (
            <div className={cn(activeTab === "blindDates" ? "block" : "hidden")}>
              <BlindDateAdminPanel />
            </div>
          )}
          {visitedTabs.funnel && (
            <div className={cn(activeTab === "funnel" ? "block" : "hidden")}>
              <FunnelAdminPanel />
            </div>
          )}
        </section>
      </div>
      {assignmentCriteriaOpen && (
        <AssignmentCriteriaDialog
          onClose={() => setAssignmentCriteriaOpen(false)}
        />
      )}
    </main>
  );
}

function ApplicantsPanel({
  profiles,
  totalCount,
  namedCount,
  dropoffCount,
  selectedProfile,
  selectedProfileId,
  viewMode,
  loading,
  error,
  search,
  genderFilter,
  membershipFilter,
  completionFilter,
  membershipSaveError,
  savingMembershipUserId,
  savingProfileUserId,
  profileSaveError,
  profileSaveNotice,
  onViewModeChange,
  onSearchChange,
  onGenderFilterChange,
  onMembershipFilterChange,
  onCompletionFilterChange,
  onSelectProfile,
  onCloseDetail,
  onReload,
  onAnswersDownload,
  onMembershipStatusChange,
  onProfileDetailSave,
}: {
  profiles: AdminProfile[];
  totalCount: number;
  namedCount: number;
  dropoffCount: number;
  selectedProfile: AdminProfile | null;
  selectedProfileId: string | null;
  viewMode: ViewMode;
  loading: boolean;
  error: string | null;
  search: string;
  genderFilter: string;
  membershipFilter: MembershipFilter;
  completionFilter: CompletionFilter;
  membershipSaveError: string | null;
  savingMembershipUserId: string | null;
  savingProfileUserId: string | null;
  profileSaveError: string | null;
  profileSaveNotice: string | null;
  onViewModeChange: (mode: ViewMode) => void;
  onSearchChange: (value: string) => void;
  onGenderFilterChange: (value: string) => void;
  onMembershipFilterChange: (value: MembershipFilter) => void;
  onCompletionFilterChange: (value: CompletionFilter) => void;
  onSelectProfile: (profileId: string) => void;
  onCloseDetail: () => void;
  onReload: () => void;
  onAnswersDownload: () => void;
  onMembershipStatusChange: (
    userId: string,
    status: MembershipStatus,
  ) => Promise<void>;
  onProfileDetailSave: (
    userId: string,
    patch: ProfileDetailPatch,
  ) => Promise<void>;
}) {
  return (
    <div className="grid h-[calc(100dvh-190px)] min-h-[620px] grid-cols-[minmax(0,1fr)_390px] gap-5">
      <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="shrink-0 border-b border-black/10 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">신청자 관리</h2>
              <p className="mt-1 text-xs text-black/45">
                전체 {totalCount.toLocaleString()}명 · 명단{" "}
                {namedCount.toLocaleString()}명 · 이탈자{" "}
                {dropoffCount.toLocaleString()}명 · 표시{" "}
                {profiles.length.toLocaleString()}명
              </p>
              {loading && totalCount > 0 && (
                <p className="mt-1 text-[11px] font-semibold text-accent">
                  새로고침 중입니다.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAnswersDownload}
                disabled={totalCount === 0}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 text-sm font-semibold text-black/60 transition hover:border-black/20 hover:text-black disabled:cursor-not-allowed disabled:text-black/25"
              >
                <Download size={15} aria-hidden />
                답변 다운로드
              </button>

              <div className="flex rounded-xl bg-[#f2f3f1] p-1">
                <button
                  type="button"
                  onClick={() => onViewModeChange("dropoffs")}
                  className={cn(
                    "h-9 rounded-lg px-4 text-sm font-semibold transition",
                    viewMode === "dropoffs"
                      ? "bg-white text-black shadow-sm"
                      : "text-black/45 hover:text-black",
                  )}
                >
                  이탈자 보기
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange("list")}
                  className={cn(
                    "h-9 rounded-lg px-4 text-sm font-semibold transition",
                    viewMode === "list"
                      ? "bg-white text-black shadow-sm"
                      : "text-black/45 hover:text-black",
                  )}
                >
                  리스트 보기
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange("cards")}
                  className={cn(
                    "h-9 rounded-lg px-4 text-sm font-semibold transition",
                    viewMode === "cards"
                      ? "bg-white text-black shadow-sm"
                      : "text-black/45 hover:text-black",
                  )}
                >
                  카드 보기
                </button>
              </div>
            </div>
          </div>

          {viewMode === "dropoffs" ? (
            <div className="mt-4 grid grid-cols-[minmax(260px,1fr)_auto] gap-2">
              <p className="flex h-10 items-center rounded-xl border border-black/10 bg-[#fbfbfa] px-4 text-sm font-semibold text-black/50">
                사진 제출 또는 유형 타입 배정을 완료하지 않은 사용자를 표시합니다.
              </p>
              <button
                type="button"
                onClick={onReload}
                className="h-10 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black"
              >
                새로고침
              </button>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-[minmax(260px,1fr)_150px_160px_170px_auto] gap-2">
              <label className="relative block">
                <Search
                  size={16}
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35"
                />
                <input
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="이름 또는 전화번호 검색"
                  className="h-10 w-full rounded-xl border border-black/10 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
                />
              </label>

              <select
                value={genderFilter}
                onChange={(event) => onGenderFilterChange(event.target.value)}
                className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent"
              >
                <option value="all">성별 전체</option>
                <option value="여성">여성</option>
                <option value="남성">남성</option>
                <option value="비공개">비공개</option>
              </select>

              <select
                value={membershipFilter}
                onChange={(event) =>
                  onMembershipFilterChange(event.target.value as MembershipFilter)
                }
                className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent"
              >
                <option value="all">멤버십 전체</option>
                <option value="active">멤버십 보유</option>
                <option value="inactive">멤버십 없음</option>
              </select>

              <select
                value={completionFilter}
                onChange={(event) =>
                  onCompletionFilterChange(event.target.value as CompletionFilter)
                }
                className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent"
              >
                <option value="all">완성 여부 전체</option>
                <option value="complete">프로필 완성</option>
                <option value="incomplete">미완성 포함</option>
              </select>

              <button
                type="button"
                onClick={onReload}
                className="h-10 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black"
              >
                새로고침
              </button>
            </div>
          )}

          {membershipSaveError && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
              {membershipSaveError}
            </p>
          )}
          {error && totalCount > 0 && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {loading && profiles.length === 0 ? (
            <StateMessage message="신청자 목록을 불러오는 중입니다." />
          ) : error && profiles.length === 0 ? (
            <StateMessage tone="error" message={error} />
          ) : profiles.length === 0 ? (
            <StateMessage
              message={
                viewMode === "dropoffs"
                  ? "이탈자가 없습니다."
                  : "아직 신청자가 없습니다."
              }
            />
          ) : viewMode === "cards" ? (
            <ApplicantCards
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              onSelectProfile={onSelectProfile}
            />
          ) : (
            <ApplicantTable
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              onSelectProfile={onSelectProfile}
              savingMembershipUserId={savingMembershipUserId}
              onMembershipStatusChange={onMembershipStatusChange}
            />
          )}
        </div>
      </section>

      <ProfileDetailPanel
        profile={selectedProfile}
        saving={
          selectedProfile !== null &&
          savingMembershipUserId === selectedProfile.user_id
        }
        profileSaving={
          selectedProfile !== null &&
          savingProfileUserId === selectedProfile.user_id
        }
        saveError={profileSaveError}
        saveNotice={profileSaveNotice}
        onClose={onCloseDetail}
        onMembershipStatusChange={onMembershipStatusChange}
        onProfileDetailSave={onProfileDetailSave}
      />
    </div>
  );
}

function ApplicantTable({
  profiles,
  selectedProfileId,
  onSelectProfile,
  savingMembershipUserId,
  onMembershipStatusChange,
}: {
  profiles: AdminProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string) => void;
  savingMembershipUserId: string | null;
  onMembershipStatusChange: (
    userId: string,
    status: MembershipStatus,
  ) => Promise<void>;
}) {
  return (
    <div className="h-full overflow-auto">
      <table className="min-w-[1080px] w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="sticky top-0 z-10 bg-[#f8f8f6] text-xs font-bold uppercase tracking-wide text-black/45">
          <tr>
            <TableHead className="w-[120px] px-3">이름</TableHead>
            <TableHead className="w-20 px-3">성별</TableHead>
            <TableHead className="w-24">출생연도</TableHead>
            <TableHead className="w-20">MBTI</TableHead>
            <TableHead className="w-36">성향 유형</TableHead>
            <TableHead className="w-32">전화번호</TableHead>
            <TableHead className="w-28">가입일</TableHead>
            <TableHead className="w-44">멤버십 상태</TableHead>
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => {
            const selected = selectedProfileId === profile.user_id;

            return (
              <tr
                key={profile.user_id}
                onClick={() => onSelectProfile(profile.user_id)}
                className={cn(
                  "cursor-pointer border-b border-black/5 transition hover:bg-accent/10",
                  selected && "bg-accent/15",
                )}
              >
                <TableCell className="w-[120px] px-3">
                  <span className="block min-w-0 font-bold text-black">
                    <AdminMemberName profile={profile} />
                  </span>
                </TableCell>
                <TableCell className="w-20 px-3">
                  {display(profile.gender)}
                </TableCell>
                <TableCell>{display(profile.birth_year)}</TableCell>
                <TableCell>{display(profile.mbti)}</TableCell>
                <TableCell className="w-36">
                  <span className="block truncate font-bold text-black/70">
                    {adminProfileArchetypeLabel(profile)}
                  </span>
                </TableCell>
                <TableCell>{formatPhoneCompact(profile.phone)}</TableCell>
                <TableCell>{formatCreatedAtCompact(profile.created_at)}</TableCell>
                <TableCell className="w-44">
                  <MembershipStatusSelect
                    value={membershipStatusValue(profile)}
                    disabled={savingMembershipUserId === profile.user_id}
                    onChange={(status) =>
                      void onMembershipStatusChange(profile.user_id, status)
                    }
                    onClick={(event) => event.stopPropagation()}
                  />
                </TableCell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ApplicantCards({
  profiles,
  selectedProfileId,
  onSelectProfile,
}: {
  profiles: AdminProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string) => void;
}) {
  return (
    <div className="h-full overflow-auto p-5">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {profiles.map((profile) => {
          const selected = selectedProfileId === profile.user_id;

          return (
            <button
              key={profile.user_id}
              type="button"
              onClick={() => onSelectProfile(profile.user_id)}
              className={cn(
                "overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/70 hover:shadow-md",
                selected ? "border-accent ring-4 ring-accent/15" : "border-black/10",
              )}
            >
              <PhotoBox
                src={profile.photo_url}
                alt={`${profile.name ?? "신청자"} 프로필 사진`}
                className="h-64 w-full bg-[#f7f7f5]"
              />
              <div className="space-y-2 p-4">
                <h3 className="truncate text-base font-bold">
                  <AdminMemberName profile={profile} />
                </h3>
                <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-black/55">
                  <span>{formatAgeAndBirthYear(profile)}</span>
                  <GenderBadge gender={profile.gender} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-black/50">
                  <InfoPill label="MBTI" value={display(profile.mbti)} />
                  <InfoPill
                    label="성향 유형"
                    value={adminProfileArchetypeLabel(profile)}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProfileDetailPanel({
  profile,
  saving,
  profileSaving,
  saveError,
  saveNotice,
  onClose,
  onMembershipStatusChange,
  onProfileDetailSave,
}: {
  profile: AdminProfile | null;
  saving: boolean;
  profileSaving: boolean;
  saveError: string | null;
  saveNotice: string | null;
  onClose: () => void;
  onMembershipStatusChange: (
    userId: string,
    status: MembershipStatus,
  ) => Promise<void>;
  onProfileDetailSave: (
    userId: string,
    patch: ProfileDetailPatch,
  ) => Promise<void>;
}) {
  const initialPrecisionBonusDraft = useMemo(
    () => adminMatchingPrecisionBonus(profile),
    [profile],
  );
  const [precisionBonusDraft, setPrecisionBonusDraft] = useState(
    initialPrecisionBonusDraft,
  );

  useEffect(() => {
    setPrecisionBonusDraft(initialPrecisionBonusDraft);
  }, [initialPrecisionBonusDraft]);

  const precisionBonusDirty = Boolean(
    profile &&
      precisionBonusDraft !== adminMatchingPrecisionBonus(profile),
  );
  const isTestParticipant = Boolean(profile?.is_test_participant);
  const detailNickname = profile?.nickname?.trim();

  const savePrecisionBonus = () => {
    if (!profile || !precisionBonusDirty || profileSaving) return;
    void onProfileDetailSave(profile.user_id, {
      matchingPrecisionBonus: precisionBonusDraft,
    });
  };

  const toggleTestParticipant = () => {
    if (!profile || profileSaving) return;
    void onProfileDetailSave(profile.user_id, {
      isTestParticipant: !isTestParticipant,
    });
  };

  if (!profile) {
    return (
      <aside className="flex min-h-0 flex-col items-center justify-center rounded-2xl border border-dashed border-black/15 bg-white px-6 text-center text-sm font-semibold text-black/45">
        <UserRound size={32} aria-hidden className="mb-3 text-black/25" />
        신청자를 선택하면 상세 정보가 표시됩니다.
      </aside>
    );
  }

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
            applicant detail
          </p>
          <h2 className="mt-1 text-xl font-bold">
            <AdminMemberName profile={profile} />
            {detailNickname && (
              <span className="ml-1 font-bold text-black/55">
                ({detailNickname})
              </span>
            )}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="상세패널 닫기"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-black/45 transition hover:border-black/20 hover:text-black"
        >
          <X size={16} aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <PhotoBox
          src={profile.photo_url}
          alt={`${profile.name ?? "신청자"} 프로필 사진`}
          className="h-[360px] w-full rounded-2xl border border-black/10 bg-[#f7f7f5]"
        />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <DetailItem label="성별" value={display(profile.gender)} />
          <DetailItem label="출생연도" value={display(profile.birth_year)} />
          <DetailItem label="MBTI" value={display(profile.mbti)} />
          <DetailItem
            label="성향 유형"
            value={adminProfileArchetypeLabel(profile)}
          />
          <DetailItem label="전화번호" value={display(profile.phone)} />
          <DetailItem label="가입일" value={formatCreatedAt(profile.created_at)} />
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-black/35">
              멤버십 상태
            </p>
            <MembershipStatusSelect
              value={membershipStatusValue(profile)}
              disabled={saving}
              className="mt-2 w-full"
              onChange={(status) =>
                void onMembershipStatusChange(profile.user_id, status)
              }
            />
          </div>
          <DetailItem
            label="기본정보 완료"
            value={completionText(profile.profile_completed)}
          />
          <DetailItem
            label="질문 완료"
            value={completionText(profile.questions_completed)}
          />
        </div>

        <section className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold">운영자</h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-black/45">
                켜진 신청자에게만 운영자 전용 티켓과 질문 다시보기가 표시됩니다.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isTestParticipant}
              disabled={profileSaving}
              onClick={toggleTestParticipant}
              className={cn(
                "relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-45",
                isTestParticipant ? "bg-black" : "bg-black/15",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition",
                  isTestParticipant ? "left-7" : "left-1",
                )}
              />
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">추천 정교화 보정값</h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-black/45">
                실제 참여 완료 횟수에 더해지는 값이에요. 별은 최대 5칸까지
                채워져요.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
              +{precisionBonusDraft}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }, (_, value) => (
              <button
                key={value}
                type="button"
                disabled={profileSaving}
                aria-pressed={precisionBonusDraft === value}
                onClick={() => setPrecisionBonusDraft(value)}
                className={cn(
                  "h-10 rounded-xl border text-sm font-black transition disabled:cursor-wait disabled:opacity-45",
                  precisionBonusDraft === value
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-[#f7f7f5] text-black/50 hover:border-black/20 hover:text-black",
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!precisionBonusDirty || profileSaving}
            onClick={savePrecisionBonus}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-bold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/25"
          >
            <Save size={15} aria-hidden />
            {profileSaving ? "저장 중..." : "보정값 저장"}
          </button>
        </section>

        <ProfileAnswersSection profile={profile} />

        {(saveError || saveNotice) && (
          <p
            className={cn(
              "mt-4 rounded-2xl px-4 py-3 text-sm font-semibold leading-5",
              saveError
                ? "bg-red-50 text-red-600"
                : "bg-accent/12 text-black/65",
            )}
          >
            {saveError ?? saveNotice}
          </p>
        )}
      </div>

      <footer className="shrink-0 border-t border-black/10 p-4">
        <button
          type="button"
          onClick={onClose}
          className="h-11 w-full rounded-xl bg-black text-sm font-bold text-white transition hover:bg-black/85"
        >
          닫기
        </button>
      </footer>
    </aside>
  );
}

function PhotoBox({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className: string;
}) {
  return (
    <div className={cn("flex items-center justify-center overflow-hidden", className)}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-contain" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-xs font-semibold text-black/35">
          <ImageIcon size={28} aria-hidden />
          사진 없음
        </div>
      )}
    </div>
  );
}

function MembershipStatusSelect({
  value,
  disabled,
  className,
  onChange,
  onClick,
}: {
  value: MembershipStatus;
  disabled: boolean;
  className?: string;
  onChange: (status: MembershipStatus) => void;
  onClick?: (event: React.MouseEvent<HTMLSelectElement>) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onClick={onClick}
      onChange={(event) => onChange(event.target.value as MembershipStatus)}
      className={cn(
        "h-10 w-40 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/72 outline-none transition focus:border-accent disabled:cursor-wait disabled:bg-black/5",
        className,
      )}
    >
      {applicantMembershipStatuses.map((status) => (
        <option key={status} value={status}>
          {membershipStatusLabels[status]}
        </option>
      ))}
    </select>
  );
}

function TableHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={cn("border-b border-black/10 px-5 py-3 font-bold", className)}>
      {children}
    </th>
  );
}

function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("border-b border-black/5 px-5 py-3 text-black/62", className)}>
      {children}
    </td>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#f7f7f5] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-black/35">
        {label}
      </p>
      <p className="mt-1 truncate font-semibold text-black/65">{value}</p>
    </div>
  );
}

function ProfileAnswersSection({ profile }: { profile: AdminProfile }) {
  const answers = profile.answers ?? [];
  const questions = questionsForProfile(profile);
  const sortedAnswers = [...answers].sort(
    (left, right) => left.question_order - right.question_order,
  );
  const additionalAnswerCount = answers.filter((answer) => {
    const question = questionForAnswer(answer, questions);
    return Boolean(
      (question && isAdditionalQuestion(question)) ||
        parseTicketRatingAnswer(answer.answer_text),
    );
  }).length;

  return (
    <section className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">신청자 답변</h3>
        <span className="text-[11px] font-semibold text-black/35">
          총 {sortedAnswers.length}개
          {additionalAnswerCount > 0 ? ` · 추가 질문 ${additionalAnswerCount}개` : ""}
        </span>
      </div>

      {sortedAnswers.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-black/10 bg-[#fbfbfa] px-4 py-6 text-center text-xs font-semibold leading-5 text-black/40">
          아직 저장된 신청자 답변이 없습니다.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {sortedAnswers.map((answer) => (
            <ProfileAnswerCard
              key={`${answer.question_order}-${answer.updated_at ?? ""}`}
              answer={answer}
              question={questionForAnswer(answer, questions)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProfileAnswerCard({
  answer,
  question,
}: {
  answer: AdminProfileAnswer;
  question?: ProfileQuestion;
}) {
  const ticketRating = parseTicketRatingAnswer(answer.answer_text);
  if (ticketRating) {
    return (
      <article className="rounded-2xl border border-black/8 bg-[#fbfbfa] px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-accent">
          추가 질문 · 티켓 선호 · 1~5점 척도
        </p>
        <p className="mt-2 whitespace-pre-line text-sm font-bold leading-6 text-black/76">
          &ldquo;{ticketRating.title}&rdquo; 모임에 얼마나 참여하고 싶나요?
        </p>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-black/6 bg-white px-3 py-2 text-[10px] font-semibold leading-4 text-black/45">
          <span>1 · 별로 끌리지 않아요</span>
          <span className="shrink-0 text-black/25">↔</span>
          <span className="text-right">5 · 너무 좋아요</span>
        </div>
        <p className="mt-2 rounded-xl bg-white px-3 py-2.5 text-xs font-black text-black/64">
          {ticketRating.rating}점 / 5점
        </p>
      </article>
    );
  }

  if (!question) {
    return (
      <article className="rounded-2xl border border-black/8 bg-[#fbfbfa] px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-black/35">
          저장된 질문 · 문항 {answer.question_order}
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-black/70">
          {answerText(answer) || "-"}
        </p>
      </article>
    );
  }

  if (question.type === "text") {
    const additional = isAdditionalQuestion(question);
    return (
      <article className="rounded-2xl border border-black/8 bg-[#fbfbfa] px-4 py-3">
        <p
          className={cn(
            "text-[11px] font-black uppercase tracking-[0.12em]",
            additional ? "text-accent" : "text-black/35",
          )}
        >
          {additional ? "추가 질문 · " : ""}
          {question.category} · 주관식
        </p>
        <p className="mt-2 whitespace-pre-line text-sm font-bold leading-6 text-black/78">
          {question.question}
        </p>
        <p className="mt-3 whitespace-pre-line rounded-xl bg-white px-3 py-3 text-xs font-semibold leading-5 text-black/62">
          {answerText(answer) || "-"}
        </p>
      </article>
    );
  }

  const values = selectedValues(answer);
  const additional = isAdditionalQuestion(question);
  const scaleMeta = questionScaleMeta(question);

  return (
    <article className="rounded-2xl border border-black/8 bg-[#fbfbfa] px-4 py-3">
      <p
        className={cn(
          "text-[11px] font-black uppercase tracking-[0.12em]",
          additional ? "text-accent" : "text-black/35",
        )}
      >
        {additional ? "추가 질문 · " : ""}
        {question.category} · {scaleMeta ? `${scaleMeta.min}~${scaleMeta.max}점 척도` : answerTypeLabel(question)}
      </p>
      <p className="mt-2 whitespace-pre-line text-sm font-bold leading-6 text-black/78">
        {question.question}
      </p>
      {scaleMeta && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-black/6 bg-white px-3 py-2 text-[10px] font-semibold leading-4 text-black/45">
          <span>
            {scaleMeta.min} · {scaleMeta.minLabel}
          </span>
          <span className="shrink-0 text-black/25">↔</span>
          <span className="text-right">
            {scaleMeta.max} · {scaleMeta.maxLabel}
          </span>
        </div>
      )}
      <div className="mt-3 space-y-2">
        {values.length > 0 ? (
          values.map((value, index) => {
            const displayText =
              scaleMeta && /^\d+$/.test(value)
                ? `${value}점 / ${scaleMeta.max}점`
                : selectedOptionDisplay(question, value, answer.other_text);
            const rankedDisplayText =
              question.category === "관심 분야"
                ? `${index + 1}순위. ${displayText.replace(/^\d+번\.\s*/, "")}`
                : displayText;

            return (
              <p
                key={value}
                className="rounded-xl bg-white px-3 py-2.5 text-xs font-semibold leading-5 text-black/64"
              >
                {rankedDisplayText}
              </p>
            );
          })
        ) : (
          <p className="rounded-xl bg-white px-3 py-2.5 text-xs font-semibold leading-5 text-black/40">
            -
          </p>
        )}
      </div>
    </article>
  );
}

function DetailItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-black/35">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 break-words text-sm font-semibold",
          highlight ? "text-accent" : "text-black/72",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StateMessage({
  message,
  tone = "default",
}: {
  message: string;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={cn(
        "flex h-full items-center justify-center text-sm font-semibold",
        tone === "error" ? "text-red-600" : "text-black/45",
      )}
    >
      {message}
    </div>
  );
}
