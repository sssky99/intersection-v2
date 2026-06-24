"use client";

import {
  Clock3,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { IntersectionTicketCard } from "@/components/IntersectionTicketCard";
import { VibeAxisBar } from "@/components/vibe/VibeGraph";
import { vibeAxes, type VibeScores } from "@/components/vibe/vibeGraphConfig";
import type { AdminMeetingProposal } from "@/features/admin/proposalAdminTypes";
import { TicketDetailContent } from "@/features/meetings/TicketDetailContent";
import { TicketDetailHero } from "@/features/meetings/TicketDetailHero";
import { normalizeProposalHashtags } from "@/lib/meetingProposalTags";
import { ticketPlaceFromMeetingPlace } from "@/lib/placePayload";
import {
  MEETING_MAX_PARTICIPANT_COUNT,
  MEETING_MIN_PARTICIPANT_COUNT,
  type GatheringTicket,
} from "@/types/ticket";
import {
  meetingProposalStatusLabels,
  meetingProposalStatuses,
  type MeetingProposalStatus,
} from "@/types/meetingProposal";

type ProposalResponse = {
  proposals?: AdminMeetingProposal[];
  error?: string;
};

type ProposalDraft = {
  imageUrl: string;
  title: string;
  activityDescription: string;
  eventDate: string;
  eventTime: string;
  region: string;
  specificPlace: string;
  hashtagsText: string;
  shortDescription: string;
  activitiesText: string;
  vibe: VibeScores;
  status: MeetingProposalStatus;
  adminNote: string;
  rejectionReason: string;
};

const minuteSteps = ["00", "15", "30", "45"] as const;
const timePeriods = ["오전", "오후"] as const;
const timeHours = Array.from({ length: 12 }, (_, hour) =>
  String(hour + 1).padStart(2, "0"),
);
type TimePeriod = (typeof timePeriods)[number];

const requestTypeLabels = {
  edit: "수정",
  cancel: "취소",
} as const;

const requestStatusLabels = {
  pending_review: "검수 대기",
  reviewed: "검수 완료",
  approved: "반영 완료",
  rejected: "반려",
} as const;

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function display(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function updatedDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function splitTags(value: string) {
  return normalizeProposalHashtags(value);
}

function limitTagInput(value: string) {
  return value;
}

function splitLines(value: string, limit = 5) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeTimeValue(value: string | null | undefined) {
  const match = value?.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";

  const hour = Number(match[1]);
  if (!Number.isFinite(hour)) return "";

  const minute = minuteSteps.includes(match[2] as (typeof minuteSteps)[number])
    ? match[2]
    : "00";

  return `${String(Math.max(0, Math.min(23, hour))).padStart(2, "0")}:${minute}`;
}

function parseTimeParts(value: string) {
  const match = normalizeTimeValue(value).match(/^(\d{2}):(\d{2})$/);
  const hour24 = match ? Number(match[1]) : 15;
  const minute = match ? match[2] : "00";
  const period: TimePeriod = hour24 >= 12 ? "오후" : "오전";
  const hour12 = hour24 % 12 || 12;

  return {
    period,
    hour: String(hour12).padStart(2, "0"),
    minute: minuteSteps.includes(minute as (typeof minuteSteps)[number])
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
  const normalized = normalizeTimeValue(value);
  if (!normalized) return "시간 선택";
  const parts = parseTimeParts(normalized);
  return `${parts.period} ${parts.hour}:${parts.minute}`;
}

function draftFromProposal(proposal: AdminMeetingProposal): ProposalDraft {
  return {
    imageUrl: proposal.imageUrl ?? "",
    title: proposal.title,
    activityDescription: proposal.activityDescription,
    eventDate: proposal.eventDate,
    eventTime: normalizeTimeValue(proposal.eventTime),
    region: proposal.region,
    specificPlace: proposal.specificPlace ?? "",
    hashtagsText: proposal.hashtags.map((tag) => `#${tag}`).join(" "),
    shortDescription: proposal.shortDescription,
    activitiesText: proposal.activities.join("\n"),
    vibe: proposal.vibe,
    status: proposal.status,
    adminNote: proposal.adminNote ?? "",
    rejectionReason: proposal.rejectionReason ?? "",
  };
}

function proposalPreview(
  proposal: AdminMeetingProposal,
  draft: ProposalDraft,
): GatheringTicket {
  const tags = splitTags(draft.hashtagsText);
  const summary =
    draft.shortDescription.trim() || draft.activityDescription.trim();
  const activities = splitLines(draft.activitiesText, 4);

  return {
    id: proposal.convertedInstanceId ?? proposal.id,
    templateId: proposal.convertedTemplateId ?? proposal.id,
    proposalId: proposal.id,
    title: draft.title.trim() || "제안할 교집합",
    subtitle: summary || "멤버가 제안한 교집합",
    date: draft.eventDate,
    time: normalizeTimeValue(draft.eventTime) || "시간 미정",
    area: draft.region.trim() || "지역 미정",
    moodTags: tags,
    activityType: "member_proposal",
    imageUrl: draft.imageUrl.trim() || undefined,
    remainingSeatCount: 0,
    minimumParticipantCount: MEETING_MIN_PARTICIPANT_COUNT,
    maxParticipantCount: MEETING_MAX_PARTICIPANT_COUNT,
    peopleHint: summary || "멤버 제안",
    reason: summary || "멤버 제안",
    detailSummary: summary || undefined,
    detailActivities: activities.length
      ? activities
      : splitLines(draft.activityDescription, 4),
    detailFlow: [],
    place: ticketPlaceFromMeetingPlace(proposal.place),
    proposerLabel: `${proposal.proposerProfile.displayName}님의 제안`,
    proposerProfile: {
      userId: proposal.proposerId,
      displayName: proposal.proposerProfile.displayName,
      publicIntro: proposal.proposerProfile.publicIntro,
      publicEmoji: proposal.proposerProfile.publicEmoji,
      gender: proposal.proposerProfile.gender,
      birthYear: proposal.proposerProfile.birthYear,
    },
    vibeScores: {
      temperature: draft.vibe.temperature ?? null,
      texture: draft.vibe.texture ?? null,
      tone: draft.vibe.tone ?? null,
      rhythm: draft.vibe.rhythm ?? null,
      alcohol: draft.vibe.alcohol ?? null,
      romance: draft.vibe.romance ?? null,
    },
  };
}

export function ProposalAdminPanel() {
  const [proposals, setProposals] = useState<AdminMeetingProposal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProposalDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const selectedIdRef = useRef<string | null>(null);

  const selectedProposal =
    proposals.find((proposal) => proposal.id === selectedId) ?? null;
  const previewTicket =
    selectedProposal && draft ? proposalPreview(selectedProposal, draft) : null;

  const filteredProposals = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return proposals;

    return proposals.filter((proposal) =>
      [
        proposal.title,
        proposal.region,
        proposal.proposerProfile.displayName,
        proposal.shortDescription,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [proposals, query]);

  const loadProposals = async () => {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/proposals", {
      cache: "no-store",
    }).catch(() => null);
    const data = response
      ? ((await response.json().catch(() => null)) as ProposalResponse | null)
      : null;

    if (!response?.ok || !data) {
      setError(data?.error ?? "제안 목록을 불러오지 못했습니다.");
      setLoading(false);
      return;
    }

    const nextProposals = data.proposals ?? [];
    setProposals(nextProposals);
    setSelectedId((current) => {
      if (current && nextProposals.some((proposal) => proposal.id === current)) {
        return current;
      }
      return nextProposals[0]?.id ?? null;
    });
    setLoading(false);
  };

  useEffect(() => {
    void loadProposals();
  }, []);

  useEffect(() => {
    setDraft(selectedProposal ? draftFromProposal(selectedProposal) : null);
  }, [selectedProposal]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const replaceFromResponse = (nextProposals: AdminMeetingProposal[]) => {
    setProposals(nextProposals);
    setSelectedId((current) => {
      if (current && nextProposals.some((proposal) => proposal.id === current)) {
        return current;
      }
      return nextProposals[0]?.id ?? null;
    });
  };

  const saveDraft = async ({ silent = false } = {}) => {
    if (!selectedProposal || !draft || saving || imageUploading) return false;

    setSaving(true);
    setError(null);
    if (!silent) setNotice(null);

    const response = await fetch("/api/admin/proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedProposal.id,
        imageUrl: draft.imageUrl,
        title: draft.title,
        activityDescription: draft.activityDescription,
        eventDate: draft.eventDate,
        eventTime: normalizeTimeValue(draft.eventTime),
        region: draft.region,
        specificPlace: draft.specificPlace,
        hashtags: splitTags(draft.hashtagsText),
        shortDescription: draft.shortDescription,
        activities: splitLines(draft.activitiesText, 4),
        vibe: draft.vibe,
        flow: [],
        status: draft.status,
        adminNote: draft.adminNote,
        rejectionReason: draft.rejectionReason,
      }),
    }).catch(() => null);
    const data = response
      ? ((await response.json().catch(() => null)) as ProposalResponse | null)
      : null;

    if (!response?.ok || !data?.proposals) {
      setError(data?.error ?? "제안을 저장하지 못했습니다.");
      setSaving(false);
      return false;
    }

    replaceFromResponse(data.proposals);
    if (!silent) setNotice("제안 내용을 저장했어요.");
    setSaving(false);
    return true;
  };

  const uploadImage = async (file: File) => {
    if (!selectedProposal || imageUploading) return;

    const proposalId = selectedProposal.id;
    setImageUploading(true);
    setError(null);
    setNotice(null);

    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/admin/proposals/upload", {
      method: "POST",
      body: formData,
    }).catch(() => null);
    const data = response
      ? ((await response.json().catch(() => null)) as
          | { imageUrl?: string; error?: string }
          | null)
      : null;

    if (!response?.ok || !data?.imageUrl) {
      setError(data?.error ?? "이미지를 업로드하지 못했습니다.");
      setImageUploading(false);
      return;
    }

    if (selectedIdRef.current === proposalId) {
      setDraft((current) =>
        current ? { ...current, imageUrl: data.imageUrl ?? current.imageUrl } : current,
      );
      setNotice("새 대표 이미지를 적용했어요. 저장하면 공개 티켓에 반영됩니다.");
    }
    setImageUploading(false);
  };

  const restoreOriginalImage = () => {
    if (!selectedProposal?.originalImageUrl || !draft) return;

    setDraft({ ...draft, imageUrl: selectedProposal.originalImageUrl });
    setNotice("제안자가 올린 원본 이미지로 되돌렸어요. 저장하면 공개 티켓에 반영됩니다.");
  };

  return (
    <section className="flex h-[calc(100dvh-190px)] min-h-[720px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="shrink-0 border-b border-black/10 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">제안 관리</h2>
            <p className="mt-1 text-xs font-semibold text-black/42">
              제출 즉시 공개된 제안을 검토하고, 필요한 수정·승인·비공개 처리를 진행합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <IconButton
              disabled={loading || saving}
              onClick={() => void loadProposals()}
              icon={RefreshCw}
            >
              새로고침
            </IconButton>
          </div>
        </div>

        {(notice || error) && (
          <p
            className={cn(
              "mt-3 rounded-xl px-4 py-2 text-sm font-semibold",
              error ? "bg-red-50 text-red-600" : "bg-accent/12 text-black/65",
            )}
          >
            {error ?? notice}
          </p>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[350px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-black/10">
          <label className="relative m-4 block">
            <Search
              size={16}
              aria-hidden
              className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목, 제안자, 지역 검색"
              className="h-10 w-full rounded-xl border border-black/10 pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </label>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {loading && proposals.length === 0 ? (
              <PanelMessage>제안 정보를 불러오는 중입니다.</PanelMessage>
            ) : filteredProposals.length ? (
              <div className="space-y-3">
                {filteredProposals.map((proposal) => (
                  <ProposalListCard
                    key={proposal.id}
                    proposal={proposal}
                    selected={proposal.id === selectedId}
                    onClick={() => setSelectedId(proposal.id)}
                  />
                ))}
              </div>
            ) : (
              <PanelMessage>확인할 제안이 없습니다.</PanelMessage>
            )}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-[#fbfbfa] p-5">
          {!selectedProposal || !draft ? (
            <PanelMessage>제안을 선택하면 상세 정보가 표시됩니다.</PanelMessage>
          ) : (
            <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)_390px] gap-5">
              <div className="min-w-0 space-y-5">
                <ProposalEditorHeader
                  proposal={selectedProposal}
                  draft={draft}
                  saving={saving}
                  onDraftChange={setDraft}
                  onSave={() => void saveDraft()}
                />

                <ProposalBasicEditor
                  proposal={selectedProposal}
                  draft={draft}
                  saving={saving || imageUploading}
                  onDraftChange={setDraft}
                  onImageUpload={uploadImage}
                  onRestoreOriginalImage={restoreOriginalImage}
                />

                <ProposalContentEditor
                  draft={draft}
                  onDraftChange={setDraft}
                />

                <ProposalScoreEditor
                  draft={draft}
                  saving={saving}
                  onDraftChange={setDraft}
                />

                <ProposalMetaPanel
                  proposal={selectedProposal}
                  draft={draft}
                  onDraftChange={setDraft}
                />
              </div>

              {previewTicket && <ProposalPreviewPanel ticket={previewTicket} />}
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

function ProposalListCard({
  proposal,
  selected,
  onClick,
}: {
  proposal: AdminMeetingProposal;
  selected: boolean;
  onClick: () => void;
}) {
  const dateTime = [
    proposal.eventDate,
    normalizeTimeValue(proposal.eventTime),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full gap-3 rounded-2xl border p-3 text-left transition",
        selected
          ? "border-accent bg-accent/10 ring-2 ring-accent/10"
          : "border-black/10 hover:border-black/20",
      )}
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/[0.04]">
        {proposal.imageUrl ? (
          <img
            src={proposal.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon size={22} className="text-black/25" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold">{proposal.title}</h3>
        <p className="mt-1 truncate text-xs font-semibold text-black/42">
          {proposal.proposerProfile.displayName}님의 제안
        </p>
        <p className="mt-1 truncate text-[11px] font-semibold text-black/38">
          {dateTime || "일정 미정"} · {proposal.region || "지역 미정"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={proposal.status} />
          {proposal.changeRequests.some(
            (request) => request.status === "pending_review",
          ) && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700">
              요청 있음
            </span>
          )}
        </div>
        <p className="mt-2 text-[10px] text-black/30">
          제출 {updatedDate(proposal.submittedAt)}
        </p>
      </div>
    </button>
  );
}

function ProposalEditorHeader({
  proposal,
  draft,
  saving,
  onDraftChange,
  onSave,
}: {
  proposal: AdminMeetingProposal;
  draft: ProposalDraft;
  saving: boolean;
  onDraftChange: (draft: ProposalDraft) => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            proposal
          </p>
          <h3 className="mt-1 text-xl font-bold">
            {draft.title || "멤버 제안"}
          </h3>
          <p className="mt-1 text-xs font-semibold text-black/42">
            {proposal.proposerProfile.displayName}님의 제안 ·{" "}
            {meetingProposalStatusLabels[draft.status]} · 제출{" "}
            {formatDateTime(proposal.submittedAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <IconButton
            primary
            disabled={saving}
            onClick={onSave}
            icon={saving ? Loader2 : Save}
            spin={saving}
          >
            저장
          </IconButton>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="block">
          <span className="text-xs font-semibold text-black/50">제안자</span>
          <div className="mt-1.5 flex h-11 items-center rounded-xl border border-black/10 bg-[#fbfbfa] px-3 text-sm font-bold text-black/70">
            {proposal.proposerProfile.displayName}님의 제안
          </div>
        </div>
        <SelectField
          label="상태"
          value={draft.status}
          options={meetingProposalStatuses.map((status) => ({
            value: status,
            label: meetingProposalStatusLabels[status],
          }))}
          onChange={(status) =>
            onDraftChange({
              ...draft,
              status: status as MeetingProposalStatus,
            })
          }
        />
      </div>
    </section>
  );
}

function ProposalBasicEditor({
  proposal,
  draft,
  saving,
  onDraftChange,
  onImageUpload,
  onRestoreOriginalImage,
}: {
  proposal: AdminMeetingProposal;
  draft: ProposalDraft;
  saving: boolean;
  onDraftChange: (draft: ProposalDraft) => void;
  onImageUpload: (file: File) => Promise<void>;
  onRestoreOriginalImage: () => void;
}) {
  const hasOriginalImage = Boolean(proposal.originalImageUrl);
  const isOriginalImage = draft.imageUrl === proposal.originalImageUrl;

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h3 className="font-bold">기본 정보</h3>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <TextAreaField
          label="초대장 제목"
          className="col-span-2"
          value={draft.title}
          onChange={(title) => onDraftChange({ ...draft, title })}
        />
        <div className="col-span-2">
          <span className="text-xs font-semibold text-black/50">대표 이미지</span>
          <div className="mt-1.5 flex flex-col gap-4 rounded-2xl border border-black/10 bg-[#fbfbfa] p-3 sm:flex-row sm:items-center">
            <div className="flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/[0.05] sm:w-32">
              {draft.imageUrl ? (
                <img
                  src={draft.imageUrl}
                  alt="현재 초대장 대표 이미지"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon size={22} className="text-black/25" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-black/72">
                {hasOriginalImage
                  ? "제안자가 올린 원본 이미지를 보관하고 있어요."
                  : "현재 대표 이미지를 변경할 수 있어요."}
              </p>
              <p className="mt-1 text-xs font-medium leading-5 text-black/42">
                새 이미지를 업로드해도 기존 파일은 삭제되지 않으며, 원본으로 언제든 되돌릴 수 있어요.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-black px-3 text-xs font-bold text-white transition hover:bg-black/85 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-45">
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                  ) : (
                    <ImagePlus size={14} aria-hidden />
                  )}
                  {saving ? "업로드 중" : "이미지 변경"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={saving}
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void onImageUpload(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={saving || !hasOriginalImage || isOriginalImage}
                  onClick={onRestoreOriginalImage}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-black/58 transition hover:border-black/20 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw size={14} aria-hidden />
                  원본으로 되돌리기
                </button>
              </div>
            </div>
          </div>
        </div>
        <FormField
          label="대표 이미지 URL"
          className="col-span-2"
          value={draft.imageUrl}
          placeholder="오른쪽 미리보기에 반영돼요."
          disabled={saving}
          onChange={(imageUrl) => onDraftChange({ ...draft, imageUrl })}
        />
        <FormField
          label="분위기 태그"
          className="col-span-2"
          value={draft.hashtagsText}
          placeholder="#영화관람 #토이스토리5 #강남모임"
          onChange={(hashtagsText) =>
            onDraftChange({
              ...draft,
              hashtagsText: limitTagInput(hashtagsText),
            })
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
        <FormField
          label="구체적 장소"
          value={draft.specificPlace}
          onChange={(specificPlace) =>
            onDraftChange({ ...draft, specificPlace })
          }
        />
        <TextAreaField
          label="활동 설명"
          className="col-span-2"
          value={draft.activityDescription}
          onChange={(activityDescription) =>
            onDraftChange({ ...draft, activityDescription })
          }
          disabled={saving}
        />
      </div>
    </section>
  );
}

function ProposalContentEditor({
  draft,
  onDraftChange,
}: {
  draft: ProposalDraft;
  onDraftChange: (draft: ProposalDraft) => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h3 className="font-bold">상세 화면 문구</h3>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <TextAreaField
          label="한 줄 요약"
          className="col-span-2"
          value={draft.shortDescription}
          onChange={(shortDescription) =>
            onDraftChange({ ...draft, shortDescription })
          }
        />
        <TextAreaField
          label="이 자리에서는 이런 걸 해요"
          className="col-span-2"
          value={draft.activitiesText}
          placeholder={"영화를 함께 보고 감상을 나눠요\n좋아하는 장면과 캐릭터 이야기를 해요"}
          onChange={(activitiesText) =>
            onDraftChange({ ...draft, activitiesText })
          }
        />
      </div>
    </section>
  );
}

function ProposalScoreEditor({
  draft,
  saving,
  onDraftChange,
}: {
  draft: ProposalDraft;
  saving: boolean;
  onDraftChange: (draft: ProposalDraft) => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h3 className="font-bold">자리 분위기 점수</h3>
      <div className="mt-4 space-y-5 rounded-2xl border border-black/8 bg-black/[0.025] px-4 py-4">
        {vibeAxes.map((axis) => {
          const score = Number(draft.vibe[axis] ?? 3);
          const value =
            Number.isFinite(score) && score >= 1 && score <= 5 ? score : 3;

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
                disabled: saving,
                onChange: (nextValue) =>
                  onDraftChange({
                    ...draft,
                    vibe: {
                      ...draft.vibe,
                      [axis]: nextValue,
                    },
                  }),
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

function ProposalMetaPanel({
  proposal,
  draft,
  onDraftChange,
}: {
  proposal: AdminMeetingProposal;
  draft: ProposalDraft;
  onDraftChange: (draft: ProposalDraft) => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h3 className="font-bold">제안 정보</h3>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <InfoCard
          title="제안자"
          rows={[
            ["공개 이름", proposal.proposerProfile.displayName],
            ["제출 당시 멤버십", display(proposal.proposerMembershipStatus)],
            ["현재 멤버십", display(proposal.proposerCurrentMembershipStatus)],
            ["역할 동의", proposal.proposerRoleAgreed ? "동의" : "미동의"],
          ]}
        />
        <InfoCard
          title="공개 정보"
          rows={[
            ["상태", meetingProposalStatusLabels[proposal.status]],
            ["템플릿 ID", display(proposal.convertedTemplateId)],
            ["회차 ID", display(proposal.convertedInstanceId)],
            ["공개일", formatDateTime(proposal.convertedAt)],
          ]}
        />
      </div>
      <TextAreaField
        label="관리자 메모"
        className="mt-4"
        value={draft.adminNote}
        onChange={(adminNote) => onDraftChange({ ...draft, adminNote })}
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <TextAreaField
          label="반려 사유 (선택)"
          value={draft.rejectionReason}
          placeholder="사용자에게 전달할 반려 사유를 입력해요."
          onChange={(rejectionReason) =>
            onDraftChange({ ...draft, rejectionReason })
          }
        />
        <ProposalRejectionNotificationPreview proposal={proposal} draft={draft} />
      </div>
      <ProposalChangeRequestPanel proposal={proposal} />
    </section>
  );
}

function ProposalChangeRequestPanel({
  proposal,
}: {
  proposal: AdminMeetingProposal;
}) {
  return (
    <section className="mt-4 rounded-2xl border border-black/10 bg-[#fbfbfa] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">제안자 수정 / 취소 요청</h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-black/42">
          {proposal.changeRequests.length}건
        </span>
      </div>

      {proposal.changeRequests.length === 0 ? (
        <p className="mt-3 rounded-xl bg-white px-3 py-3 text-xs font-bold leading-5 text-black/42">
          아직 접수된 수정 또는 취소 요청이 없습니다.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {proposal.changeRequests.map((request) => (
            <article
              key={request.id}
              className="rounded-xl border border-black/8 bg-white px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-black text-white">
                  {requestTypeLabels[request.type]}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-black",
                    request.status === "pending_review"
                      ? "bg-amber-50 text-amber-700"
                      : request.status === "approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : request.status === "rejected"
                          ? "bg-red-50 text-red-600"
                          : "bg-black/[0.06] text-black/45",
                  )}
                >
                  {requestStatusLabels[request.status]}
                </span>
                <span className="text-[10px] font-bold text-black/30">
                  {formatDateTime(request.createdAt)}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-line text-xs font-semibold leading-5 text-black/65">
                {request.body}
              </p>
              {request.adminNote && (
                <p className="mt-3 rounded-xl bg-black/[0.03] px-3 py-2 text-[11px] font-bold leading-5 text-black/45">
                  관리자 메모: {request.adminNote}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ProposalRejectionNotificationPreview({
  proposal,
  draft,
}: {
  proposal: AdminMeetingProposal;
  draft: ProposalDraft;
}) {
  const reason = draft.rejectionReason.trim();
  const visibleReason =
    reason || "반려 사유를 입력하면 사용자 알림에 이 영역이 표시됩니다.";
  const willNotify = draft.status === "rejected" && Boolean(reason);

  return (
    <section className="rounded-2xl border border-black/10 bg-[#fbfbfa] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent">
          알림 미리보기
        </p>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-1 text-[10px] font-black",
            willNotify
              ? "bg-emerald-50 text-emerald-700"
              : "bg-black/[0.06] text-black/38",
          )}
        >
          {willNotify ? "표시 예정" : "알림 없음"}
        </span>
      </div>
      <div className="mt-3 rounded-xl bg-white px-3 py-3 shadow-sm">
        <p className="text-sm font-black leading-5 text-black/80">
          제안 검토 결과가 도착했어요.
        </p>
        <p className="mt-1 line-clamp-1 text-xs font-bold text-black/42">
          {draft.title || proposal.title}
        </p>
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold leading-5 text-red-700">
          {visibleReason}
        </p>
      </div>
    </section>
  );
}

function ProposalPreviewPanel({ ticket }: { ticket: GatheringTicket }) {
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
            date={ticket.date}
            time={ticket.time}
            location={ticket.area}
            tags={ticket.moodTags}
            proposerLabel={ticket.proposerLabel}
            badgeLabel="✦ 나의 제안"
            badgeClassName="border-[#9ad5e3] bg-[#e8f8fc]/95 text-[#15586b] shadow-[0_10px_22px_rgba(21,88,107,0.2)]"
            remainingSeatCount={ticket.remainingSeatCount}
          />
        </div>
      </section>

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
    </aside>
  );
}

function StatusBadge({ status }: { status: MeetingProposalStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black",
        status === "converted_to_ticket"
          ? "bg-emerald-50 text-emerald-700"
          : status === "rejected"
            ? "bg-red-50 text-red-600"
            : "bg-black/[0.06] text-black/52",
      )}
    >
      {meetingProposalStatusLabels[status]}
    </span>
  );
}

function InfoCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-[#fbfbfa] p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <dl className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3">
            <dt className="text-xs font-bold text-black/35">{label}</dt>
            <dd className="min-w-0 break-words text-xs font-semibold text-black/62">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TimeSplitField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
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
    <div ref={containerRef} className="relative block">
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="mt-1.5 flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-black/10 bg-[#fbfbfa] px-3 text-left text-sm font-bold text-black/72 outline-none transition hover:border-black/20 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15"
      >
        <span>{displayTimeValue(value)}</span>
        <Clock3 size={15} className="text-black/35" aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 grid w-[196px] grid-cols-3 overflow-hidden rounded-sm border border-black/20 bg-white py-1 shadow-[0_16px_42px_rgba(0,0,0,0.16)]">
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
            values={minuteSteps}
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
            "flex h-8 w-full items-center justify-center rounded-sm text-xs font-black transition",
            selected === value
              ? "bg-[#0b7cff] text-white"
              : "text-black/55 hover:bg-black/[0.04] hover:text-black",
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-11 w-full appearance-none rounded-xl border border-black/10 bg-[#fbfbfa] px-3 pr-9 text-sm font-bold text-black/70 outline-none transition hover:border-black/20 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-11 w-full rounded-xl border border-black/10 bg-[#fbfbfa] px-3 text-sm font-bold text-black/72 outline-none transition placeholder:text-black/30 hover:border-black/20 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  className,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-1.5 w-full resize-y rounded-xl border border-black/10 bg-[#fbfbfa] px-3 py-3 text-sm font-bold leading-6 text-black/72 outline-none transition placeholder:text-black/30 hover:border-black/20 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15 disabled:opacity-60"
      />
    </label>
  );
}

function IconButton({
  primary = false,
  disabled,
  onClick,
  icon: Icon,
  spin = false,
  children,
}: {
  primary?: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: LucideIcon;
  spin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45",
        primary
          ? "bg-black text-white hover:bg-black/85"
          : "border border-black/10 bg-white text-black/58 hover:border-black/20 hover:text-black",
      )}
    >
      <Icon size={15} className={spin ? "animate-spin" : ""} aria-hidden />
      {children}
    </button>
  );
}

function PanelMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-black/10 p-6 text-center text-sm font-semibold text-black/40">
      {children}
    </div>
  );
}
