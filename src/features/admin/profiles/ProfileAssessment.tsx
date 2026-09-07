"use client";
import {
  profileArchetypeAssignmentGuide,
  profileArchetypeIds,
  profileArchetypeScoreCalibration,
  profileArchetypes,
} from "@/data/profileArchetypes";
import { type AdminProfile } from "@/features/admin/adminProfile";
import {
  redFlagManualRules,
  type RedFlagManualFlags,
} from "@/features/admin/redFlags";
import { Flag, Save, Star, X } from "lucide-react";
import { useEffect, useState } from "react";

export function OperatorRatingControl({
  value,
  disabled,
  onChange,
}: {
  value: number | null;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : value.toFixed(1));

  useEffect(() => {
    setDraft(value === null ? "" : value.toFixed(1));
  }, [value]);

  const parsedDraft = draft.trim() === "" ? null : Number(draft);
  const draftValid =
    parsedDraft === null ||
    (Number.isFinite(parsedDraft) &&
      parsedDraft >= 0.1 &&
      parsedDraft <= 5 &&
      Number.isInteger(parsedDraft * 10));
  const draftDirty =
    draftValid &&
    (parsedDraft === null
      ? value !== null
      : value === null || Math.abs(parsedDraft - value) > 0.001);
  const applyDraft = () => {
    if (!draftDirty || disabled) return;
    onChange(parsedDraft === null ? null : Math.round(parsedDraft * 10) / 10);
  };

  return (
    <div
      className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-amber-200 bg-amber-50/70 px-2 py-1"
      aria-label={
        value === null
          ? "운영자 평점 미평가"
          : `운영자 평점 ${value.toFixed(1)}점`
      }
    >
      <div
        className="flex items-center"
        role="group"
        aria-label="운영자 평점 선택"
      >
        {Array.from({ length: 5 }, (_, index) => {
          const starStart = index;
          const fillPercent = Math.max(
            0,
            Math.min(100, ((value ?? 0) - starStart) * 100),
          );

          return (
            <span key={index} className="relative h-[22px] w-[22px] shrink-0">
              <Star
                size={22}
                strokeWidth={1.8}
                aria-hidden
                className="absolute inset-0 text-black/20"
              />
              <span
                className="pointer-events-none absolute inset-0 overflow-hidden text-amber-500"
                style={{ width: `${fillPercent}%` }}
                aria-hidden
              >
                <Star size={22} strokeWidth={1.8} fill="currentColor" />
              </span>
              {[0.5, 1].map((step) => {
                const rating = index + step;
                return (
                  <button
                    key={step}
                    type="button"
                    disabled={disabled}
                    aria-label={`${rating.toFixed(1)}점${value === rating ? ", 다시 누르면 미평가" : ""}`}
                    onClick={() => {
                      const nextValue = value === rating ? null : rating;
                      setDraft(nextValue === null ? "" : nextValue.toFixed(1));
                      onChange(nextValue);
                    }}
                    className={cn(
                      "absolute inset-y-0 z-10 disabled:cursor-wait",
                      step === 0.5 ? "left-0 w-1/2" : "right-0 w-1/2",
                    )}
                  />
                );
              })}
            </span>
          );
        })}
      </div>
      <label className="ml-1 inline-flex items-center gap-1">
        <span className="sr-only">운영자 평점 직접 입력</span>
        <input
          type="number"
          min="0.1"
          max="5"
          step="0.1"
          inputMode="decimal"
          value={draft}
          disabled={disabled}
          placeholder="3.8"
          aria-invalid={!draftValid}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") applyDraft();
          }}
          className={cn(
            "h-7 w-14 rounded-lg border bg-white px-1.5 text-center text-xs font-black tabular-nums outline-none transition disabled:opacity-45",
            draftValid
              ? "border-amber-200 focus:border-amber-400"
              : "border-red-300 text-red-600",
          )}
        />
      </label>
      {value === 0.5 && (
        <span className="text-xs font-semibold text-black/55">판별 불가</span>
      )}
      <button
        type="button"
        disabled={!draftDirty || disabled}
        onClick={applyDraft}
        className="h-7 rounded-lg bg-amber-600 px-2 text-[11px] font-black text-white transition hover:bg-amber-700 disabled:bg-amber-200"
      >
        적용
      </button>
    </div>
  );
}

export function RedFlagScoreButton({
  score,
  onClick,
}: {
  score: number;
  onClick: () => void;
}) {
  const scoreTone =
    score >= 5
      ? "border-red-200 bg-red-50 text-red-700"
      : score >= 3
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : score > 0
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`레드 플래그 ${score.toFixed(1)}점, 산정 근거 보기`}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-black tabular-nums transition hover:brightness-95",
        scoreTone,
      )}
    >
      <Flag size={14} aria-hidden />
      레드 플래그 {score.toFixed(1)}
    </button>
  );
}

export function RedFlagAssessmentDialog({
  profile,
  disabled,
  onSave,
  onClose,
}: {
  profile: AdminProfile;
  disabled: boolean;
  onSave: (
    flags: RedFlagManualFlags,
    adjustment: number,
    manualNoShowCount: number,
    manualSameDayCancellationCount: number,
  ) => Promise<boolean>;
  onClose: () => void;
}) {
  const savedFlags = profile.red_flag_manual_flags ?? {};
  const savedAdjustment = profile.red_flag_manual_adjustment ?? 0;
  const savedManualNoShowCount = profile.red_flag_manual_no_show_count ?? 0;
  const savedManualSameDayCancellationCount =
    profile.red_flag_manual_same_day_cancellation_count ?? 0;
  const [draft, setDraft] = useState<RedFlagManualFlags>(savedFlags);
  const [adjustmentDraft, setAdjustmentDraft] = useState(
    savedAdjustment.toFixed(1),
  );
  const [manualNoShowCountDraft, setManualNoShowCountDraft] = useState(
    String(savedManualNoShowCount),
  );
  const [
    manualSameDayCancellationCountDraft,
    setManualSameDayCancellationCountDraft,
  ] = useState(String(savedManualSameDayCancellationCount));
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(savedFlags);
    setAdjustmentDraft(savedAdjustment.toFixed(1));
    setManualNoShowCountDraft(String(savedManualNoShowCount));
    setManualSameDayCancellationCountDraft(
      String(savedManualSameDayCancellationCount),
    );
  }, [
    profile.user_id,
    profile.red_flag_reviewed_at,
    savedAdjustment,
    savedManualNoShowCount,
    savedManualSameDayCancellationCount,
  ]);

  const parsedAdjustment = Number(adjustmentDraft);
  const adjustmentValid =
    Number.isFinite(parsedAdjustment) &&
    parsedAdjustment >= -5 &&
    parsedAdjustment <= 5 &&
    Number.isInteger(parsedAdjustment * 2);
  const parsedManualNoShowCount = Number(manualNoShowCountDraft);
  const parsedManualSameDayCancellationCount = Number(
    manualSameDayCancellationCountDraft,
  );
  const manualNoShowCountValid =
    Number.isInteger(parsedManualNoShowCount) &&
    parsedManualNoShowCount >= 0 &&
    parsedManualNoShowCount <= 99;
  const manualSameDayCancellationCountValid =
    Number.isInteger(parsedManualSameDayCancellationCount) &&
    parsedManualSameDayCancellationCount >= 0 &&
    parsedManualSameDayCancellationCount <= 99;

  const dirty =
    redFlagManualRules.some(
      (rule) => Boolean(draft[rule.key]) !== Boolean(savedFlags[rule.key]),
    ) ||
    (adjustmentValid && Math.abs(parsedAdjustment - savedAdjustment) > 0.001) ||
    (manualNoShowCountValid &&
      parsedManualNoShowCount !== savedManualNoShowCount) ||
    (manualSameDayCancellationCountValid &&
      parsedManualSameDayCancellationCount !==
        savedManualSameDayCancellationCount);
  const score = profile.red_flag_score ?? 0;
  const reasons = profile.red_flag_reasons ?? [];
  const saveReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !dirty ||
      !adjustmentValid ||
      !manualNoShowCountValid ||
      !manualSameDayCancellationCountValid ||
      disabled
    ) {
      return;
    }

    setSaveError(null);
    const saved = await onSave(
      draft,
      parsedAdjustment,
      parsedManualNoShowCount,
      parsedManualSameDayCancellationCount,
    );
    if (saved) {
      onClose();
      return;
    }
    setSaveError("레드 플래그 점수를 저장하지 못했습니다. 다시 시도해주세요.");
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="red-flag-assessment-title"
        className="flex max-h-[88dvh] w-full max-w-[620px] flex-col overflow-hidden rounded-[24px] border border-black/10 bg-[#f7f7f5] shadow-[0_30px_100px_rgba(0,0,0,0.22)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-black/10 bg-white px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
              red flag assessment
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 id="red-flag-assessment-title" className="text-xl font-bold">
                {profile.name ?? "신청자"} · 산정 근거
              </h2>
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-black tabular-nums text-red-700">
                {score.toFixed(1)}점
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="레드 플래그 산정 근거 닫기"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-black/45 transition hover:border-black/25 hover:text-black"
          >
            <X size={16} aria-hidden />
          </button>
        </header>

        <form className="overflow-y-auto px-5 py-5" onSubmit={saveReview}>
          <div>
            <p className="text-xs font-black text-black/65">산정 근거</p>
            {reasons.length > 0 ? (
              <div className="mt-2 space-y-2">
                {reasons.map((reason) => (
                  <div
                    key={reason.id}
                    className="flex items-start justify-between gap-3 rounded-xl bg-black/[0.035] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-black/75">
                        {reason.label}
                      </p>
                      {reason.detail && (
                        <p className="mt-0.5 text-[11px] font-semibold text-black/40">
                          {reason.detail}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs font-black tabular-nums text-red-600">
                      +{reason.score.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700">
                현재 자동·수동 레드 플래그 근거가 없어요.
              </p>
            )}
          </div>

          <div className="mt-4">
            <p className="text-xs font-black text-black/65">문맥 검토 항목</p>
            <div className="mt-2 space-y-2">
              {redFlagManualRules.map((rule) => (
                <label
                  key={rule.key}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/8 px-3 py-2.5 transition hover:border-black/15"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(draft[rule.key])}
                    disabled={disabled}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [rule.key]: event.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-black/20 accent-black"
                  />
                  <span className="min-w-0 flex-1 text-xs font-bold leading-5 text-black/65">
                    {rule.label}
                  </span>
                  <span className="shrink-0 text-xs font-black tabular-nums text-red-600">
                    +{rule.score.toFixed(1)}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-black/8 bg-white px-3 py-3">
              <div>
                <p className="text-xs font-black text-black/70">
                  추가 운영 이력
                </p>
                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-black/40">
                  위 참여 이력에 자동으로 잡히지 않은 건만 입력해주세요.
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="rounded-lg bg-[#f7f7f5] px-2.5 py-2">
                  <span className="block text-[11px] font-bold text-black/50">
                    노쇼 횟수 · 회당 +2
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    step="1"
                    value={manualNoShowCountDraft}
                    disabled={disabled}
                    aria-label="추가 노쇼 횟수"
                    aria-invalid={!manualNoShowCountValid}
                    onChange={(event) =>
                      setManualNoShowCountDraft(event.target.value)
                    }
                    className={cn(
                      "mt-1 h-9 w-full rounded-lg border bg-white px-2 text-center text-sm font-black tabular-nums outline-none",
                      manualNoShowCountValid
                        ? "border-black/10"
                        : "border-red-300 text-red-600",
                    )}
                  />
                </label>
                <label className="rounded-lg bg-[#f7f7f5] px-2.5 py-2">
                  <span className="block text-[11px] font-bold text-black/50">
                    당일 취소 횟수 · 회당 +1
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    step="1"
                    value={manualSameDayCancellationCountDraft}
                    disabled={disabled}
                    aria-label="추가 당일 취소 횟수"
                    aria-invalid={!manualSameDayCancellationCountValid}
                    onChange={(event) =>
                      setManualSameDayCancellationCountDraft(event.target.value)
                    }
                    className={cn(
                      "mt-1 h-9 w-full rounded-lg border bg-white px-2 text-center text-sm font-black tabular-nums outline-none",
                      manualSameDayCancellationCountValid
                        ? "border-black/10"
                        : "border-red-300 text-red-600",
                    )}
                  />
                </label>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-black/8 bg-white px-3 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black text-black/70">
                    운영자 점수 보정
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-black/40">
                    자동 판정이 과하거나 부족할 때 -5~+5점
                  </p>
                </div>
                <input
                  type="number"
                  min="-5"
                  max="5"
                  step="0.5"
                  value={adjustmentDraft}
                  disabled={disabled}
                  aria-label="레드 플래그 운영자 보정값"
                  aria-invalid={!adjustmentValid}
                  onChange={(event) => setAdjustmentDraft(event.target.value)}
                  className={cn(
                    "h-9 w-20 rounded-lg border bg-[#f7f7f5] px-2 text-center text-sm font-black tabular-nums outline-none",
                    adjustmentValid
                      ? "border-black/10"
                      : "border-red-300 text-red-600",
                  )}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={
                !dirty ||
                !adjustmentValid ||
                !manualNoShowCountValid ||
                !manualSameDayCancellationCountValid ||
                disabled
              }
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-black text-xs font-bold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/20"
            >
              <Save size={14} aria-hidden />
              {disabled ? "저장 중..." : "문맥 검토 저장"}
            </button>
            {saveError && (
              <p
                role="alert"
                className="mt-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600"
              >
                {saveError}
              </p>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

export const automaticRedFlagCriteria = [
  ["자신의 매력 평가", "1점 +2 · 2점 +1 · 10점 +0.5"],
  ["자신의 지적 능력 평가", "1점·10점 +0.5"],
  ["외적인 끌림의 중요도", "5번 선택 시 +0.5"],
  ["다른 가치관과 대화하는 편안함", "1점 +1 · 2점 +0.5"],
  ["클럽·한강 피크닉 선호", "클럽 선택 시 +0.5"],
  ["사회적 활동을 자신보다 중요하게 여김", "7점 선택 시 +0.5"],
  ["다른 사람을 신뢰하는 편", "1점 선택 시 +0.5"],
  ["상대의 호감 신호를 알아차리는 편", "1점 선택 시 +0.5"],
  ["다른 사람에게 의지하기 어려움", "7점 선택 시 +0.5"],
  ["사랑받지 못할까 걱정함", "7점 선택 시 +0.5"],
  ["외로움을 느끼는 빈도", "7점 선택 시 +0.5"],
  ["가까이 지낼 사람을 까다롭게 고름", "7점 선택 시 +0.5"],
  ["지각 성향", "5점 +0.5 · 6점 +1 · 7점 +2"],
  ["과거 참여 이력", "노쇼 1회당 +2 · 당일 취소 1회당 +1"],
  ["다른 사람의 단점을 찾는 편", "4점 +0.5 · 5점 +1"],
  ["그룹 자리에서 말하는 정도", "1점 선택 시 +0.5"],
  ["정치적으로 부적절한 유머 선호", "6점 +0.5 · 7점 +1"],
  ["첫 데이트의 두 번째 데이트 전환", "1점 +2 · 2점 +1"],
] as const;

export function RedFlagCriteriaDialog({ onClose }: { onClose: () => void }) {
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
        aria-labelledby="red-flag-criteria-title"
        className="flex max-h-[90dvh] w-full max-w-[760px] flex-col overflow-hidden rounded-[24px] border border-black/10 bg-[#f7f7f5] shadow-[0_30px_100px_rgba(0,0,0,0.22)]"
      >
        <header className="flex items-start justify-between gap-5 border-b border-black/10 bg-white px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
              red flag scoring guide
            </p>
            <h2
              id="red-flag-criteria-title"
              className="mt-1 text-2xl font-bold"
            >
              레드 플래그 산정 기준
            </h2>
            <p className="mt-2 text-sm leading-6 text-black/55">
              구조화된 답변과 참여 이력은 자동 계산하고, 문맥 판단이 필요한
              항목은 신청자별로 직접 검토합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="레드 플래그 산정 기준 닫기"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-black/55 transition hover:border-black/25 hover:text-black"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="overflow-y-auto px-6 py-6">
          <section>
            <h3 className="text-sm font-black">자동 산정</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {automaticRedFlagCriteria.map(([label, score]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-black/10 bg-white p-4"
                >
                  <p className="text-sm font-bold">{label}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-black/45">
                    {score}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <h3 className="text-sm font-black">운영자 문맥 검토</h3>
            <div className="mt-3 space-y-2">
              {redFlagManualRules.map((rule) => (
                <div
                  key={rule.key}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-black/10 bg-white px-4 py-3"
                >
                  <p className="text-sm font-bold leading-5">{rule.label}</p>
                  <span className="shrink-0 text-sm font-black tabular-nums text-red-600">
                    +{rule.score.toFixed(1)}
                  </span>
                </div>
              ))}
              <div className="flex items-start justify-between gap-4 rounded-2xl border border-black/10 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-bold leading-5">
                    운영자 직접 보정
                  </p>
                  <p className="mt-1 text-xs font-semibold text-black/40">
                    자동 산정이 과하거나 부족한 경우 0.5점 단위로 조정
                  </p>
                </div>
                <span className="shrink-0 text-sm font-black tabular-nums text-black/55">
                  -5~+5
                </span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

export function AssignmentCriteriaDialog({ onClose }: { onClose: () => void }) {
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

export function CriteriaSummaryCard({
  label,
  body,
}: {
  label: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-black/10 bg-white p-4">
      <p className="text-sm font-bold">{label}</p>
      <p className="mt-2 text-xs font-medium leading-5 text-black/55">{body}</p>
    </article>
  );
}

import { cn } from "@/lib/cn";
