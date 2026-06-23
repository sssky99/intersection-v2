"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Clock3,
  Image as ImageIcon,
  Loader2,
  PenLine,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { IntersectionTicketCard } from "@/components/IntersectionTicketCard";
import { VibeAxisBar, VibeGraph } from "@/components/vibe/VibeGraph";
import {
  vibeAxes,
  type VibeScores,
} from "@/components/vibe/vibeGraphConfig";
import { TicketDetailHero } from "@/features/meetings/TicketDetailHero";
import { normalizeProposalHashtags } from "@/lib/meetingProposalTags";
import type {
  MeetingProposalDraft,
  MeetingProposalInput,
  MeetingProposalPublicProfile,
} from "@/types/meetingProposal";
import type { GatheringTicket } from "@/types/ticket";

type Stage = "form" | "preview" | "submitted";
type EditTarget =
  | "title"
  | "image"
  | "location"
  | "datetime"
  | "hashtags"
  | "summary"
  | "activities"
  | "vibe"
  | "flow";

type ProposalFormState = MeetingProposalInput & {
  proposerRoleAgreed: boolean;
};

export type ProposalMemberProfile = MeetingProposalPublicProfile;

const emptyForm: ProposalFormState = {
  imageUrl: "",
  title: "",
  activityDescription: "",
  eventDate: "",
  eventTime: "",
  region: "",
  specificPlace: null,
  userHashtags: [],
  proposerRoleAgreed: false,
};

const initialDraft: MeetingProposalDraft = {
  title: "",
  shortDescription: "",
  hashtags: [],
  activities: [],
  vibe: {
    temperature: 3,
    texture: 3,
    tone: 3,
    rhythm: 3,
    alcohol: 2,
    romance: 2,
  },
  flow: [],
};

const timePeriods = ["오전", "오후"] as const;
const timeHours = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
const quarterMinutes = ["00", "15", "30", "45"] as const;
type TimePeriod = (typeof timePeriods)[number];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function splitTags(value: string) {
  return normalizeProposalHashtags(value);
}

function tagInputValue(tags: string[]) {
  return tags.map((tag) => `#${tag}`).join(" ");
}

function splitLines(value: string, limit = 5) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function cleanTime(value: string) {
  return value ? value.slice(0, 5) : "";
}

function proposerLabel(profile: ProposalMemberProfile) {
  return `${profile.displayName}님의 제안`;
}

function ticketFromProposal({
  form,
  draft,
  profile,
  imageUrl,
}: {
  form: ProposalFormState;
  draft: MeetingProposalDraft;
  profile: ProposalMemberProfile;
  imageUrl: string;
}): GatheringTicket {
  const title = draft.title.trim() || form.title.trim() || "제안할 교집합";
  const hashtags =
    draft.hashtags.length > 0 ? draft.hashtags : form.userHashtags ?? [];
  const summary =
    draft.shortDescription.trim() ||
    "운영팀 검수 후 실제 초대장 문구로 다듬어질 수 있어요.";

  return {
    id: "proposal-preview",
    templateId: "proposal-preview-template",
    title,
    subtitle: summary,
    date: form.eventDate,
    time: cleanTime(form.eventTime),
    area: form.region || "지역 미정",
    moodTags: hashtags,
    activityType: "member_proposal",
    imageUrl: imageUrl || undefined,
    remainingSeatCount: 0,
    peopleHint: summary,
    reason: summary,
    detailSummary: summary,
    detailActivities: draft.activities,
    detailFlow: draft.flow,
    proposerLabel: proposerLabel(profile),
    proposerProfile: {
      userId: profile.userId,
      displayName: profile.displayName,
      publicIntro: profile.publicIntro,
      publicEmoji: profile.publicEmoji,
    },
    vibeScores: draft.vibe,
  };
}

export function MeetingProposalFlow({
  profile,
  onBack,
  onDone,
}: {
  profile: ProposalMemberProfile;
  onBack: () => void;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<Stage>("form");
  const [form, setForm] = useState<ProposalFormState>(emptyForm);
  const [draft, setDraft] = useState<MeetingProposalDraft>(initialDraft);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);

  useEffect(() => {
    return () => {
      if (localImageUrl) URL.revokeObjectURL(localImageUrl);
    };
  }, [localImageUrl]);

  const imageUrl = localImageUrl ?? form.imageUrl ?? "";
  const previewTicket = useMemo(
    () => ticketFromProposal({ form, draft, profile, imageUrl }),
    [draft, form, imageUrl, profile],
  );

  const canGenerate =
    Boolean(
      form.title.trim() &&
        form.activityDescription.trim() &&
        form.eventDate &&
        form.eventTime &&
        form.region.trim() &&
        form.proposerRoleAgreed,
    ) && !uploading;

  const updateForm = <TKey extends keyof ProposalFormState>(
    key: TKey,
    value: ProposalFormState[TKey],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const uploadImage = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setLocalImageUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return previewUrl;
    });
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/meeting-proposals/upload", {
      method: "POST",
      body: formData,
    }).catch(() => null);
    const data = response
      ? ((await response.json().catch(() => null)) as
          | { imageUrl?: string; error?: string }
          | null)
      : null;

    if (!response?.ok || !data?.imageUrl) {
      setError(data?.error ?? "이미지를 업로드하지 못했어요.");
      setUploading(false);
      return;
    }

    updateForm("imageUrl", data.imageUrl);
    setLocalImageUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setUploading(false);
  };

  const generateDraft = async () => {
    if (!canGenerate || generating) return;

    setGenerating(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/meeting-proposals/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    const data = response
      ? ((await response.json().catch(() => null)) as
          | {
              draft?: MeetingProposalDraft;
              error?: string;
              notice?: string | null;
            }
          | null)
      : null;

    if (!response?.ok || !data?.draft) {
      setError(data?.error ?? "AI 초안을 만들지 못했어요.");
      setGenerating(false);
      return;
    }

    setDraft({
      ...data.draft,
      title: data.draft.title || form.title,
    });
    setNotice(data.notice ?? null);
    setStage("preview");
    setGenerating(false);
  };

  const submitProposal = async () => {
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/meeting-proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ...draft,
        title: draft.title || form.title,
        proposerRoleAgreed: form.proposerRoleAgreed,
      }),
    }).catch(() => null);
    const data = response
      ? ((await response.json().catch(() => null)) as { error?: string } | null)
      : null;

    if (!response?.ok) {
      setError(data?.error ?? "제안을 제출하지 못했어요.");
      setSubmitting(false);
      return;
    }

    setStage("submitted");
    setSubmitting(false);
  };

  if (stage === "submitted") {
    return <ProposalSubmitted profile={profile} onDone={onDone} />;
  }

  return (
    <motion.section
      key={stage}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="pb-8"
    >
      <button
        type="button"
        onClick={stage === "form" ? onBack : () => setStage("form")}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black/55 shadow-sm transition hover:text-black"
        aria-label="뒤로 가기"
      >
        <ArrowLeft size={18} aria-hidden />
      </button>

      {stage === "form" ? (
        <ProposalForm
          form={form}
          previewTicket={previewTicket}
          uploading={uploading}
          generating={generating}
          canGenerate={canGenerate}
          error={error}
          onChange={updateForm}
          onUpload={uploadImage}
          onGenerate={() => void generateDraft()}
        />
      ) : (
        <ProposalPreview
          profile={profile}
          draft={draft}
          ticket={previewTicket}
          notice={notice}
          error={error}
          submitting={submitting}
          onEdit={setEditing}
          onSubmit={() => void submitProposal()}
        />
      )}

      <AnimatePresence>
        {editing && (
          <EditSheet
            target={editing}
            form={form}
            draft={draft}
            uploading={uploading}
            onClose={() => setEditing(null)}
            onFormChange={updateForm}
            onDraftChange={setDraft}
            onUpload={uploadImage}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function ProposalForm({
  form,
  previewTicket,
  uploading,
  generating,
  canGenerate,
  error,
  onChange,
  onUpload,
  onGenerate,
}: {
  form: ProposalFormState;
  previewTicket: GatheringTicket;
  uploading: boolean;
  generating: boolean;
  canGenerate: boolean;
  error: string | null;
  onChange: <TKey extends keyof ProposalFormState>(
    key: TKey,
    value: ProposalFormState[TKey],
  ) => void;
  onUpload: (file: File) => Promise<void>;
  onGenerate: () => void;
}) {
  return (
    <>
      <header className="mt-5 pr-8">
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
          member proposal
        </p>
        <h1 className="mt-2 text-[26px] font-bold leading-9 tracking-tight text-black">
          내가 원하는 교집합 제안하기
        </h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-black/48">
          간단한 정보만 입력해도 AI가 초안을 만들어줘요.
        </p>
      </header>

      <div className="mt-7 grid gap-6">
        <div className="space-y-5">
          <ProposalTextField
            label="제목을 작성해주세요."
            value={form.title}
            onChange={(value) => onChange("title", value)}
            placeholder="전시보고, 카페에서 감상 나누기"
            required
          />

          <ProposalTextarea
            label="이 자리에서는 무엇을 하나요?"
            value={form.activityDescription}
            onChange={(value) => onChange("activityDescription", value)}
            placeholder="예: 전시를 보고 근처 카페에서 이야기해요."
          />

          <section className="rounded-[24px] border border-black/10 bg-white px-5 py-4">
            <span className="text-sm font-black text-black">언제 열고 싶나요?</span>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="sr-only">날짜</span>
                <input
                  type="date"
                  value={form.eventDate}
                  onChange={(event) => onChange("eventDate", event.target.value)}
                  className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none transition focus:border-accent"
                />
              </label>
              <ProposalTimeField
                compact
                label="시간 선택"
                value={form.eventTime}
                onChange={(value) => onChange("eventTime", value)}
              />
            </div>
          </section>

          <ProposalTextField
            label="어디에서 열고 싶나요?"
            value={form.region}
            onChange={(value) => {
              onChange("region", value);
              onChange("specificPlace", null);
            }}
            placeholder="성수, 을지로, 강남, 홍대, 상관없어요"
          />

          <section className="rounded-[24px] border border-black/10 bg-white px-5 py-5">
            <h2 className="text-sm font-black text-black">
              이 자리를 표현할 사진이 있다면 올려주세요.
              <span className="ml-2 text-[10px] font-bold text-black/30">
                선택
              </span>
            </h2>
            <label className="mt-4 flex min-h-[118px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-black/18 bg-black/[0.025] px-4 py-5 text-center transition hover:border-accent/70 hover:bg-accent/[0.06]">
              <ImageIcon size={24} className="text-black/35" aria-hidden />
              <span className="mt-2 text-xs font-bold text-black/55">
                {uploading ? "업로드 중..." : "사진 선택하기"}
              </span>
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onUpload(file);
                  event.target.value = "";
                }}
                className="sr-only"
              />
            </label>
          </section>

          <label className="block rounded-[24px] border border-black/10 bg-white px-5 py-5">
            <span className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.proposerRoleAgreed}
                onChange={(event) =>
                  onChange("proposerRoleAgreed", event.target.checked)
                }
                className="mt-1 h-5 w-5 rounded border-black/20 accent-black"
              />
              <span>
                <span className="block text-sm font-black leading-6 text-black">
                  이 교집합이 실제로 열리면, 제안자로서 자리를 가볍게
                  열어주는 역할을 할게요.
                </span>
                <span className="mt-2 block text-xs font-semibold leading-5 text-black/45">
                  어렵게 진행하는 역할은 아니에요. 처음에 제안한 이유를
                  한마디로 소개하고, 대화가 자연스럽게 시작될 수 있도록
                  도와주는 정도예요.
                </span>
              </span>
            </span>
          </label>

          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={!canGenerate || generating}
            onClick={onGenerate}
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-bold text-white transition disabled:bg-black/[0.18] disabled:text-black/35"
          >
            {generating ? (
              <Loader2 size={17} className="animate-spin" aria-hidden />
            ) : (
              <Sparkles size={17} aria-hidden />
            )}
            {generating ? "AI 초안 만드는 중..." : "작성 완료하고 AI 초안 보기"}
          </button>
        </div>

        <aside>
          <p className="mb-3 text-xs font-black text-black/48">
            티켓 외부 화면 실시간 미리보기
          </p>
          <IntersectionTicketCard
            title={previewTicket.title}
            imageUrl={previewTicket.imageUrl}
            date={previewTicket.date}
            time={previewTicket.time}
            location={previewTicket.area}
            tags={previewTicket.moodTags}
            proposerLabel={previewTicket.proposerLabel}
          />
        </aside>
      </div>
    </>
  );
}

function ProposalPreview({
  profile,
  draft,
  ticket,
  notice,
  error,
  submitting,
  onEdit,
  onSubmit,
}: {
  profile: ProposalMemberProfile;
  draft: MeetingProposalDraft;
  ticket: GatheringTicket;
  notice: string | null;
  error: string | null;
  submitting: boolean;
  onEdit: (target: EditTarget) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <header className="mt-5 pr-8">
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
          preview
        </p>
        <h1 className="mt-2 text-[26px] font-bold leading-9 tracking-tight text-black">
          실제 화면처럼 확인하고 수정해요
        </h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-black/48">
          연필 아이콘이 있는 영역은 제출 전까지 바로 수정할 수 있어요.
        </p>
      </header>

      {notice && (
        <p className="mt-5 rounded-2xl bg-accent/[0.08] px-4 py-3 text-xs font-semibold leading-5 text-black/58">
          {notice}
        </p>
      )}

      <section className="mt-6 rounded-[28px] border border-black/10 bg-white px-5 py-5">
        <h2 className="text-[15px] font-black text-black">
          티켓 외부 화면 미리보기
        </h2>
        <div className="mx-auto mt-4 w-full max-w-[330px]">
          <IntersectionTicketCard
            title={ticket.title}
            imageUrl={ticket.imageUrl}
            date={ticket.date}
            time={ticket.time}
            location={ticket.area}
            tags={ticket.moodTags}
            proposerLabel={ticket.proposerLabel}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold sm:grid-cols-5">
          <EditChip label="사진" onClick={() => onEdit("image")} />
          <EditChip label="제목" onClick={() => onEdit("title")} />
          <EditChip label="지역" onClick={() => onEdit("location")} />
          <EditChip label="날짜/시간" onClick={() => onEdit("datetime")} />
          <EditChip label="해시태그" onClick={() => onEdit("hashtags")} />
        </div>
      </section>

      <article className="mt-6 overflow-hidden rounded-[28px] border border-black/12 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
        <div className="border-b border-black/8 px-5 py-4">
          <EditableHeader
            title="티켓 상세 화면 미리보기"
            onEdit={() => onEdit("title")}
          />
        </div>
        <TicketDetailHero ticket={ticket} />
        <div className="px-5 pb-5 pt-1">
          <EditableDetailSection
            title="한 줄 설명"
            onEdit={() => onEdit("summary")}
          >
            <p className="whitespace-pre-line text-sm font-semibold leading-6 text-black/62">
              {draft.shortDescription}
            </p>
          </EditableDetailSection>

          <EditableDetailSection
            title="이 자리에서는 이런 걸 해요"
            onEdit={() => onEdit("activities")}
          >
            <BulletList items={draft.activities} />
          </EditableDetailSection>

          <EditableDetailSection title="자리 분위기" onEdit={() => onEdit("vibe")}>
            <VibeGraph
              title="자리 분위기"
              scores={draft.vibe}
              visibleAxes={vibeAxes}
              showAxisHeader={false}
              className="rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
            />
          </EditableDetailSection>

          <EditableDetailSection
            title="이렇게 진행돼요"
            onEdit={() => onEdit("flow")}
          >
            <ol className="space-y-2.5">
              {draft.flow.map((step, index) => (
                <li key={`${step}-${index}`} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-[11px] font-black text-white">
                    {index + 1}
                  </span>
                  <span className="pt-1 text-sm font-semibold leading-6 text-black/62">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </EditableDetailSection>

          <section className="border-t border-black/8 py-5">
            <h2 className="text-[15px] font-black text-black">
              이 자리를 제안한 멤버
            </h2>
            <div className="mt-4 rounded-3xl border border-black/8 bg-black/[0.025] px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                  {profile.publicEmoji?.trim() || "💎"}
                </div>
                <div>
                  <p className="text-sm font-black text-black">
                    {profile.displayName}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-accent">
                    {proposerLabel(profile)}
                  </p>
                </div>
              </div>
              {profile.publicIntro && (
                <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-6 text-black/60">
                  {profile.publicIntro}
                </p>
              )}
            </div>
          </section>
        </div>
      </article>

      <div className="mt-6 rounded-[24px] border border-black/10 bg-white px-5 py-5">
        <p className="text-sm font-black leading-6 text-black">
          제출 후에는 직접 수정할 수 없어요.
        </p>
        <p className="mt-2 text-xs font-semibold leading-5 text-black/45">
          운영팀 검수 후 실제 초대장으로 열릴 수 있어요. 제안이 선정되면 이
          자리는 {profile.displayName}님의 제안으로 공개되고,{" "}
          {profile.displayName}님은 자동 참여 확정돼요.
        </p>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={submitting}
        onClick={onSubmit}
        className="mt-5 flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-bold text-white disabled:bg-black/[0.18] disabled:text-black/35"
      >
        {submitting ? (
          <Loader2 size={17} className="animate-spin" aria-hidden />
        ) : (
          <Check size={17} aria-hidden />
        )}
        {submitting ? "제출 중..." : "운영팀에 최종 제출하기"}
      </button>
    </>
  );
}

function EditSheet({
  target,
  form,
  draft,
  uploading,
  onClose,
  onFormChange,
  onDraftChange,
  onUpload,
}: {
  target: EditTarget;
  form: ProposalFormState;
  draft: MeetingProposalDraft;
  uploading: boolean;
  onClose: () => void;
  onFormChange: <TKey extends keyof ProposalFormState>(
    key: TKey,
    value: ProposalFormState[TKey],
  ) => void;
  onDraftChange: (draft: MeetingProposalDraft) => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const [hashtagsInput, setHashtagsInput] = useState(() =>
    tagInputValue(draft.hashtags),
  );
  const titleMap: Record<EditTarget, string> = {
    title: "제목 수정",
    image: "사진 수정",
    location: "지역 수정",
    datetime: "날짜/시간 수정",
    hashtags: "해시태그 수정",
    summary: "한 줄 설명 수정",
    activities: "이 자리에서는 이런 걸 해요 수정",
    vibe: "자리 분위기 수정",
    flow: "이렇게 진행돼요 수정",
  };

  const updateDraft = (patch: Partial<MeetingProposalDraft>) => {
    onDraftChange({ ...draft, ...patch });
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end bg-black/28 px-4 pb-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.section
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }}
        className="mx-auto max-h-[86dvh] w-full max-w-[520px] overflow-y-auto rounded-[26px] border border-black/10 bg-white px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
      >
        <header className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-black text-black">{titleMap[target]}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-black/45"
            aria-label="수정 닫기"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="mt-5 space-y-4">
          {target === "title" && (
            <ProposalTextField
              label="제목"
              value={draft.title}
              onChange={(value) => updateDraft({ title: value })}
              multiline
            />
          )}

          {target === "image" && (
            <label className="flex min-h-[130px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-black/18 bg-black/[0.025] px-4 py-5 text-center">
              <ImageIcon size={24} className="text-black/35" aria-hidden />
              <span className="mt-2 text-xs font-bold text-black/55">
                {uploading ? "업로드 중..." : "새 사진 선택하기"}
              </span>
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onUpload(file);
                  event.target.value = "";
                }}
                className="sr-only"
              />
            </label>
          )}

          {target === "location" && (
            <ProposalTextField
              label="지역"
              value={form.region}
              onChange={(value) => {
                onFormChange("region", value);
                onFormChange("specificPlace", null);
              }}
            />
          )}

          {target === "datetime" && (
            <div className="grid grid-cols-2 gap-3">
              <ProposalTextField
                label="날짜"
                type="date"
                value={form.eventDate}
                onChange={(value) => onFormChange("eventDate", value)}
              />
              <ProposalTimeField
                label="시간"
                value={form.eventTime}
                onChange={(value) => onFormChange("eventTime", value)}
              />
            </div>
          )}

          {target === "hashtags" && (
            <ProposalTextField
              label="해시태그"
              value={hashtagsInput}
              onChange={(value) => {
                setHashtagsInput(value);
                updateDraft({ hashtags: splitTags(value) });
              }}
              placeholder="#와인 #취향대화 #차분한저녁"
            />
          )}

          {target === "summary" && (
            <ProposalTextarea
              label="한 줄 설명"
              value={draft.shortDescription}
              onChange={(value) => updateDraft({ shortDescription: value })}
            />
          )}

          {target === "activities" && (
            <ArrayEditor
              values={draft.activities}
              onChange={(values) => updateDraft({ activities: values.slice(0, 4) })}
            />
          )}

          {target === "flow" && (
            <ArrayEditor
              values={draft.flow}
              onChange={(values) => updateDraft({ flow: values.slice(0, 5) })}
            />
          )}

          {target === "vibe" && (
            <div className="space-y-5 rounded-2xl border border-black/8 bg-black/[0.025] px-4 py-4">
              {vibeAxes.map((axis) => {
                const value = Number(draft.vibe[axis] ?? 3);

                return (
                  <VibeAxisBar
                    key={axis}
                    axis={axis}
                    score={value}
                    valueLabel={`${value} / 5`}
                    input={{
                      value,
                      min: 1,
                      max: 5,
                      step: 1,
                      onChange: (nextValue) =>
                        updateDraft({
                          vibe: {
                            ...draft.vibe,
                            [axis]: nextValue,
                          } as VibeScores,
                        }),
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-12 w-full rounded-full bg-black text-sm font-bold text-white"
        >
          수정 완료
        </button>
      </motion.section>
    </motion.div>
  );
}

function ArrayEditor({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const updateValue = (index: number, value: string) => {
    onChange(values.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  return (
    <div className="space-y-3">
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={value}
            onChange={(event) => updateValue(index, event.target.value)}
            className="h-11 min-w-0 flex-1 rounded-2xl border border-black/10 px-4 text-sm font-semibold outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-black/10 text-black/45"
            aria-label="항목 삭제"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...values, ""])}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-black/16 text-xs font-bold text-black/50"
      >
        <Plus size={15} aria-hidden />
        항목 추가
      </button>
      <textarea
        value={values.join("\n")}
        onChange={(event) => onChange(splitLines(event.target.value))}
        rows={5}
        className="w-full resize-none rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold leading-6 outline-none focus:border-accent"
      />
    </div>
  );
}

function ProposalSubmitted({
  profile,
  onDone,
}: {
  profile: ProposalMemberProfile;
  onDone: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pt-12 text-center"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/12 text-accent">
        <Check size={24} aria-hidden />
      </div>
      <h1 className="mt-6 text-[28px] font-bold leading-9 text-black">
        제안이 접수됐어요.
      </h1>
      <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-7 text-black/55">
        운영팀이 해당 제안을 검수한 뒤{"\n"}
        실제 초대장으로 만들어드려요.{"\n\n"}
        제안이 선정되면 이 자리는 {profile.displayName}님의 제안으로 공개되고,
        {"\n"}
        {profile.displayName}님은 해당 자리의 첫번째 멤버가 돼요.
      </p>
      <button
        type="button"
        onClick={onDone}
        className="mt-8 h-[52px] w-full rounded-full bg-black text-sm font-bold text-white"
      >
        추천탭으로 돌아가기
      </button>
    </motion.section>
  );
}

function ProposalTextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  optional = false,
  required = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "date" | "time";
  optional?: boolean;
  required?: boolean;
  multiline?: boolean;
}) {
  return (
    <label className="block rounded-[24px] border border-black/10 bg-white px-5 py-4">
      <span className="flex items-center gap-2 text-sm font-black text-black">
        {label}
        {optional && (
          <span className="text-[10px] font-bold text-black/30">선택</span>
        )}
        {required && (
          <span className="text-[10px] font-bold text-red-500">필수</span>
        )}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={2}
          className="mt-3 min-h-[76px] w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold leading-5 outline-none transition placeholder:text-black/25 focus:border-accent"
        />
      ) : (
        <input
          type={type}
          step={type === "time" ? 900 : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="mt-3 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none transition placeholder:text-black/25 focus:border-accent"
        />
      )}
    </label>
  );
}

function parseTimeParts(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  const hour24 = match ? Number(match[1]) : 15;
  const minute = match ? match[2] : "00";
  const period: TimePeriod = hour24 >= 12 ? "오후" : "오전";
  const hour12 = hour24 % 12 || 12;

  return {
    period,
    hour: String(hour12).padStart(2, "0"),
    minute: quarterMinutes.includes(minute as (typeof quarterMinutes)[number])
      ? minute
      : "00",
  };
}

function composeTimeValue({
  period,
  hour,
  minute,
}: {
  period: TimePeriod;
  hour: string;
  minute: string;
}) {
  const hourNumber = Number(hour);
  const hour24 =
    period === "오전"
      ? hourNumber === 12
        ? 0
        : hourNumber
      : hourNumber === 12
        ? 12
        : hourNumber + 12;

  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

function displayTimeValue(value: string) {
  if (!value) return "시간 선택";
  const parts = parseTimeParts(value);
  return `${parts.period} ${parts.hour}:${parts.minute}`;
}

function ProposalTimeField({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const parts = parseTimeParts(value);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        containerRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const updatePart = (
    patch: Partial<{ period: TimePeriod; hour: string; minute: string }>,
  ) => {
    onChange(composeTimeValue({ ...parts, ...patch }));
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative block",
        compact ? "" : "rounded-[24px] border border-black/10 bg-white px-5 py-4",
      )}
    >
      {!compact && <span className="text-sm font-black text-black">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-4 text-left text-sm font-semibold text-black outline-none transition focus:border-accent",
          compact ? "" : "mt-3",
        )}
      >
        <span>{displayTimeValue(value)}</span>
        <Clock3 size={15} className="text-black/55" aria-hidden />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 grid w-[172px] grid-cols-3 overflow-hidden rounded-sm border border-black/20 bg-white py-1 shadow-[0_16px_42px_rgba(0,0,0,0.16)]",
            compact ? "left-0 top-[calc(100%+6px)]" : "left-5 top-[calc(100%-10px)]",
          )}
        >
          <TimePickerColumn
            values={timePeriods}
            selected={parts.period}
            onSelect={(period) => updatePart({ period })}
          />
          <TimePickerColumn
            values={timeHours}
            selected={parts.hour}
            onSelect={(hour) => updatePart({ hour })}
          />
          <TimePickerColumn
            values={quarterMinutes}
            selected={parts.minute}
            onSelect={(minute) => {
              updatePart({ minute });
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function TimePickerColumn<TValue extends string>({
  values,
  selected,
  onSelect,
}: {
  values: readonly TValue[];
  selected: string;
  onSelect: (value: TValue) => void;
}) {
  return (
    <div className="max-h-[224px] overflow-y-auto px-1 scrollbar-none">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onSelect(value)}
          className={cn(
            "flex h-9 w-full items-center justify-center rounded-sm text-sm font-semibold transition",
            selected === value
              ? "bg-[#0b7cff] text-white"
              : "text-black/78 hover:bg-black/[0.04]",
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function ProposalTextarea({
  label,
  value,
  onChange,
  placeholder,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  optional?: boolean;
}) {
  return (
    <label className="block rounded-[24px] border border-black/10 bg-white px-5 py-4">
      <span className="flex items-center gap-2 text-sm font-black text-black">
        {label}
        {optional && (
          <span className="text-[10px] font-bold text-black/30">선택</span>
        )}
      </span>
      <textarea
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-3 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold leading-6 outline-none transition placeholder:text-black/25 focus:border-accent"
      />
    </label>
  );
}

function EditableHeader({
  title,
  onEdit,
}: {
  title: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-black text-black">{title}</h2>
      <button
        type="button"
        onClick={onEdit}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-black/45 transition hover:border-black/20 hover:text-black"
        aria-label={`${title} 수정`}
      >
        <PenLine size={15} aria-hidden />
      </button>
    </div>
  );
}

function EditableDetailSection({
  title,
  children,
  onEdit,
}: {
  title: string;
  children: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <section className="border-t border-black/8 py-5 first:border-t-0">
      <EditableHeader title={title} onEdit={onEdit} />
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EditChip({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-black/10 bg-black/[0.025] px-3 text-black/55 transition hover:border-black/20 hover:text-black"
    >
      <PenLine size={13} aria-hidden />
      {label}
    </button>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="grid grid-cols-[8px_minmax(0,1fr)] gap-3">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-sm font-semibold leading-6 text-black/62">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}
