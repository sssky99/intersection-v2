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
import { NaverMapPreview } from "@/components/NaverMapPreview";
import { NaverPlacePicker } from "@/components/NaverPlacePicker";
import { VibeAxisBar } from "@/components/vibe/VibeGraph";
import {
  vibeAxes,
  type VibeScores,
} from "@/components/vibe/vibeGraphConfig";
import { TicketDetailHero } from "@/features/meetings/TicketDetailHero";
import { TicketProposerPanel } from "@/features/meetings/TicketDetailContent";
import { MeetingAtmospherePanel } from "@/features/meetings/MeetingAtmospherePanel";
import { normalizeProposalHashtags } from "@/lib/meetingProposalTags";
import {
  normalizeMeetingPlace,
  ticketPlaceFromMeetingPlace,
} from "@/lib/placePayload";
import { meetingRegionFromPlace } from "@/lib/seoulRegion";
import type {
  MeetingProposalCoverImage,
  MeetingProposalDraft,
  MeetingProposalInput,
  MeetingProposalPublicProfile,
} from "@/types/meetingProposal";
import {
  MEETING_MAX_PARTICIPANT_COUNT,
  MEETING_MIN_PARTICIPANT_COUNT,
  type GatheringTicket,
} from "@/types/ticket";

type Stage = "form" | "preview";
type EditTarget =
  | "title"
  | "image"
  | "location"
  | "datetime"
  | "hashtags"
  | "summary"
  | "activities"
  | "vibe";

type ProposalFormState = MeetingProposalInput & {
  proposerRoleAgreed: boolean;
};

type ProposalAutosaveSnapshot = {
  version: 1;
  savedAt: string;
  stage: Stage;
  form: ProposalFormState;
  draft: MeetingProposalDraft;
};

export type ProposalMemberProfile = MeetingProposalPublicProfile;

const emptyForm: ProposalFormState = {
  imageUrl: "",
  title: "",
  activityDescription: "",
  eventDate: "",
  eventTime: "18:00",
  region: "",
  specificPlace: null,
  place: null,
  coverImage: null,
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

const proposalAutosaveVersion = 1;

function freshEmptyForm(): ProposalFormState {
  return {
    ...emptyForm,
    userHashtags: [],
  };
}

function freshInitialDraft(): MeetingProposalDraft {
  return {
    ...initialDraft,
    hashtags: [],
    activities: [],
    flow: [],
    vibe: { ...initialDraft.vibe },
  };
}

function proposalAutosaveKey(profile: ProposalMemberProfile) {
  return `intersection:meeting-proposal:auto-save:v${proposalAutosaveVersion}:${profile.userId ?? profile.displayName}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeCoverImage(
  value: unknown,
): MeetingProposalCoverImage | null {
  if (!isRecord(value) || typeof value.imageUrl !== "string") return null;
  if (
    value.imageSource !== "pexels" &&
    value.imageSource !== "user_upload"
  ) {
    return null;
  }
  if (
    value.imageSelectionMethod !== "auto" &&
    value.imageSelectionMethod !== "manual"
  ) {
    return null;
  }

  return {
    imageUrl: value.imageUrl,
    imageSource: value.imageSource,
    imageSelectionMethod: value.imageSelectionMethod,
    pexelsPhotoId:
      typeof value.pexelsPhotoId === "string" ? value.pexelsPhotoId : null,
    pexelsPageUrl:
      typeof value.pexelsPageUrl === "string" ? value.pexelsPageUrl : null,
    photographer:
      typeof value.photographer === "string" ? value.photographer : null,
    photographerUrl:
      typeof value.photographerUrl === "string"
        ? value.photographerUrl
        : null,
    imageReviewModel:
      typeof value.imageReviewModel === "string"
        ? value.imageReviewModel
        : null,
  };
}

function normalizeSavedForm(value: unknown): ProposalFormState | null {
  if (!isRecord(value)) return null;

  return {
    ...freshEmptyForm(),
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : "",
    title: typeof value.title === "string" ? value.title : "",
    activityDescription:
      typeof value.activityDescription === "string"
        ? value.activityDescription
        : "",
    eventDate: typeof value.eventDate === "string" ? value.eventDate : "",
    eventTime: typeof value.eventTime === "string" ? value.eventTime : "18:00",
    region: typeof value.region === "string" ? value.region : "",
    specificPlace:
      typeof value.specificPlace === "string" ? value.specificPlace : null,
    place: normalizeMeetingPlace(value.place),
    coverImage: normalizeCoverImage(value.coverImage),
    userHashtags: stringArray(value.userHashtags),
    proposerRoleAgreed: value.proposerRoleAgreed === true,
  };
}

function normalizeSavedDraft(value: unknown): MeetingProposalDraft | null {
  if (!isRecord(value)) return null;
  const vibe = isRecord(value.vibe) ? value.vibe : {};

  return {
    ...freshInitialDraft(),
    title: typeof value.title === "string" ? value.title : "",
    shortDescription:
      typeof value.shortDescription === "string"
        ? value.shortDescription
        : "",
    hashtags: stringArray(value.hashtags),
    activities: stringArray(value.activities),
    vibe: {
      temperature:
        typeof vibe.temperature === "number" ? vibe.temperature : 3,
      texture: typeof vibe.texture === "number" ? vibe.texture : 3,
      tone: typeof vibe.tone === "number" ? vibe.tone : 3,
      rhythm: typeof vibe.rhythm === "number" ? vibe.rhythm : 3,
      alcohol: typeof vibe.alcohol === "number" ? vibe.alcohol : 2,
      romance: typeof vibe.romance === "number" ? vibe.romance : 2,
    },
    flow: stringArray(value.flow),
  };
}

function readProposalAutosave(key: string): ProposalAutosaveSnapshot | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== proposalAutosaveVersion) {
      return null;
    }

    const form = normalizeSavedForm(parsed.form);
    const draft = normalizeSavedDraft(parsed.draft);
    if (!form || !draft || !hasMeaningfulProposalDraft(form, draft)) {
      return null;
    }

    return {
      version: proposalAutosaveVersion,
      savedAt:
        typeof parsed.savedAt === "string"
          ? parsed.savedAt
          : new Date().toISOString(),
      stage: parsed.stage === "preview" ? "preview" : "form",
      form,
      draft,
    };
  } catch {
    return null;
  }
}

function hasMeaningfulProposalDraft(
  form: ProposalFormState,
  draft: MeetingProposalDraft,
) {
  return Boolean(
    form.activityDescription.trim() ||
      form.eventDate ||
      form.place ||
      form.imageUrl ||
      form.coverImage?.imageUrl ||
      draft.title.trim() ||
      draft.shortDescription.trim() ||
      draft.hashtags.length > 0 ||
      draft.activities.length > 0,
  );
}

function formFromCopiedTicket(ticket: GatheringTicket): ProposalFormState {
  const place = normalizeMeetingPlace(ticket.place);
  const activities = ticket.detailActivities?.filter(Boolean) ?? [];

  return {
    imageUrl: ticket.imageUrl ?? "",
    title: ticket.title,
    activityDescription:
      activities.join("\n") ||
      ticket.detailSummary?.trim() ||
      ticket.subtitle.trim(),
    eventDate: ticket.date,
    eventTime: cleanTime(ticket.time) || "18:00",
    region: ticket.area,
    specificPlace: place?.name ?? ticket.place?.name ?? null,
    place,
    coverImage: ticket.imageUrl
      ? {
          imageUrl: ticket.imageUrl,
          imageSource: "user_upload",
          imageSelectionMethod: "manual",
        }
      : null,
    userHashtags: ticket.moodTags,
    proposerRoleAgreed: false,
  };
}

function draftFromCopiedTicket(ticket: GatheringTicket): MeetingProposalDraft {
  const shortDescription =
    ticket.detailSummary?.trim() ||
    ticket.subtitle.trim() ||
    ticket.peopleHint.trim();
  const activities = ticket.detailActivities?.filter(Boolean) ?? [];

  return {
    title: ticket.title,
    shortDescription,
    hashtags:
      ticket.moodTags.length > 0 ? ticket.moodTags : ["취향대화"],
    activities:
      activities.length > 0
        ? activities
        : [shortDescription || "이 교집합의 경험을 함께 나눠요."],
    vibe: {
      temperature: ticket.vibeScores?.temperature ?? 3,
      texture: ticket.vibeScores?.texture ?? 3,
      tone: ticket.vibeScores?.tone ?? 3,
      rhythm: ticket.vibeScores?.rhythm ?? 3,
      alcohol: ticket.vibeScores?.alcohol ?? 2,
      romance: ticket.vibeScores?.romance ?? 2,
    },
    flow: [],
  };
}

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
    "제출 즉시 공개되며, 티켓 탭에서 바로 확인할 수 있어요.";

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
    minimumParticipantCount: MEETING_MIN_PARTICIPANT_COUNT,
    maxParticipantCount: MEETING_MAX_PARTICIPANT_COUNT,
    peopleHint: summary,
    reason: summary,
    detailSummary: summary,
    detailActivities: draft.activities,
    place: ticketPlaceFromMeetingPlace(form.place),
    proposerLabel: proposerLabel(profile),
    proposerProfile: {
      userId: profile.userId,
      displayName: profile.displayName,
      publicIntro: profile.publicIntro,
      publicEmoji: profile.publicEmoji,
      gender: profile.gender,
      birthYear: profile.birthYear,
    },
    vibeScores: draft.vibe,
  };
}

export function MeetingProposalFlow({
  profile,
  copiedTicket,
  onBack,
  onDone,
}: {
  profile: ProposalMemberProfile;
  copiedTicket?: GatheringTicket | null;
  onBack: () => void;
  onDone: () => void | Promise<void>;
}) {
  const flowRef = useRef<HTMLElement | null>(null);
  const storageKey = useMemo(() => proposalAutosaveKey(profile), [profile]);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const [autosaveRestored, setAutosaveRestored] = useState(false);
  const [stage, setStage] = useState<Stage>(
    copiedTicket ? "preview" : "form",
  );
  const [form, setForm] = useState<ProposalFormState>(() =>
    copiedTicket ? formFromCopiedTicket(copiedTicket) : freshEmptyForm(),
  );
  const [draft, setDraft] = useState<MeetingProposalDraft>(() =>
    copiedTicket ? draftFromCopiedTicket(copiedTicket) : freshInitialDraft(),
  );
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

  useEffect(() => {
    if (copiedTicket) {
      setAutosaveReady(true);
      return;
    }

    const saved = readProposalAutosave(storageKey);
    if (saved) {
      setStage(saved.stage);
      setForm(saved.form);
      setDraft(saved.draft);
      setNotice("작성 중이던 제안을 불러왔어요.");
      setAutosaveRestored(true);
    }
    setAutosaveReady(true);
  }, [copiedTicket, storageKey]);

  useEffect(() => {
    if (!autosaveReady) return;

    try {
      if (!hasMeaningfulProposalDraft(form, draft)) {
        window.localStorage.removeItem(storageKey);
        return;
      }

      const snapshot: ProposalAutosaveSnapshot = {
        version: proposalAutosaveVersion,
        savedAt: new Date().toISOString(),
        stage,
        form,
        draft,
      };

      window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch {
      // 임시저장은 보조 기능이라 실패해도 작성 흐름은 막지 않습니다.
    }
  }, [autosaveReady, draft, form, stage, storageKey]);

  const imageUrl = localImageUrl ?? form.coverImage?.imageUrl ?? form.imageUrl ?? "";
  const previewTicket = useMemo(
    () => ticketFromProposal({ form, draft, profile, imageUrl }),
    [draft, form, imageUrl, profile],
  );

  const canGenerate =
    Boolean(
      form.activityDescription.trim() &&
        form.eventDate &&
        form.eventTime &&
        form.place,
    ) && !uploading;

  useEffect(() => {
    if (!copiedTicket) return;

    const frame = window.requestAnimationFrame(() => {
      let parent = flowRef.current?.parentElement ?? null;

      while (parent) {
        const overflowY = window.getComputedStyle(parent).overflowY;
        if (
          (overflowY === "auto" || overflowY === "scroll") &&
          parent.scrollHeight > parent.clientHeight
        ) {
          parent.scrollTo({ top: 0, behavior: "auto" });
          break;
        }
        parent = parent.parentElement;
      }

      window.scrollTo({ top: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [copiedTicket]);

  const updateForm = <TKey extends keyof ProposalFormState>(
    key: TKey,
    value: ProposalFormState[TKey],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetAutosavedDraft = () => {
    window.localStorage.removeItem(storageKey);
    setLocalImageUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setForm(freshEmptyForm());
    setDraft(freshInitialDraft());
    setStage("form");
    setEditing(null);
    setError(null);
    setNotice(null);
    setAutosaveRestored(false);
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
    updateForm("coverImage", {
      imageUrl: data.imageUrl,
      imageSource: "user_upload",
      imageSelectionMethod: "manual",
    });
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
              coverImage?: MeetingProposalCoverImage | null;
              region?: string;
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
      flow: [],
    });
    if (data.coverImage && form.coverImage?.imageSource !== "user_upload") {
      updateForm("coverImage", data.coverImage);
      updateForm("imageUrl", data.coverImage.imageUrl);
    }
    if (data.region) updateForm("region", data.region);
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
        flow: [],
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

    window.localStorage.removeItem(storageKey);
    setAutosaveRestored(false);
    await onDone();
    setSubmitting(false);
  };

  return (
    <motion.section
      ref={flowRef}
      key={stage}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="min-w-0 max-w-full overflow-x-hidden pb-8"
    >
      <button
        type="button"
        onClick={
          stage === "form" || copiedTicket ? onBack : () => setStage("form")
        }
        className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black/55 shadow-sm transition hover:text-black"
        aria-label="뒤로 가기"
      >
        <ArrowLeft size={18} aria-hidden />
      </button>

      {autosaveRestored && (
        <ProposalAutosaveNotice onReset={resetAutosavedDraft} />
      )}

      {stage === "form" ? (
        <ProposalForm
          form={form}
          notice={notice}
          generating={generating}
          canGenerate={canGenerate}
          error={error}
          onChange={updateForm}
          onGenerate={() => void generateDraft()}
        />
      ) : (
        <ProposalPreview
          profile={profile}
          proposerRoleAgreed={form.proposerRoleAgreed}
          draft={draft}
          ticket={previewTicket}
          notice={notice}
          error={error}
          submitting={submitting}
          onEdit={setEditing}
          onProposerRoleAgreedChange={(agreed) =>
            updateForm("proposerRoleAgreed", agreed)
          }
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

function ProposalAutosaveNotice({ onReset }: { onReset: () => void }) {
  return (
    <section className="mt-5 rounded-2xl border border-accent/20 bg-accent/[0.08] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black leading-5 text-black">
            작성 중이던 제안을 이어서 불러왔어요.
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-black/48">
            작성 내용은 이 브라우저에 자동으로 임시저장돼요.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="h-9 shrink-0 rounded-full border border-black/10 bg-white px-3 text-xs font-black text-black/55 transition hover:border-black/20 hover:text-black"
        >
          처음부터 다시
        </button>
      </div>
    </section>
  );
}

function ProposalForm({
  form,
  notice,
  generating,
  canGenerate,
  error,
  onChange,
  onGenerate,
}: {
  form: ProposalFormState;
  notice: string | null;
  generating: boolean;
  canGenerate: boolean;
  error: string | null;
  onChange: <TKey extends keyof ProposalFormState>(
    key: TKey,
    value: ProposalFormState[TKey],
  ) => void;
  onGenerate: () => void;
}) {
  const [activityCompleted, setActivityCompleted] = useState(
    () => Boolean(form.activityDescription.trim()),
  );
  useEffect(() => {
    if (form.activityDescription.trim()) {
      setActivityCompleted(true);
    }
  }, [form.activityDescription]);

  const showDateTime = activityCompleted;
  const showPlace = showDateTime && Boolean(form.eventDate && form.eventTime);
  const showFinalStep = showPlace && Boolean(form.place);

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

      {notice && (
        <p className="mt-5 rounded-2xl bg-accent/[0.08] px-4 py-3 text-xs font-semibold leading-5 text-black/58">
          {notice}
        </p>
      )}

      <div className="mt-7 grid min-w-0 max-w-full gap-6">
        <div className="min-w-0 max-w-full space-y-5">
          <ProposalTextarea
            label="이 자리에서는 무엇을 하나요?"
            value={form.activityDescription}
            onChange={(value) => onChange("activityDescription", value)}
            placeholder="예: 전시를 보고 근처 카페에서 이야기해요."
            required
            footer={
              <button
                type="button"
                disabled={!form.activityDescription.trim()}
                onClick={() => setActivityCompleted(true)}
                className="mt-3 h-11 w-full rounded-full bg-black text-sm font-bold text-white transition disabled:bg-black/[0.15] disabled:text-black/30"
              >
                {activityCompleted ? "완료됨" : "완료"}
              </button>
            }
          />

          <AnimatePresence initial={false}>
            {showDateTime && (
              <motion.section
                key="proposal-datetime"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="rounded-[24px] border border-black/10 bg-white px-5 py-4"
              >
                <span className="flex flex-wrap items-center gap-2 text-sm font-black text-black">
                  언제 열고 싶나요?
                  <RequiredBadge />
                </span>
                <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block min-w-0">
                    <span className="sr-only">날짜</span>
                    <input
                      type="date"
                      value={form.eventDate}
                      onChange={(event) =>
                        onChange("eventDate", event.target.value)
                      }
                      className="h-12 min-w-0 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none transition focus:border-accent"
                    />
                  </label>
                  <ProposalTimeField
                    compact
                    label="시간 선택"
                    value={form.eventTime}
                    onChange={(value) => onChange("eventTime", value)}
                  />
                </div>
              </motion.section>
            )}

            {showPlace && (
              <motion.div
                key="proposal-place"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <NaverPlacePicker
                  value={form.place}
                  required
                  onChange={(place) => {
                    onChange("place", place);
                    onChange("specificPlace", place?.name ?? null);
                    onChange("region", meetingRegionFromPlace(place) ?? "");
                  }}
                />
              </motion.div>
            )}

            {showFinalStep && (
              <motion.div
                key="proposal-final-inputs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-5"
              >
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
                  {generating
                    ? "AI 초안과 대표 이미지 고르는 중..."
                    : "작성 완료하고 AI 초안 보기"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

function ProposalPreview({
  profile,
  proposerRoleAgreed,
  draft,
  ticket,
  notice,
  error,
  submitting,
  onEdit,
  onProposerRoleAgreedChange,
  onSubmit,
}: {
  profile: ProposalMemberProfile;
  proposerRoleAgreed: boolean;
  draft: MeetingProposalDraft;
  ticket: GatheringTicket;
  notice: string | null;
  error: string | null;
  submitting: boolean;
  onEdit: (target: EditTarget) => void;
  onProposerRoleAgreedChange: (agreed: boolean) => void;
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
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold">
          <EditChip label="사진" onClick={() => onEdit("image")} />
          <EditChip label="제목" onClick={() => onEdit("title")} />
          <EditChip label="장소" onClick={() => onEdit("location")} />
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

          {ticket.place && (
            <EditableDetailSection title="장소" onEdit={() => onEdit("location")}>
              <ProposalPlacePreview place={ticket.place} />
            </EditableDetailSection>
          )}

          <EditableDetailSection title="자리 분위기">
            <MeetingAtmospherePanel
              profile={ticket.atmosphere ?? ticket.proposerProfile}
            />
          </EditableDetailSection>

          <section className="border-t border-black/8 py-5">
            <h2 className="text-[15px] font-black text-black">
              이 자리를 제안한 멤버
            </h2>
            <div className="mt-4">
              <TicketProposerPanel
                profile={ticket.proposerProfile!}
                proposerLabel={ticket.proposerLabel}
                resetKey={ticket.id}
              />
            </div>
          </section>
        </div>
      </article>

      <div className="mt-6 rounded-[24px] border border-black/10 bg-white px-5 py-5">
        <p className="text-sm font-black leading-6 text-black">
          제출 후에는 직접 수정할 수 없어요.
        </p>
        <p className="mt-2 text-xs font-semibold leading-5 text-black/45">
          제출과 동시에 다른 멤버에게 공개되고 내 티켓에 신청 완료 상태로 등록돼요. 이 자리는{" "}
          {profile.displayName}님의 제안으로 준비되고,{" "}
          {profile.displayName}님은 첫 번째 멤버가 돼요.
        </p>
        <label className="mt-5 flex cursor-pointer items-start gap-3 border-t border-black/8 pt-5">
          <input
            type="checkbox"
            checked={proposerRoleAgreed}
            onChange={(event) =>
              onProposerRoleAgreedChange(event.target.checked)
            }
            className="mt-1 h-5 w-5 shrink-0 rounded border-black/20 accent-black"
          />
          <span>
            <span className="block text-sm font-black leading-6 text-black">
              이 교집합이 실제로 열리면, 제안자로서 자리를 가볍게 열어주는
              역할을 할게요.
            </span>
            <span className="mt-2 block text-xs font-semibold leading-5 text-black/45">
              어렵게 진행하는 역할은 아니에요. 처음에 제안한 이유를 한마디로
              소개하고, 대화가 자연스럽게 시작될 수 있도록 도와주는 정도예요.
            </span>
          </span>
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
          {error}
        </p>
      )}

      {!ticket.imageUrl && (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-700">
          자동 대표 이미지를 찾지 못했어요. 검은 기본 화면으로 공개되며, 사진 편집에서 직접 올려 바꿀 수 있어요.
        </p>
      )}

      <button
        type="button"
        disabled={submitting || !proposerRoleAgreed}
        onClick={onSubmit}
        className="mt-5 flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-bold text-white disabled:bg-black/[0.18] disabled:text-black/35"
      >
        {submitting ? (
          <Loader2 size={17} className="animate-spin" aria-hidden />
        ) : (
          <Check size={17} aria-hidden />
        )}
        {submitting ? "공개 중..." : "바로 공개하기"}
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
            <NaverPlacePicker
              value={form.place}
              required
              onChange={(place) => {
                onFormChange("place", place);
                onFormChange("specificPlace", place?.name ?? null);
                onFormChange("region", meetingRegionFromPlace(place) ?? "");
              }}
            />
          )}

          {target === "datetime" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

function ProposalPlacePreview({
  place,
}: {
  place: NonNullable<GatheringTicket["place"]>;
}) {
  const hasMap =
    place.source === "naver" &&
    typeof place.mapx === "number" &&
    typeof place.mapy === "number" &&
    Boolean(place.name);

  return (
    <div className="rounded-2xl border border-black/8 bg-white px-4 py-4">
      <p className="text-sm font-black text-black">{place.name}</p>
      {place.category && (
        <p className="mt-1 text-[11px] font-bold text-accent">
          {place.category}
        </p>
      )}
      {place.address && (
        <p className="mt-2 text-sm font-semibold leading-6 text-black/60">
          {place.address}
        </p>
      )}
      {hasMap && (
        <NaverMapPreview
          place={{
            name: place.name ?? "장소",
            mapx: place.mapx!,
            mapy: place.mapy!,
          }}
          className="mt-3"
          heightClassName="h-[172px]"
        />
      )}
    </div>
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

function RequiredBadge() {
  return <span className="text-[10px] font-bold text-red-500">필수</span>;
}

function parseTimeParts(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  const hour24 = match ? Number(match[1]) : 18;
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
  required = false,
  footer,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  optional?: boolean;
  required?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <label className="block rounded-[24px] border border-black/10 bg-white px-5 py-4">
      <span className="flex items-center gap-2 text-sm font-black text-black">
        {label}
        {optional && (
          <span className="text-[10px] font-bold text-black/30">선택</span>
        )}
        {required && <RequiredBadge />}
      </span>
      <textarea
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-3 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold leading-6 outline-none transition placeholder:text-black/25 focus:border-accent"
      />
      {footer}
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
  onEdit?: () => void;
}) {
  return (
    <section className="border-t border-black/8 py-5 first:border-t-0">
      {onEdit ? (
        <EditableHeader title={title} onEdit={onEdit} />
      ) : (
        <h2 className="text-[15px] font-black text-black">{title}</h2>
      )}
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
