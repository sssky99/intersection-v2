"use client";
import { profileAdditionalQuestions } from "@/data/profileDetailQuestions";
import { AdminMemberName } from "@/features/admin/adminDisplay";
import {
  type AdminProfile,
  type AdminProfileAnswer,
} from "@/features/admin/adminProfile";
import { type RedFlagManualFlags } from "@/features/admin/redFlags";
import {
  membershipStatusLabels,
  type MembershipStatus,
} from "@/features/membership/membershipTypes";
import { parseTicketRatingAnswer } from "@/features/onboarding/ticketRating";
import type { ProfileQuestion } from "@/types/question";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  Image as ImageIcon,
  Save,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  OperatorRatingControl,
  RedFlagAssessmentDialog,
  RedFlagScoreButton,
} from "./ProfileAssessment";
import {
  adminProfileArchetypeLabel,
  answerDisplayForExport,
  answerText,
  completionText,
  formatCreatedAt,
  membershipStatusValue,
  optionMeta,
  questionForOrder,
  questionOrder,
  questionsForProfile,
  selectedOptionDisplay,
  selectedValues,
} from "./ProfileExport";

export const applicantMembershipStatuses: MembershipStatus[] = [
  "none",
  "pending",
  "active",
  "expired",
  "cancelled",
];

export function display(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

export const additionalQuestionOrders = new Set(
  profileAdditionalQuestions.map(questionOrder),
);

export function isAdditionalQuestion(question: ProfileQuestion) {
  return additionalQuestionOrders.has(questionOrder(question));
}

export function questionScaleMeta(question: ProfileQuestion) {
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

export function answerTypeLabel(question: ProfileQuestion) {
  if (question.type === "text") return "주관식";
  if (question.type === "multi_choice") return "복수 선택";
  return "단일 선택";
}

export function questionForAnswer(
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

export type ProfileDetailPatch = {
  isTestParticipant?: boolean;
  matchingPrecisionBonus?: number;
  operatorRating?: number | null;
  redFlagManualFlags?: RedFlagManualFlags;
  redFlagManualAdjustment?: number;
  redFlagManualNoShowCount?: number;
  redFlagManualSameDayCancellationCount?: number;
};

export function clampMatchingPrecisionBonus(value: number) {
  return Math.min(5, Math.max(0, Math.round(value)));
}

export function adminMatchingPrecisionBonus(profile: AdminProfile | null) {
  const value = profile?.matching_precision_bonus;
  return typeof value === "number" && Number.isFinite(value)
    ? clampMatchingPrecisionBonus(value)
    : 0;
}

export function ProfileDetailPanel({
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
  ) => Promise<boolean>;
}) {
  const initialPrecisionBonusDraft = useMemo(
    () => adminMatchingPrecisionBonus(profile),
    [profile],
  );
  const [precisionBonusDraft, setPrecisionBonusDraft] = useState(
    initialPrecisionBonusDraft,
  );
  const [openingUserView, setOpeningUserView] = useState(false);
  const [userViewError, setUserViewError] = useState<string | null>(null);
  const [redFlagAssessmentOpen, setRedFlagAssessmentOpen] = useState(false);

  useEffect(() => {
    setPrecisionBonusDraft(initialPrecisionBonusDraft);
  }, [initialPrecisionBonusDraft]);

  const precisionBonusDirty = Boolean(
    profile && precisionBonusDraft !== adminMatchingPrecisionBonus(profile),
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

  const openUserView = async () => {
    if (!profile || openingUserView) return;
    setOpeningUserView(true);
    setUserViewError(null);
    const response = await fetch("/api/admin/user-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profile.user_id }),
    }).catch(() => null);
    const data = response
      ? ((await response.json().catch(() => null)) as { error?: string } | null)
      : null;
    if (!response?.ok) {
      setUserViewError(data?.error ?? "사용자 화면을 열지 못했습니다.");
      setOpeningUserView(false);
      return;
    }
    window.location.assign("/admin/user-view");
  };

  if (!profile) {
    return (
      <aside className="flex min-h-0 flex-col items-center justify-center rounded-2xl border border-dashed border-black/15 bg-white px-6 text-center text-sm font-semibold text-black/45">
        <UserRound size={32} aria-hidden className="mb-3 text-black/25" />
        신청자를 선택하면 상세 정보가 표시됩니다.
      </aside>
    );
  }

  if (!profile.details_loaded) {
    return (
      <aside className="flex min-h-0 flex-col items-center justify-center rounded-2xl border border-black/10 bg-white px-6 text-center text-sm font-semibold text-black/45 shadow-sm">
        <UserRound
          size={32}
          aria-hidden
          className="mb-3 animate-pulse text-black/25"
        />
        신청자 상세 정보를 불러오는 중입니다.
      </aside>
    );
  }

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="shrink-0 border-b border-black/10 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
              applicant detail
            </p>
            <h2 className="text-xl font-bold">
              <AdminMemberName
                profile={profile}
                oneTimePaid={profile.one_time_paid}
              />
              {detailNickname && (
                <span className="ml-1 font-bold text-black/55">
                  ({detailNickname})
                </span>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void openUserView()}
              disabled={openingUserView}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-black px-3 text-xs font-bold text-white transition hover:bg-black/80 disabled:opacity-45"
            >
              <Eye size={15} aria-hidden />
              {openingUserView ? "여는 중" : "사용자 화면"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="상세패널 닫기"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-black/45 transition hover:border-black/20 hover:text-black"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <OperatorRatingControl
            value={profile.operator_rating ?? null}
            disabled={profileSaving}
            onChange={(rating) =>
              void onProfileDetailSave(profile.user_id, {
                operatorRating: rating,
              })
            }
          />
          <RedFlagScoreButton
            score={profile.red_flag_score ?? 0}
            onClick={() => setRedFlagAssessmentOpen(true)}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {userViewError && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
            {userViewError}
          </p>
        )}
        <PhotoBox
          src={profile.photo_url}
          alt={`${profile.name ?? "신청자"} 프로필 사진`}
          className="h-[360px] w-full rounded-2xl border border-black/10 bg-[#f7f7f5]"
        />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <DetailItem label="성별" value={display(profile.gender)} />
          <DetailItem label="출생연도" value={display(profile.birth_year)} />
          <DetailItem label="MBTI" value={display(profile.mbti)} />
          <DetailItem label="전화번호" value={display(profile.phone)} />
          <DetailItem
            label="성향 유형"
            value={adminProfileArchetypeLabel(profile)}
          />
          <DetailItem
            label="가입일"
            value={formatCreatedAt(profile.created_at)}
          />
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
          <h3 className="text-sm font-bold">결제 내역</h3>
          {(profile.payment_history ?? []).length === 0 ? (
            <p className="mt-3 text-xs font-semibold text-black/40">
              결제 내역이 없습니다.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {(profile.payment_history ?? []).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-black/[0.035] px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {display(payment.product_code ?? payment.payment_kind)}
                    </p>
                    <p className="mt-0.5 text-black/40">
                      {formatCreatedAt(
                        payment.occurred_at ?? payment.created_at,
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-black tabular-nums">
                      {typeof payment.amount === "number"
                        ? `${payment.amount.toLocaleString()}원`
                        : "-"}
                    </p>
                    <p className="mt-0.5 font-semibold text-black/40">
                      {display(payment.status)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

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

        <ProfileAlgorithmParametersSection profile={profile} />

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
      {redFlagAssessmentOpen && (
        <RedFlagAssessmentDialog
          profile={profile}
          disabled={profileSaving}
          onClose={() => setRedFlagAssessmentOpen(false)}
          onSave={(
            redFlagManualFlags,
            redFlagManualAdjustment,
            redFlagManualNoShowCount,
            redFlagManualSameDayCancellationCount,
          ) =>
            onProfileDetailSave(profile.user_id, {
              redFlagManualFlags,
              redFlagManualAdjustment,
              redFlagManualNoShowCount,
              redFlagManualSameDayCancellationCount,
            })
          }
        />
      )}
    </aside>
  );
}

export function PhotoBox({
  src,
  alt,
  className,
  fit = "contain",
  loading = "lazy",
  thumbnail,
}: {
  src: string | null;
  alt: string;
  className: string;
  fit?: "contain" | "cover";
  loading?: "eager" | "lazy";
  thumbnail?: {
    width: number;
    height: number;
    quality: number;
  };
}) {
  const optimizedSrc = useMemo(() => {
    if (!src || !thumbnail) return src;

    try {
      const url = new URL(src);
      const publicObjectPath = "/storage/v1/object/public/";
      if (!url.pathname.startsWith(publicObjectPath)) return src;

      url.pathname = url.pathname.replace(
        publicObjectPath,
        "/storage/v1/render/image/public/",
      );
      url.searchParams.set("width", String(thumbnail.width));
      url.searchParams.set("height", String(thumbnail.height));
      url.searchParams.set("quality", String(thumbnail.quality));
      url.searchParams.set("resize", "cover");
      return url.toString();
    } catch {
      return src;
    }
  }, [src, thumbnail?.height, thumbnail?.quality, thumbnail?.width]);
  const [displaySrc, setDisplaySrc] = useState(optimizedSrc);

  useEffect(() => {
    setDisplaySrc(optimizedSrc);
  }, [optimizedSrc]);

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      {displaySrc ? (
        <img
          src={displaySrc}
          alt={alt}
          loading={loading}
          decoding="async"
          onError={() => {
            if (src && displaySrc !== src) setDisplaySrc(src);
          }}
          className={cn(
            "h-full w-full",
            fit === "cover" ? "object-cover" : "object-contain",
          )}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 text-xs font-semibold text-black/35">
          <ImageIcon size={28} aria-hidden />
          사진 없음
        </div>
      )}
    </div>
  );
}

export function MembershipStatusSelect({
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

export function ProfileAnswersSection({ profile }: { profile: AdminProfile }) {
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
          {additionalAnswerCount > 0
            ? ` · 추가 질문 ${additionalAnswerCount}개`
            : ""}
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

export function ProfileAlgorithmParametersSection({
  profile,
}: {
  profile: AdminProfile;
}) {
  const parameters = [...(profile.algorithm_parameters ?? [])].sort(
    (left, right) => left.position - right.position,
  );
  const questions = questionsForProfile(profile);
  const answersByOrder = new Map(
    (profile.answers ?? []).map((answer) => [answer.question_order, answer]),
  );

  return (
    <section className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">알고리즘 파라미터</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-black/45">
            사용자가 직접 선택해 서버에 저장한 추천 우선순위입니다.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-black/[0.05] px-3 py-1 text-[11px] font-black text-black/45">
          {parameters.length}/3개
        </span>
      </div>

      {parameters.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-black/10 bg-[#fbfbfa] px-4 py-6 text-center text-xs font-semibold leading-5 text-black/40">
          아직 서버에 저장된 파라미터가 없습니다.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {parameters.map((parameter) => {
            const answer = answersByOrder.get(parameter.question_order);
            const question = answer
              ? questionForAnswer(answer, questions)
              : questionForOrder(parameter.question_order, questions);
            const answerDisplay = answer
              ? answerDisplayForExport(answer, questions)
              : "저장된 답변 없음";
            const similar = parameter.mode === "similar";

            return (
              <article
                key={parameter.question_order}
                className="rounded-2xl border border-black/8 bg-[#fbfbfa] px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      similar
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700",
                    )}
                  >
                    {similar ? (
                      <ArrowUp size={17} aria-hidden />
                    ) : (
                      <ArrowDown size={17} aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-black/35">
                        우선순위 {parameter.position}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-black",
                          similar
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700",
                        )}
                      >
                        {similar ? "비슷한 답변 우선" : "다른 답변 우선"}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm font-bold leading-6 text-black/76">
                      {question?.question ??
                        `저장된 문항 ${parameter.question_order}`}
                    </p>
                    <p className="mt-2 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold leading-5 text-black/58">
                      사용자 답변 · {answerDisplay || "-"}
                    </p>
                    <p className="mt-2 text-[10px] font-semibold text-black/30">
                      저장 시각 · {formatCreatedAt(parameter.updated_at)}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function ProfileAnswerCard({
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
        {question.category} ·{" "}
        {scaleMeta
          ? `${scaleMeta.min}~${scaleMeta.max}점 척도`
          : answerTypeLabel(question)}
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

export function DetailItem({
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

import { cn } from "@/lib/cn";
