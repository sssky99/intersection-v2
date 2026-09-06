"use client";
import { IntersectionTicketCard } from "@/components/IntersectionTicketCard";
import { StoredTicketDetailView } from "@/features/app/tickets/TicketProgress";
import { TicketDetailContent } from "@/features/meetings/TicketDetailContent";
import { TicketDetailHero } from "@/features/meetings/TicketDetailHero";
import { ticketBackgroundImageUrls } from "@/lib/ticketImages";
import {
  type GatheringTicket,
  type TicketProgressStep,
  type UserTicket,
} from "@/types/ticket";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { TextAreaField } from "./TicketFormControls";
import { TicketDraft } from "./ticketDraftTypes";

export function AdminProgressPreviewModal({
  userTicket,
  draft,
  saving,
  onDraftChange,
  onSave,
  onClose,
}: {
  userTicket: UserTicket;
  draft: TicketDraft;
  saving: boolean;
  onDraftChange: (draft: TicketDraft) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const [selectedProgressStep, setSelectedProgressStep] = useState<string>(
    userTicket.progressStep,
  );
  const selectedCopyProgressStep = (
    selectedProgressStep.startsWith("activity:")
      ? "in_progress"
      : selectedProgressStep
  ) as TicketProgressStep;
  const activeCopyConfig =
    progressStepCopyEditorConfig[selectedCopyProgressStep];

  useEffect(() => {
    setSelectedProgressStep(userTicket.progressStep);
  }, [userTicket.id, userTicket.progressStep]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label="실제 진행상황 문구 수정"
    >
      <div className="grid max-h-[92dvh] w-full max-w-[1040px] overflow-y-auto rounded-[32px] bg-white shadow-[0_30px_100px_rgba(0,0,0,0.28)] lg:grid-cols-[430px_minmax(0,1fr)] lg:overflow-hidden">
        <div className="relative min-h-[560px] bg-white lg:max-h-[92dvh] lg:overflow-y-auto">
          <StoredTicketDetailView
            userTicket={userTicket}
            onClose={onClose}
            previewMode
            selectedProgressStep={
              selectedProgressStep as TicketProgressStep | `activity:${string}`
            }
            onProgressStepChange={(step) => setSelectedProgressStep(step)}
          />
        </div>

        <aside className="min-h-0 border-t border-black/10 bg-[#fbfbfa] p-5 lg:max-h-[92dvh] lg:overflow-y-auto lg:border-l lg:border-t-0">
          <div className="sticky top-0 z-10 -mx-5 -mt-5 border-b border-black/10 bg-[#fbfbfa]/95 px-5 py-4 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">
                  progress copy
                </p>
                <h3 className="mt-1 text-lg font-black">
                  {activeCopyConfig.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black/45 transition hover:text-black"
                aria-label="진행상황 문구 수정 닫기"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-black text-white transition hover:bg-black/85 disabled:opacity-40"
            >
              <Check size={15} aria-hidden />
              {saving ? "저장 중" : "저장"}
            </button>
          </div>

          <div className="mt-5">
            <ProgressStepCopyEditor
              selectedProgressStep={selectedCopyProgressStep}
              draft={draft}
              onDraftChange={onDraftChange}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

export type ProgressStepCopyDraftKey =
  | "stageAppliedText"
  | "stageApprovedText"
  | "stagePreStartText"
  | "stageInProgressText"
  | "stageFeedbackOpenText"
  | "feedbackTitle"
  | "feedbackBody";

export const progressStepCopyEditorConfig: Record<
  TicketProgressStep,
  {
    title: string;
    eyebrow: string;
    description: string;
    fields: Array<{
      key: ProgressStepCopyDraftKey;
      label: string;
      rows: number;
    }>;
  }
> = {
  applied: {
    title: "신청 완료 문구 수정",
    eyebrow: "applied",
    description: "왼쪽 신청 완료 탭의 초록 안내 박스에 표시되는 문구입니다.",
    fields: [{ key: "stageAppliedText", label: "신청 완료 안내", rows: 3 }],
  },
  approved: {
    title: "참여 확정 문구 수정",
    eyebrow: "approved",
    description: "왼쪽 참여 확정 탭의 초록 안내 박스에 표시되는 문구입니다.",
    fields: [{ key: "stageApprovedText", label: "참여 확정 안내", rows: 3 }],
  },
  pre_start: {
    title: "시작 전 안내 문구 수정",
    eyebrow: "pre start",
    description: "왼쪽 시작 전 안내 탭의 초록 안내 박스에 표시되는 문구입니다.",
    fields: [{ key: "stagePreStartText", label: "시작 전 안내", rows: 3 }],
  },
  in_progress: {
    title: "진행 중 문구 수정",
    eyebrow: "in progress",
    description: "왼쪽 진행 중 탭의 초록 안내 박스에 표시되는 문구입니다.",
    fields: [{ key: "stageInProgressText", label: "진행 중 안내", rows: 3 }],
  },
  feedback: {
    title: "피드백 작성 문구 수정",
    eyebrow: "feedback",
    description:
      "왼쪽 피드백 작성 탭의 초록 안내와 피드백 카드에 표시되는 문구입니다.",
    fields: [
      { key: "stageFeedbackOpenText", label: "피드백 오픈 안내", rows: 3 },
      { key: "feedbackTitle", label: "피드백 카드 제목", rows: 1 },
      { key: "feedbackBody", label: "피드백 카드 본문", rows: 4 },
    ],
  },
};

export function ProgressStepCopyEditor({
  selectedProgressStep,
  draft,
  onDraftChange,
}: {
  selectedProgressStep: TicketProgressStep;
  draft: TicketDraft;
  onDraftChange: (draft: TicketDraft) => void;
}) {
  const config = progressStepCopyEditorConfig[selectedProgressStep];

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
        {config.eyebrow}
      </p>
      <h3 className="mt-1 text-sm font-bold">{config.title}</h3>
      <p className="mt-2 text-xs font-semibold leading-5 text-black/45">
        {config.description}
      </p>
      <div className="mt-4 space-y-3">
        {config.fields.map((field) => (
          <TextAreaField
            key={field.key}
            label={field.label}
            rows={field.rows}
            value={draft[field.key]}
            onChange={(value) =>
              onDraftChange({ ...draft, [field.key]: value })
            }
          />
        ))}
      </div>
    </section>
  );
}

export function TicketPreviewPanel({
  ticket,
  sampleOnly,
}: {
  ticket: GatheringTicket;
  sampleOnly: boolean;
}) {
  return (
    <aside className="sticky top-5 self-start space-y-4">
      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
          ticket card
        </p>
        <div className="mx-auto mt-3 w-[min(78vw,320px,calc(61.73dvh-121px))]">
          <IntersectionTicketCard
            title={ticket.title}
            imageUrl={ticket.imageUrl}
            imageUrls={ticketBackgroundImageUrls(ticket)}
            date={ticket.date}
            time={ticket.time}
            location={ticket.area}
            tags={ticket.moodTags}
            remainingSeatCount={ticket.remainingSeatCount}
          />
        </div>
      </section>

      {!sampleOnly && (
        <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
          <p className="px-4 pt-4 text-xs font-bold uppercase tracking-[0.14em] text-accent">
            detail
          </p>
          <div className="mt-3 overflow-hidden border-t border-black/8">
            <TicketDetailHero ticket={ticket} />
            <TicketDetailContent
              ticket={ticket}
              className="px-5 pb-5"
              startWithBorder
            />
          </div>
        </section>
      )}
    </aside>
  );
}
export type { TicketCourseStepDraft, TicketDraft } from "./ticketDraftTypes";
