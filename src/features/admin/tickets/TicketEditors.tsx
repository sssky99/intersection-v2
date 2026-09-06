"use client";
import { NaverPlacePicker } from "@/components/NaverPlacePicker";
import {
  placeVisibilities,
  placeVisibilityLabels,
  ticketVisibilities,
  ticketVisibilityLabels,
  type AdminTicketTemplate,
  type PlaceVisibility,
  type TicketVisibility,
} from "@/features/admin/ticketAdminTypes";
import { meetingRegionFromPlace } from "@/lib/seoulRegion";
import { TICKET_COURSE_MAX_STEPS } from "@/lib/ticketCourse";
import { ticketCategoryOptions } from "@/types/ticketCategory";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import {
  FormField,
  IconButton,
  SelectField,
  TextAreaField,
  TimeSplitField,
} from "./TicketFormControls";
import { TicketCourseStepDraft, TicketDraft } from "./ticketDraftTypes";

export const editableTicketVisibilities = ticketVisibilities.filter(
  (visibility) => visibility !== "question" && visibility !== "invite_only",
);

export const ticketCategorySelectOptions = [
  { value: "", label: "카테고리 선택" },
  ...ticketCategoryOptions,
];

export function TicketEditorHeader({
  ticket,
  draft,
  saving,
  onDraftChange,
  onDuplicate,
  onSave,
  onDelete,
}: {
  ticket: AdminTicketTemplate;
  draft: TicketDraft;
  saving: boolean;
  onDraftChange: (draft: TicketDraft) => void;
  onDuplicate: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const isSampleTicket = draft.templateKind === "question_sample";

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            {isSampleTicket ? "sample ticket" : "course"}
          </p>
          <h3 className="mt-1 text-xl font-bold">
            {draft.title || (isSampleTicket ? "새 샘플 티켓" : "새 코스")}
          </h3>
          <p className="mt-1 text-xs font-semibold text-black/42">
            {ticketVisibilityLabels[draft.visibility]} · 수정{" "}
            {updatedDate(ticket.updated_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <IconButton disabled={saving} onClick={onDuplicate} icon={Copy}>
            복제
          </IconButton>
          <IconButton disabled={saving} onClick={onDelete} icon={Trash2}>
            삭제
          </IconButton>
          <IconButton primary disabled={saving} onClick={onSave} icon={Check}>
            저장
          </IconButton>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[220px_220px]">
        <div>
          <span className="text-xs font-semibold text-black/50">
            {isSampleTicket ? "티켓 유형" : "코스 유형"}
          </span>
          <div className="mt-1.5 flex h-10 items-center rounded-xl border border-black/10 bg-black/[0.025] px-3 text-sm font-bold text-black/55">
            {isSampleTicket ? "샘플 티켓" : "운영 코스"}
          </div>
        </div>
        {isSampleTicket ? (
          <SelectField
            label="샘플 순서"
            value={draft.questionOrder}
            options={Array.from({ length: 5 }, (_, index) => {
              const value = String(index + 1);
              return { value, label: `${value}번째` };
            })}
            onChange={(questionOrder) =>
              onDraftChange({ ...draft, questionOrder })
            }
          />
        ) : (
          <SelectField
            label="선택 세부티켓 공개 상태"
            value={draft.visibility}
            options={editableTicketVisibilities.map((value) => ({
              value,
              label: ticketVisibilityLabels[value],
            }))}
            onChange={(visibility) =>
              onDraftChange({
                ...draft,
                visibility: visibility as TicketVisibility,
              })
            }
          />
        )}
      </div>
    </section>
  );
}

export function BasicEditor({
  draft,
  saving,
  sampleOnly,
  onDraftChange,
}: {
  draft: TicketDraft;
  saving: boolean;
  sampleOnly: boolean;
  onDraftChange: (draft: TicketDraft) => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h3 className="font-bold">기본 정보</h3>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <TextAreaField
          label={sampleOnly ? "샘플 티켓 제목" : "코스 이름"}
          className="col-span-2"
          value={draft.title}
          onChange={(title) => onDraftChange({ ...draft, title })}
        />
        <FormField
          label="분위기 태그"
          className="col-span-2"
          value={draft.moodTags}
          placeholder="#영화 #산책 #편한 대화"
          onChange={(moodTags) =>
            onDraftChange({ ...draft, moodTags: limitTagInput(moodTags) })
          }
        />
        {sampleOnly && (
          <CourseStepsEditor
            draft={draft}
            saving={saving}
            onDraftChange={onDraftChange}
          />
        )}
        {!sampleOnly && (
          <>
            <SelectField
              label="잔여 자리 문구"
              value={draft.remainingSeatLabelCount}
              options={Array.from({ length: 7 }, (_, count) => ({
                value: String(count),
                label: count === 0 ? "표시 안 함" : `${count}자리 남았어요`,
              }))}
              onChange={(remainingSeatLabelCount) =>
                onDraftChange({ ...draft, remainingSeatLabelCount })
              }
            />
            <SelectField
              label="최소 진행 인원"
              value={draft.minimumParticipantCount}
              options={Array.from({ length: 19 }, (_, index) => {
                const value = String(index + 2);
                return { value, label: `${value}명` };
              })}
              onChange={(minimumParticipantCount) =>
                onDraftChange({ ...draft, minimumParticipantCount })
              }
            />
            <SelectField
              label="최대 참여 인원"
              value={draft.maxParticipantCount}
              options={Array.from({ length: 19 }, (_, index) => {
                const value = String(index + 2);
                return { value, label: `${value}명` };
              })}
              onChange={(maxParticipantCount) =>
                onDraftChange({ ...draft, maxParticipantCount })
              }
            />
            <FormField
              label="날짜"
              type="date"
              value={draft.eventDate}
              onChange={(eventDate) => onDraftChange({ ...draft, eventDate })}
            />
            <TimeSplitField
              label="시간"
              value={draft.eventTime}
              onChange={(eventTime) => onDraftChange({ ...draft, eventTime })}
            />
            <FormField
              label="지역"
              value={draft.region}
              placeholder="성수, 을지로, 강남"
              onChange={(region) => onDraftChange({ ...draft, region })}
            />
            <SelectField
              label="장소 공개"
              value={draft.placeVisibility}
              options={placeVisibilities.map((value) => ({
                value,
                label: placeVisibilityLabels[value],
              }))}
              onChange={(placeVisibility) =>
                onDraftChange({
                  ...draft,
                  placeVisibility: placeVisibility as PlaceVisibility,
                })
              }
            />
            <FormField
              label="운영 코드"
              value={draft.operationCode}
              onChange={(operationCode) =>
                onDraftChange({ ...draft, operationCode })
              }
            />
            <TextAreaField
              label="운영 메모"
              className="col-span-2"
              value={draft.operationNote}
              onChange={(operationNote) =>
                onDraftChange({ ...draft, operationNote })
              }
            />
          </>
        )}
      </div>
    </section>
  );
}

export function CourseStepsEditor({
  draft,
  saving,
  onDraftChange,
}: {
  draft: TicketDraft;
  saving: boolean;
  onDraftChange: (draft: TicketDraft) => void;
}) {
  const courseSteps = normalizeDraftCourseSteps(draft.courseSteps);

  const commit = (
    steps: TicketCourseStepDraft[],
    patch: Partial<TicketDraft> = {},
  ) => {
    onDraftChange(
      syncDraftCourseFields({
        ...draft,
        ...patch,
        courseSteps: normalizeDraftCourseSteps(steps),
      }),
    );
  };

  const updateStep = (
    stepId: string,
    updater: (step: TicketCourseStepDraft) => TicketCourseStepDraft,
    patch: Partial<TicketDraft> = {},
  ) => {
    commit(
      courseSteps.map((step) => (step.id === stepId ? updater(step) : step)),
      patch,
    );
  };

  const setMainStep = (stepId: string) => {
    commit(
      courseSteps.map((step) => ({
        ...step,
        isMainActivity: step.id === stepId,
      })),
    );
  };

  const addStep = () => {
    if (courseSteps.length >= TICKET_COURSE_MAX_STEPS) return;
    commit([...courseSteps, blankCourseStep(courseSteps.length + 1)]);
  };

  const removeStep = (stepId: string) => {
    if (courseSteps.length <= 2) return;
    commit(courseSteps.filter((step) => step.id !== stepId));
  };

  return (
    <div className="col-span-2 space-y-3 rounded-2xl border border-black/8 bg-black/[0.025] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold">여정 구성</h4>
          <p className="mt-1 text-xs font-semibold text-black/42">
            향수 공방을 제외하고 1차 저녁 식사, 2차 활동으로 구성해요. 필요하면
            3차까지 추가할 수 있어요.
          </p>
        </div>
        <button
          type="button"
          disabled={saving || courseSteps.length >= TICKET_COURSE_MAX_STEPS}
          onClick={addStep}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-black/55 transition hover:border-black/20 hover:text-black disabled:opacity-40"
        >
          <Plus size={14} aria-hidden />
          3차 여정 추가
        </button>
      </div>

      <p className="text-[11px] font-semibold leading-5 text-black/42">
        활동 공개 시점은 모임 시작 기준이며, 피드백은 시작 3시간 후에
        고정됩니다.
      </p>

      {courseSteps.map((step, index) => {
        const canRemove = courseSteps.length > 2 && index >= 2;
        const stepLabel = `${index + 1}차`;

        return (
          <section
            key={step.id}
            className="rounded-2xl border border-black/10 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-accent">{stepLabel}</p>
                <h5 className="mt-1 text-sm font-bold">
                  {step.title.trim() || `${stepLabel} 활동`}
                </h5>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setMainStep(step.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition disabled:opacity-40",
                    step.isMainActivity
                      ? "bg-accent text-white"
                      : "border border-black/10 bg-white text-black/50 hover:border-black/20 hover:text-black",
                  )}
                >
                  {step.isMainActivity && <Check size={14} aria-hidden />}
                  메인 활동
                </button>
                {canRemove && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => removeStep(step.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-red-500 transition hover:bg-red-50 disabled:opacity-40"
                    aria-label={`${stepLabel} 여정 삭제`}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <FormField
                label={`${stepLabel} 활동명`}
                value={step.title}
                placeholder={
                  index === 0 ? "저녁 식사" : "볼링 · 전시 · 보드게임"
                }
                onChange={(title) =>
                  updateStep(step.id, (current) => ({ ...current, title }))
                }
              />
              <SelectField
                label={`${stepLabel} 활동 카테고리`}
                value={step.activityType}
                options={ticketCategorySelectOptions}
                onChange={(activityType) =>
                  updateStep(step.id, (current) => ({
                    ...current,
                    activityType,
                  }))
                }
              />
              <FormField
                label={`${stepLabel} 공개 시점 (모임 시작 후 분)`}
                type="number"
                value={step.openOffsetMinutes}
                placeholder="0~179"
                onChange={(openOffsetMinutes) =>
                  updateStep(step.id, (current) => ({
                    ...current,
                    openOffsetMinutes,
                  }))
                }
              />
              <NaverPlacePicker
                className="col-span-2"
                title={`${stepLabel} 장소 검색`}
                value={step.place}
                onChange={(place) => {
                  const nextRegion = place
                    ? (meetingRegionFromPlace(place) ?? draft.region)
                    : draft.region;
                  const shouldSyncRegion =
                    step.isMainActivity || !draft.region.trim();
                  updateStep(
                    step.id,
                    (current) => ({
                      ...current,
                      place,
                      placeName: place?.name ?? current.placeName,
                      address:
                        place?.roadAddress ??
                        place?.jibunAddress ??
                        current.address,
                    }),
                    {
                      region: shouldSyncRegion ? nextRegion : draft.region,
                      placeVisibility:
                        place && draft.placeVisibility === "hidden"
                          ? "confirmed_only"
                          : draft.placeVisibility,
                    },
                  );
                }}
              />
              <FormField
                label={`${stepLabel} 상세 장소명`}
                value={step.placeName}
                onChange={(placeName) =>
                  updateStep(step.id, (current) => ({
                    ...current,
                    placeName,
                  }))
                }
              />
              <FormField
                label={`${stepLabel} 상세 주소`}
                value={step.address}
                onChange={(address) =>
                  updateStep(step.id, (current) => ({ ...current, address }))
                }
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}

import { cn } from "@/lib/cn";
import {
  blankCourseStep,
  limitTagInput,
  normalizeDraftCourseSteps,
  syncDraftCourseFields,
  updatedDate,
} from "./ticketCourseDraft";
export {
  blankCourseStep,
  firstDraftCourseStep,
  limitTagInput,
  mainDraftCourseStep,
  normalizeDraftCourseSteps,
  syncDraftCourseFields,
  updatedDate,
} from "./ticketCourseDraft";
