"use client";

import {
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Eye,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IntersectionTicketCard } from "@/components/IntersectionTicketCard";
import { NaverPlacePicker } from "@/components/NaverPlacePicker";
import { VibeAxisBar } from "@/components/vibe/VibeGraph";
import type { VibeAxis } from "@/components/vibe/vibeGraphConfig";
import { AtmosphereDisplayEditor } from "@/features/admin/AtmosphereDisplayEditor";
import {
  normalizeMeetingAtmosphereAgeBandId,
  normalizeMeetingAtmosphereGenderMood,
} from "@/lib/meetingAtmosphere";
import {
  ticketPlaceFromLegacyFields,
  ticketPlaceFromMeetingPlace,
} from "@/lib/placePayload";
import { meetingRegionFromPlace } from "@/lib/seoulRegion";
import { defaultTicketStageCopy } from "@/lib/ticketStageCopy";
import {
  AdminMemberName,
  membershipLabel,
  profileName,
} from "@/features/admin/adminDisplay";
import type { AdminProfile } from "@/features/admin/adminProfile";
import { StoredTicketDetailView } from "@/features/app/AppHome";
import { TicketDetailContent } from "@/features/meetings/TicketDetailContent";
import { TicketDetailHero } from "@/features/meetings/TicketDetailHero";
import {
  placeVisibilities,
  placeVisibilityLabels,
  ticketVisibilities,
  ticketVisibilityLabels,
  type AdminTicketInstance,
  type AdminTicketTemplate,
  type AdminTicketWaitlistEntry,
  type PlaceVisibility,
  type TicketVisibility,
} from "@/features/admin/ticketAdminTypes";
import {
  MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
  MEETING_MAX_PARTICIPANT_COUNT,
  type GatheringTicket,
  type TicketArrivalStatus,
  type TicketMemberIntro,
  type TicketProgressStep,
  type TicketStageCopy,
  type UserTicket,
} from "@/types/ticket";
import type { MeetingPlace } from "@/types/place";
import type { Gender } from "@/types/user";

type TicketData = {
  templates: AdminTicketTemplate[];
  profiles: AdminProfile[];
  waitlist: AdminTicketWaitlistEntry[];
};

type TicketDraft = {
  templateKind: "experience" | "question_sample";
  title: string;
  shortDescription: string;
  detailSummary: string;
  detailActivities: string;
  detailFlow: string;
  detailGoodFor: string;
  detailNotice: string;
  stagePaymentPendingText: string;
  stageWaitlistedText: string;
  stageAppliedText: string;
  stageApprovedText: string;
  stagePreStartText: string;
  stageInProgressText: string;
  stageFeedbackOpenText: string;
  feedbackTitle: string;
  feedbackBody: string;
  imageUrl: string;
  moodTags: string;
  activityType: string;
  recommendationCopy: string;
  eventDate: string;
  eventTime: string;
  region: string;
  placeName: string;
  address: string;
  place: MeetingPlace | null;
  atmosphereGenderMood: string;
  atmosphereAgeBandId: string;
  operationCode: string;
  operationNote: string;
  placeVisibility: PlaceVisibility;
  visibility: TicketVisibility;
  questionOrder: string;
  remainingSeatLabelCount: string;
  minimumParticipantCount: string;
  maxParticipantCount: string;
  scoreTemperature: string;
  scoreTexture: string;
  scoreTone: string;
  scoreRhythm: string;
  scoreAlcohol: string;
  scoreRomance: string;
};

type ScoreDraftKey =
  | "scoreTemperature"
  | "scoreTexture"
  | "scoreTone"
  | "scoreRhythm"
  | "scoreAlcohol"
  | "scoreRomance";

let ticketDataCache: TicketData | null = null;
let ticketDataRequest: Promise<TicketData> | null = null;

const minuteSteps = ["00", "15", "30", "45"] as const;
const timePeriods = ["오전", "오후"] as const;
const timeHours = Array.from({ length: 12 }, (_, hour) =>
  String(hour + 1).padStart(2, "0"),
);
type TimePeriod = (typeof timePeriods)[number];
const editableTicketVisibilities = ticketVisibilities.filter(
  (visibility) => visibility !== "question" && visibility !== "invite_only",
);

const fixedDetailNotices = [
  "상세 장소는 참여 확정 후 안내돼요.",
  "결제 확인 후 대기열 등록이 완료 돼요.",
];

const scoreFields: Array<{
  key: ScoreDraftKey;
  axis: VibeAxis;
}> = [
  {
    key: "scoreTemperature",
    axis: "temperature",
  },
  {
    key: "scoreTexture",
    axis: "texture",
  },
  {
    key: "scoreTone",
    axis: "tone",
  },
  {
    key: "scoreRhythm",
    axis: "rhythm",
  },
  {
    key: "scoreAlcohol",
    axis: "alcohol",
  },
  {
    key: "scoreRomance",
    axis: "romance",
  },
];

const ticketVibeAxisOverrides: Partial<
  Record<VibeAxis, { leftLabel?: string; rightLabel?: string }>
> = {
  alcohol: {
    leftLabel: "술이 없는",
    rightLabel: "술이 있는",
  },
  romance: {
    leftLabel: "편한",
    rightLabel: "설레는",
  },
};

async function fetchTicketData(force = false) {
  if (!force && ticketDataCache) return ticketDataCache;
  if (!force && ticketDataRequest) return ticketDataRequest;

  ticketDataRequest = fetch("/api/admin/tickets", { cache: "no-store" })
    .then(async (response) => {
      const data = (await response.json().catch(() => null)) as
        | (TicketData & { error?: string })
        | null;
      if (!response.ok || !data) {
        throw new Error(data?.error ?? "tickets-load-failed");
      }
      ticketDataCache = data;
      return data;
    })
    .finally(() => {
      ticketDataRequest = null;
    });

  return ticketDataRequest;
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function lines(value: string, limit?: number) {
  const items = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return typeof limit === "number" ? items.slice(0, limit) : items;
}

function prose(value: string) {
  const text = value.trim();
  return text ? [text] : [];
}

function customNoticeLines(value: string) {
  return lines(value).filter((item) => !fixedDetailNotices.includes(item));
}

function customNoticeText(value: string) {
  return customNoticeLines(value).join("\n");
}

function tags(value: string) {
  return value
    .split("#")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function limitTagInput(value: string) {
  return value;
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

function firstNormalizedTimeValue(
  ...values: Array<string | null | undefined>
) {
  for (const value of values) {
    const normalized = normalizeTimeValue(value);
    if (normalized) return normalized;
  }
  return "";
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

function primaryInstance(template: AdminTicketTemplate | null) {
  if (!template?.instances.length) return null;

  return [...template.instances]
    .sort((left, right) => {
      const leftArchived = left.visibility === "archived" ? 1 : 0;
      const rightArchived = right.visibility === "archived" ? 1 : 0;
      return (
        leftArchived - rightArchived ||
        `${left.event_date ?? "9999"}${left.event_time ?? ""}${left.created_at}`.localeCompare(
          `${right.event_date ?? "9999"}${right.event_time ?? ""}${right.created_at}`,
        )
      );
    })
    .at(0)!;
}

function scoreDraft(value: number | null) {
  return value == null ? "" : String(value);
}

function stageCopyValue(
  stageCopy: TicketStageCopy | null | undefined,
  key: keyof TicketStageCopy,
) {
  return stageCopy?.[key] ?? defaultTicketStageCopy[key];
}

function draftFromTicket(
  template: AdminTicketTemplate,
  instance: AdminTicketInstance | null = primaryInstance(template),
): TicketDraft {

  return {
    templateKind: template.template_kind,
    title: template.title,
    shortDescription: template.short_description ?? "",
    detailSummary: template.detail_summary ?? "",
    detailActivities: template.detail_activities.join("\n"),
    detailFlow: template.detail_flow.join("\n"),
    detailGoodFor: template.detail_good_for.join("\n"),
    detailNotice: customNoticeText(template.detail_notice ?? ""),
    stagePaymentPendingText: stageCopyValue(
      template.stage_copy,
      "paymentPending",
    ),
    stageWaitlistedText: stageCopyValue(template.stage_copy, "waitlisted"),
    stageAppliedText: stageCopyValue(template.stage_copy, "applied"),
    stageApprovedText: stageCopyValue(template.stage_copy, "approved"),
    stagePreStartText: stageCopyValue(template.stage_copy, "preStart"),
    stageInProgressText: stageCopyValue(template.stage_copy, "inProgress"),
    stageFeedbackOpenText: stageCopyValue(template.stage_copy, "feedbackOpen"),
    feedbackTitle: stageCopyValue(template.stage_copy, "feedbackTitle"),
    feedbackBody: stageCopyValue(template.stage_copy, "feedbackBody"),
    imageUrl: template.image_url ?? "",
    moodTags: template.mood_tags.map((tag) => `#${tag}`).join(" "),
    activityType: template.activity_type ?? "",
    recommendationCopy: template.recommendation_copy ?? "",
    eventDate: instance?.event_date ?? "",
    eventTime: firstNormalizedTimeValue(
      instance?.event_time,
      template.default_time,
    ),
    region: instance?.region ?? template.default_region ?? "",
    placeName: instance?.place_name ?? "",
    address: instance?.address ?? "",
    place: instance?.place_payload ?? null,
    atmosphereGenderMood: template.atmosphere_gender_mood ?? "",
    atmosphereAgeBandId: template.atmosphere_age_band_id ?? "",
    operationCode: instance?.operation_code ?? "",
    operationNote: instance?.operation_note ?? "",
    placeVisibility:
      instance?.place_visibility === "hidden" ? "hidden" : "confirmed_only",
    visibility:
      template.template_kind === "question_sample"
        ? "question"
        : instance?.visibility ?? "draft",
    questionOrder: template.question_order
      ? String(template.question_order)
      : template.template_kind === "question_sample"
        ? "1"
        : "",
    remainingSeatLabelCount: String(
      instance?.remaining_seat_label_count ?? 0,
    ),
    minimumParticipantCount: String(
      instance?.minimum_participant_count ??
        MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
    ),
    maxParticipantCount: String(instance?.max_participant_count ?? 6),
    scoreTemperature: scoreDraft(template.score_temperature),
    scoreTexture: scoreDraft(template.score_texture),
    scoreTone: scoreDraft(template.score_tone),
    scoreRhythm: scoreDraft(template.score_rhythm),
    scoreAlcohol: scoreDraft(template.score_alcohol),
    scoreRomance: scoreDraft(template.score_romance),
  };
}

function stageCopyFromDraft(draft: TicketDraft): TicketStageCopy {
  return {
    paymentPending: draft.stagePaymentPendingText,
    waitlisted: draft.stageWaitlistedText,
    applied: draft.stageAppliedText,
    approved: draft.stageApprovedText,
    preStart: draft.stagePreStartText,
    inProgress: draft.stageInProgressText,
    feedbackOpen: draft.stageFeedbackOpenText,
    feedbackTitle: draft.feedbackTitle,
    feedbackBody: draft.feedbackBody,
  };
}

function ticketRequestBody(draft: TicketDraft) {
  const eventTime = normalizeTimeValue(draft.eventTime);

  return {
    templateKind: draft.templateKind,
    title: draft.title,
    shortDescription: draft.shortDescription,
    detailSummary: draft.detailSummary,
    detailActivities: prose(draft.detailActivities),
    detailFlow: [],
    detailGoodFor: lines(draft.detailGoodFor),
    detailNotice: draft.detailNotice,
    stageCopy: stageCopyFromDraft(draft),
    imageUrl: draft.imageUrl,
    moodTags: tags(draft.moodTags),
    activityType: draft.activityType,
    recommendationCopy: draft.recommendationCopy,
    defaultRegion: draft.region,
    defaultTime: eventTime,
    eventDate: draft.eventDate,
    eventTime,
    region: draft.region,
    placeName: draft.placeName,
    address: draft.address,
    place: draft.place,
    atmosphereGenderMood: draft.atmosphereGenderMood || null,
    atmosphereAgeBandId: draft.atmosphereAgeBandId || null,
    operationCode: draft.operationCode,
    operationNote: draft.operationNote,
    placeVisibility: draft.placeVisibility,
    visibility: draft.visibility,
    questionOrder:
      draft.templateKind === "question_sample" ? draft.questionOrder : null,
    remainingSeatLabelCount: draft.remainingSeatLabelCount,
    minimumParticipantCount: draft.minimumParticipantCount,
    maxParticipantCount: draft.maxParticipantCount,
    scoreTemperature: draft.scoreTemperature || null,
    scoreTexture: draft.scoreTexture || null,
    scoreTone: draft.scoreTone || null,
    scoreRhythm: draft.scoreRhythm || null,
    scoreAlcohol: draft.scoreAlcohol || null,
    scoreRomance: draft.scoreRomance || null,
  };
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

function ticketAtmospherePreview(
  draft: TicketDraft,
  template: AdminTicketTemplate | null,
): GatheringTicket["atmosphere"] {
  const ageBandOverride = normalizeMeetingAtmosphereAgeBandId(
    draft.atmosphereAgeBandId,
  );
  const genderMoodOverride = normalizeMeetingAtmosphereGenderMood(
    draft.atmosphereGenderMood,
  );

  return {
    ageBandId:
      ageBandOverride ?? template?.atmosphere_default_age_band_id ?? null,
    genderMood:
      genderMoodOverride ?? template?.atmosphere_default_gender_mood ?? null,
    defaultAgeBandId: template?.atmosphere_default_age_band_id ?? null,
    defaultGenderMood: template?.atmosphere_default_gender_mood ?? null,
    ageBandOverrideId: ageBandOverride,
    genderMoodOverride,
  };
}

function ticketPreview(
  draft: TicketDraft,
  template: AdminTicketTemplate | null,
  instance: AdminTicketInstance | null,
): GatheringTicket {
  const isSampleTicket = draft.templateKind === "question_sample";
  const shortDescription =
    draft.shortDescription.trim() || draft.recommendationCopy.trim();

  return {
    id: instance?.id ?? template?.id ?? "preview",
    templateId: template?.id ?? "preview",
    title: draft.title.trim() || "새 초대장",
    subtitle: shortDescription || "교집합 초대장",
    date: isSampleTicket ? "" : draft.eventDate,
    time: isSampleTicket
      ? ""
      : normalizeTimeValue(draft.eventTime) || "시간 미정",
    area: isSampleTicket ? "" : draft.region.trim() || "지역 미정",
    moodTags: tags(draft.moodTags),
    activityType: draft.activityType.trim() || "admin_ticket",
    imageUrl: draft.imageUrl.trim() || undefined,
    remainingSeatCount: Number.parseInt(draft.remainingSeatLabelCount, 10) || 0,
    minimumParticipantCount:
      Number.parseInt(draft.minimumParticipantCount, 10) ||
      MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
    maxParticipantCount:
      Number.parseInt(draft.maxParticipantCount, 10) ||
      MEETING_MAX_PARTICIPANT_COUNT,
    peopleHint: draft.recommendationCopy.trim() || shortDescription || "초대장",
    reason: draft.recommendationCopy.trim() || shortDescription || "초대장",
    detailSummary: draft.detailSummary.trim() || shortDescription || undefined,
    detailActivities: prose(draft.detailActivities),
    detailFlow: [],
    detailGoodFor: lines(draft.detailGoodFor),
    detailNotice: draft.detailNotice.trim() || undefined,
    place:
      ticketPlaceFromMeetingPlace(draft.place) ??
      ticketPlaceFromLegacyFields({
        placeName: draft.placeName,
        address: draft.address,
      }),
    stageCopy: stageCopyFromDraft(draft),
    atmosphere: ticketAtmospherePreview(draft, template),
    vibeScores: {
      temperature: Number.parseInt(draft.scoreTemperature, 10) || null,
      texture: Number.parseInt(draft.scoreTexture, 10) || null,
      tone: Number.parseInt(draft.scoreTone, 10) || null,
      rhythm: Number.parseInt(draft.scoreRhythm, 10) || null,
      alcohol: Number.parseInt(draft.scoreAlcohol, 10) || null,
      romance: Number.parseInt(draft.scoreRomance, 10) || null,
    },
  };
}

function profileGender(profile: AdminProfile | null | undefined): Gender | null {
  if (
    profile?.gender === "여성" ||
    profile?.gender === "남성" ||
    profile?.gender === "비공개" ||
    profile?.gender === ""
  ) {
    return profile.gender;
  }
  return null;
}

function profileEmoji(profile: AdminProfile | null | undefined) {
  return profile?.public_emoji?.trim() || "🙂";
}

function ticketStartIso(ticket: GatheringTicket) {
  if (!ticket.date || !ticket.time) return null;
  const normalizedTime = ticket.time.slice(0, 5);
  const date = new Date(`${ticket.date}T${normalizedTime}:00+09:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function addHoursIso(iso: string | null, hours: number) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function memberFromProfile({
  profile,
  fallbackDisplayName,
  fallbackIntro,
  fallbackEmoji,
  isSelf,
  arrivalStatus,
}: {
  profile: AdminProfile | null;
  fallbackDisplayName: string;
  fallbackIntro?: string | null;
  fallbackEmoji?: string | null;
  isSelf: boolean;
  arrivalStatus: TicketArrivalStatus | null;
}): TicketMemberIntro {
  return {
    id: profile?.user_id ?? `preview-${fallbackDisplayName}`,
    name: profile?.name ?? fallbackDisplayName,
    nickname: profile?.nickname ?? fallbackDisplayName,
    gender: profileGender(profile),
    emoji: profileEmoji(profile) || fallbackEmoji?.trim() || "🙂",
    publicIntro: profile?.public_intro ?? fallbackIntro ?? null,
    arrivalStatus,
    arrivalStatusUpdatedAt: arrivalStatus ? new Date().toISOString() : null,
    isSelf,
  };
}

function progressPreviewUserTicket({
  ticket,
  draft,
  assignedProfiles,
  selectedInstance,
}: {
  ticket: GatheringTicket;
  draft: TicketDraft;
  assignedProfiles: AdminProfile[];
  selectedInstance: AdminTicketInstance | null;
}): UserTicket {
  const startAt = ticketStartIso(ticket);
  const members = assignedProfiles.map((profile, index) =>
    memberFromProfile({
      profile,
      fallbackDisplayName: profileName(profile),
      isSelf: index === 0,
      arrivalStatus: index % 2 === 0 ? "on_time" : null,
    }),
  );

  return {
    id: `admin-preview:${ticket.id}`,
    waitlistId: `admin-preview:${ticket.id}`,
    ticket,
    rawStatus: "feedback_open",
    status: "feedback_open",
    statusLabel: "피드백 작성 가능",
    progressStep: "feedback",
    progressIndex: 4,
    meetingStartAt: startAt,
    arrivalOpensAt: addHoursIso(startAt, -3),
    feedbackOpensAt: addHoursIso(startAt, 3),
    canSetArrival: true,
    arrivalStatus: "on_time",
    arrivalStatusUpdatedAt: new Date().toISOString(),
    place: {
      name: selectedInstance?.place_name ?? (draft.placeName.trim() || null),
      address: selectedInstance?.address ?? (draft.address.trim() || null),
    },
    members,
  };
}

export function TicketAdminPanel({
  focusTicketId,
  onFocusTicketHandled,
}: {
  focusTicketId?: string | null;
  onFocusTicketHandled?: () => void;
}) {
  const [templates, setTemplates] = useState<AdminTicketTemplate[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [waitlist, setWaitlist] = useState<AdminTicketWaitlistEntry[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    null,
  );
  const [draft, setDraft] = useState<TicketDraft | null>(null);
  const [query, setQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressPreviewOpen, setProgressPreviewOpen] = useState(false);

  const hydrate = useCallback((data: TicketData) => {
    ticketDataCache = data;
    setTemplates(data.templates ?? []);
    setProfiles(data.profiles ?? []);
    setWaitlist(data.waitlist ?? []);
    setSelectedTicketId((current) => {
      if (current && data.templates.some((template) => template.id === current)) {
        return current;
      }
      return data.templates[0]?.id ?? null;
    });
  }, []);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      hydrate(await fetchTicketData(force));
    } catch {
      setError("티켓 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedTicket =
    templates.find((template) => template.id === selectedTicketId) ?? null;
  const selectedInstance =
    selectedTicket?.instances.find(
      (instance) => instance.id === selectedInstanceId,
    ) ?? primaryInstance(selectedTicket);

  useEffect(() => {
    if (!focusTicketId) return;
    if (!templates.some((template) => template.id === focusTicketId)) return;

    setSelectedTicketId(focusTicketId);
    onFocusTicketHandled?.();
  }, [focusTicketId, onFocusTicketHandled, templates]);

  const operatorProfiles = useMemo(
    () => profiles.filter((profile) => profile.is_test_participant === true),
    [profiles],
  );
  useEffect(() => {
    setSelectedInstanceId((current) => {
      if (
        current &&
        selectedTicket?.instances.some((instance) => instance.id === current)
      ) {
        return current;
      }
      return primaryInstance(selectedTicket)?.id ?? null;
    });
  }, [selectedTicket]);

  useEffect(() => {
    setDraft(
      selectedTicket
        ? draftFromTicket(selectedTicket, selectedInstance)
        : null,
    );
    setMemberQuery("");
    setProgressPreviewOpen(false);
  }, [selectedInstance, selectedTicket]);

  const instanceById = useMemo(() => {
    const pairs = templates.flatMap((template) =>
      template.instances.map((instance) => [instance.id, instance] as const),
    );
    return new Map(pairs);
  }, [templates]);

  const assignedProfiles = useMemo(() => {
    if (!selectedInstance) return [];
    return selectedInstance.participants
      .map((participation) => participation.profile)
      .filter((profile): profile is AdminProfile => Boolean(profile));
  }, [selectedInstance]);

  const assignableProfiles = useMemo(() => {
    if (!selectedTicket || !selectedInstance) return [];

    const assignedIds = new Set(
      selectedInstance.participants.map(
        (participation) => participation.user_id,
      ),
    );
    const candidateIds = new Set<string>();

    if (selectedInstance.visibility === "test_only") {
      for (const profile of operatorProfiles) candidateIds.add(profile.user_id);
    } else {
      for (const row of waitlist) {
        const rowInstance = row.ticket_instance_id
          ? instanceById.get(row.ticket_instance_id)
          : row.ticket_id
            ? instanceById.get(row.ticket_id)
            : null;
        const rowTemplateId = row.ticket_template_id ?? rowInstance?.template_id;
        const rowDate = row.meeting_date ?? rowInstance?.event_date;

        if (
          row.user_id &&
          rowTemplateId === selectedTicket.id &&
          rowDate === selectedInstance.event_date
        ) {
          candidateIds.add(row.user_id);
        }
      }
    }

    const normalized = memberQuery.trim().toLowerCase();
    return profiles
      .filter((profile) => candidateIds.has(profile.user_id))
      .filter((profile) => !assignedIds.has(profile.user_id))
      .filter((profile) =>
        `${profile.name ?? ""} ${profile.phone ?? ""}`
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 10);
  }, [
    instanceById,
    memberQuery,
    operatorProfiles,
    profiles,
    selectedInstance,
    selectedTicket,
    waitlist,
  ]);

  const previewTicket = draft
    ? ticketPreview(draft, selectedTicket, selectedInstance)
    : null;
  const progressPreviewTicket =
    previewTicket && draft
      ? progressPreviewUserTicket({
          ticket: previewTicket,
          draft,
          assignedProfiles,
          selectedInstance,
        })
      : null;
  const isSampleTicket =
    draft?.templateKind === "question_sample";

  const filteredTickets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return templates;
    return templates.filter((template) =>
      [
        template.title,
        template.default_region,
        template.activity_type,
        ...template.instances.map((instance) => instance.region),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, templates]);

  const applyResponse = async (response: Response, successMessage: string) => {
    const data = (await response.json().catch(() => null)) as
      | (TicketData & { error?: string })
      | null;
    if (!response.ok || !data) {
      throw new Error(data?.error ?? "ticket-action-failed");
    }
    hydrate(data);
    setNotice(successMessage);
    return data;
  };

  const runAction = async (
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown> | null,
    successMessage: string,
    queryString = "",
  ) => {
    if (saving) return null;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/tickets${queryString}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      return await applyResponse(response, successMessage);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "티켓 작업을 처리하지 못했습니다.",
      );
      return null;
    } finally {
      setSaving(false);
    }
  };

  const createTicket = async (
    templateKind: TicketDraft["templateKind"] = "experience",
  ) => {
    const sampleOnly = templateKind === "question_sample";
    const data = await runAction(
      "POST",
      {
        action: "create_ticket",
        templateKind,
        title: sampleOnly ? "새 샘플 티켓" : "새 초대장",
        visibility: sampleOnly ? "question" : "draft",
        questionOrder: sampleOnly ? "1" : null,
        placeVisibility: "confirmed_only",
        remainingSeatLabelCount: "0",
        minimumParticipantCount: String(MEETING_DEFAULT_MIN_PARTICIPANT_COUNT),
        maxParticipantCount: "6",
        eventTime: "19:00",
        region: "",
      },
      "새 초대장을 만들었습니다.",
    );
    if (data?.templates[0]) setSelectedTicketId(data.templates[0].id);
  };

  const duplicateTicket = async () => {
    if (!selectedTicket) return;

    const data = await runAction(
      "POST",
      {
        action: "duplicate_template",
        templateId: selectedTicket.id,
        includeInstances: true,
      },
      "템플릿을 복제했습니다.",
    );
    const copiedTitle = `${selectedTicket.title} 복사본`;
    setSelectedTicketId(
      data?.templates.find((template) => template.title === copiedTitle)?.id ??
        data?.templates[0]?.id ??
        selectedTicket.id,
    );
  };

  const saveTicket = async () => {
    if (!selectedTicket || !draft) return;
    if (!isSampleTicket && !selectedInstance) {
      setError("저장할 회차를 먼저 만들어주세요.");
      return;
    }
    await runAction(
      "PATCH",
      {
        entity: "ticket",
        id: selectedTicket.id,
        instanceId: selectedInstance?.id ?? null,
        ...ticketRequestBody(draft),
      },
      "초대장을 저장했습니다.",
    );
  };

  const createOccurrence = async () => {
    if (!selectedTicket) return;
    const previousIds = new Set(
      selectedTicket.instances.map((instance) => instance.id),
    );
    const data = await runAction(
      "POST",
      {
        action: "create_instance",
        templateId: selectedTicket.id,
        title: selectedTicket.title,
        eventTime: selectedTicket.default_time ?? "19:00",
        region: selectedTicket.default_region ?? "",
        visibility: "draft",
        placeVisibility: "confirmed_only",
        remainingSeatLabelCount: 0,
        minimumParticipantCount: MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
        maxParticipantCount: 6,
      },
      "새 회차를 만들었습니다.",
    );
    const nextTemplate = data?.templates.find(
      (template) => template.id === selectedTicket.id,
    );
    const created = nextTemplate?.instances.find(
      (instance) => !previousIds.has(instance.id),
    );
    if (created) setSelectedInstanceId(created.id);
  };

  const duplicateOccurrence = async () => {
    if (!selectedTicket || !selectedInstance) return;
    const previousIds = new Set(
      selectedTicket.instances.map((instance) => instance.id),
    );
    const data = await runAction(
      "POST",
      { action: "duplicate_instance", instanceId: selectedInstance.id },
      "회차를 복제했습니다.",
    );
    const nextTemplate = data?.templates.find(
      (template) => template.id === selectedTicket.id,
    );
    const created = nextTemplate?.instances.find(
      (instance) => !previousIds.has(instance.id),
    );
    if (created) setSelectedInstanceId(created.id);
  };

  const deleteOccurrence = async () => {
    if (!selectedInstance) return;
    if (!window.confirm("선택한 회차와 연결된 참여 정보를 삭제할까요?")) {
      return;
    }
    await runAction(
      "DELETE",
      null,
      "회차를 삭제했습니다.",
      `?instanceId=${encodeURIComponent(selectedInstance.id)}`,
    );
    setSelectedInstanceId(null);
  };

  const deleteTicket = async () => {
    if (!selectedTicket) return;
    const confirmed = window.confirm(
      `"${selectedTicket.title}" 초대장을 삭제할까요?\n연결된 운영 회차와 참여 정보도 함께 삭제됩니다.`,
    );
    if (!confirmed) return;

    const data = await runAction(
      "DELETE",
      null,
      "초대장을 삭제했습니다.",
      `?templateId=${encodeURIComponent(selectedTicket.id)}`,
    );
    setSelectedTicketId(data?.templates[0]?.id ?? null);
  };

  const uploadImage = async (file: File) => {
    if (!selectedTicket || !draft || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("templateId", selectedTicket.id);

      const uploadResponse = await fetch("/api/admin/tickets/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = (await uploadResponse.json().catch(() => null)) as {
        imageUrl?: string;
        error?: string;
      } | null;
      if (!uploadResponse.ok || !uploadData?.imageUrl) {
        throw new Error(uploadData?.error ?? "이미지를 업로드하지 못했습니다.");
      }

      const nextDraft = { ...draft, imageUrl: uploadData.imageUrl };
      setDraft(nextDraft);
      const saveResponse = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "ticket",
          id: selectedTicket.id,
          instanceId: selectedInstance?.id ?? null,
          ...ticketRequestBody(nextDraft),
        }),
      });
      await applyResponse(saveResponse, "대표 이미지를 교체했습니다.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "이미지를 업로드하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex h-[calc(100dvh-190px)] min-h-[720px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="shrink-0 border-b border-black/10 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">티켓 관리</h2>
            <p className="mt-1 text-xs font-semibold text-black/42">
              모임 정보, 일정, 좌석을 관리합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <IconButton
              disabled={loading || saving}
              onClick={() => void load(true)}
              icon={RefreshCw}
            >
              새로고침
            </IconButton>
            <IconButton
              disabled={saving}
              onClick={() => void createTicket("question_sample")}
              icon={Plus}
            >
              샘플 티켓
            </IconButton>
            <IconButton
              primary
              disabled={saving}
              onClick={() => void createTicket("experience")}
              icon={Plus}
            >
              초대장 만들기
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
              placeholder="제목, 활동, 지역 검색"
              className="h-10 w-full rounded-xl border border-black/10 pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </label>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {loading && templates.length === 0 ? (
              <PanelMessage>티켓 정보를 불러오는 중입니다.</PanelMessage>
            ) : filteredTickets.length ? (
              <div className="space-y-3">
                {filteredTickets.map((template) => (
                  <TicketListCard
                    key={template.id}
                    template={template}
                    selected={template.id === selectedTicketId}
                    onClick={() => setSelectedTicketId(template.id)}
                  />
                ))}
              </div>
            ) : (
              <PanelMessage>등록된 초대장이 없습니다.</PanelMessage>
            )}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-[#fbfbfa] p-5">
          {!selectedTicket || !draft ? (
            <PanelMessage>초대장을 선택하거나 새로 만들어주세요.</PanelMessage>
          ) : (
            <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)_390px] gap-5">
              <div className="min-w-0 space-y-5">
                <TicketEditorHeader
                  ticket={selectedTicket}
                  draft={draft}
                  saving={saving}
                  onDraftChange={setDraft}
                  onDuplicate={() => void duplicateTicket()}
                  onSave={() => void saveTicket()}
                  onDelete={() => void deleteTicket()}
                />

                {!isSampleTicket && (
                  <OccurrenceManager
                    instances={selectedTicket.instances}
                    selectedInstanceId={selectedInstance?.id ?? null}
                    saving={saving}
                    onSelect={setSelectedInstanceId}
                    onCreate={() => void createOccurrence()}
                    onDuplicate={() => void duplicateOccurrence()}
                    onDelete={() => void deleteOccurrence()}
                  />
                )}

                <BasicEditor
                  draft={draft}
                  saving={saving}
                  sampleOnly={isSampleTicket}
                  onDraftChange={setDraft}
                  onUploadImage={(file) => void uploadImage(file)}
                />

                {!isSampleTicket && (
                  <>
                    {previewTicket && (
                      <ContentEditor
                        draft={draft}
                        onDraftChange={setDraft}
                      />
                    )}

                    <ScoreEditor
                      draft={draft}
                      saving={saving}
                      onDraftChange={setDraft}
                    />

                    <AtmosphereDisplayEditor
                      genderMood={draft.atmosphereGenderMood}
                      ageBandId={draft.atmosphereAgeBandId}
                      defaultGenderMood={
                        selectedTicket.atmosphere_default_gender_mood
                      }
                      defaultAgeBandId={
                        selectedTicket.atmosphere_default_age_band_id
                      }
                      disabled={saving}
                      onGenderMoodChange={(atmosphereGenderMood) =>
                        setDraft({ ...draft, atmosphereGenderMood })
                      }
                      onAgeBandChange={(atmosphereAgeBandId) =>
                        setDraft({ ...draft, atmosphereAgeBandId })
                      }
                    />

                    {progressPreviewTicket && (
                      <ProgressPreviewLauncher
                        onClick={() => setProgressPreviewOpen(true)}
                      />
                    )}
                  </>
                )}

                {!isSampleTicket && selectedInstance && (
                  <ParticipantPanel
                    instance={selectedInstance}
                    assignedProfiles={assignedProfiles}
                    assignableProfiles={assignableProfiles}
                    memberQuery={memberQuery}
                    saving={saving}
                    onMemberQueryChange={setMemberQuery}
                    onAddMember={(profileId) =>
                      void runAction(
                        "POST",
                        {
                          action: "add_participant",
                          instanceId: selectedInstance.id,
                          profileId,
                        },
                        "참여를 확정했습니다.",
                      )
                    }
                    onRemoveMember={(profileId) =>
                      void runAction(
                        "DELETE",
                        null,
                        "멤버를 제거했습니다.",
                        `?instanceId=${encodeURIComponent(selectedInstance.id)}&profileId=${encodeURIComponent(profileId)}`,
                      )
                    }
                  />
                )}
              </div>

              {previewTicket && (
                <TicketPreviewPanel
                  ticket={previewTicket}
                  sampleOnly={isSampleTicket}
                />
              )}

              {progressPreviewOpen && progressPreviewTicket && (
                <AdminProgressPreviewModal
                  userTicket={progressPreviewTicket}
                  draft={draft}
                  saving={saving}
                  onDraftChange={setDraft}
                  onSave={() => void saveTicket()}
                  onClose={() => setProgressPreviewOpen(false)}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

function TicketListCard({
  template,
  selected,
  onClick,
}: {
  template: AdminTicketTemplate;
  selected: boolean;
  onClick: () => void;
}) {
  const instance = primaryInstance(template);
  const isSampleTicket = template.template_kind === "question_sample";
  const dateTime = [
    instance?.event_date,
    firstNormalizedTimeValue(instance?.event_time, template.default_time),
  ]
    .filter(Boolean)
    .join(" ");
  const region = instance?.region ?? template.default_region;

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
        {template.image_url ? (
          <img
            src={template.image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon size={22} className="text-black/25" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold">{template.title}</h3>
        <p className="mt-1 truncate text-[11px] font-semibold text-black/38">
          {isSampleTicket
            ? `샘플 ${template.question_order ?? "-"}번째`
            : `${dateTime || "일정 미정"} · ${region || "지역 미정"}`}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <VisibilityBadge visibility={instance?.visibility ?? template.visibility} />
          {template.instance_count > 1 && (
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
              회차 {template.instance_count}
            </span>
          )}
        </div>
        <p className="mt-2 text-[10px] text-black/30">
          수정 {updatedDate(template.updated_at)}
        </p>
      </div>
    </button>
  );
}

function TicketEditorHeader({
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
            invitation
          </p>
          <h3 className="mt-1 text-xl font-bold">{draft.title || "새 초대장"}</h3>
          <p className="mt-1 text-xs font-semibold text-black/42">
            {ticketVisibilityLabels[draft.visibility]} ·{" "}
            수정 {updatedDate(ticket.updated_at)}
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
            초대장 유형
          </span>
          <div className="mt-1.5 flex h-10 items-center rounded-xl border border-black/10 bg-black/[0.025] px-3 text-sm font-bold text-black/55">
            {isSampleTicket ? "샘플 티켓" : "운영 모임"}
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
            label="선택 회차 공개 상태"
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

function OccurrenceManager({
  instances,
  selectedInstanceId,
  saving,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
}: {
  instances: AdminTicketInstance[];
  selectedInstanceId: string | null;
  saving: boolean;
  onSelect: (instanceId: string) => void;
  onCreate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">운영 회차</h3>
          <p className="mt-1 text-xs font-semibold text-black/42">
            일정, 장소, 공개 범위와 참여자는 선택한 회차에만 적용됩니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <IconButton
            disabled={saving || !selectedInstanceId}
            onClick={onDuplicate}
            icon={Copy}
          >
            회차 복제
          </IconButton>
          <IconButton
            disabled={saving || !selectedInstanceId}
            onClick={onDelete}
            icon={Trash2}
          >
            회차 삭제
          </IconButton>
          <IconButton
            primary
            disabled={saving}
            onClick={onCreate}
            icon={Plus}
          >
            회차 추가
          </IconButton>
        </div>
      </div>

      {instances.length ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {instances.map((instance, index) => (
            <button
              key={instance.id}
              type="button"
              onClick={() => onSelect(instance.id)}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition",
                instance.id === selectedInstanceId
                  ? "border-accent bg-accent/10 ring-2 ring-accent/10"
                  : "border-black/10 hover:border-black/20",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black">회차 {index + 1}</span>
                <VisibilityBadge visibility={instance.visibility} />
              </div>
              <p className="mt-2 truncate text-sm font-bold">
                {[instance.event_date, instance.event_time]
                  .filter(Boolean)
                  .join(" ") || "일정 미정"}
              </p>
              <p className="mt-1 truncate text-xs font-semibold text-black/42">
                {instance.region || instance.place_name || "지역 미정"} · 참여 {instance.participant_count}명
              </p>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-black/15 py-8 text-center text-xs font-semibold text-black/35">
          운영 회차가 없습니다. 회차를 추가해 주세요.
        </p>
      )}
    </section>
  );
}

function BasicEditor({
  draft,
  saving,
  sampleOnly,
  onDraftChange,
  onUploadImage,
}: {
  draft: TicketDraft;
  saving: boolean;
  sampleOnly: boolean;
  onDraftChange: (draft: TicketDraft) => void;
  onUploadImage: (file: File) => void;
}) {
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
          <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-[#fbfbfa] px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-black/50">대표 이미지</p>
              <p className="mt-0.5 text-[11px] font-semibold text-black/35">
                {draft.imageUrl ? "오른쪽 미리보기에 반영돼요." : "이미지 없음"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-9 cursor-pointer items-center justify-center rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-black/55 transition hover:border-black/20 hover:text-black">
                이미지 선택
                <input
                  type="file"
                  accept="image/*"
                  disabled={saving}
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUploadImage(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
          <FormField
          label="분위기 태그"
          className="col-span-2"
          value={draft.moodTags}
          placeholder="#영화 #산책 #편한 대화"
            onChange={(moodTags) =>
              onDraftChange({ ...draft, moodTags: limitTagInput(moodTags) })
            }
          />
          <FormField
            label="활동 유형"
            value={draft.activityType}
            placeholder="movie"
            onChange={(activityType) =>
              onDraftChange({ ...draft, activityType })
            }
          />
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
              <NaverPlacePicker
                className="col-span-2"
                title="지도 장소"
                value={draft.place}
                onChange={(place) =>
                  onDraftChange({
                    ...draft,
                    place,
                    placeName: place?.name ?? draft.placeName,
                    address:
                      place?.roadAddress ?? place?.jibunAddress ?? draft.address,
                    region: place
                      ? meetingRegionFromPlace(place) ?? draft.region
                      : draft.region,
                    placeVisibility:
                      place && draft.placeVisibility === "hidden"
                        ? "confirmed_only"
                        : draft.placeVisibility,
                  })
                }
              />
              <FormField
                label="상세 장소명"
                value={draft.placeName}
                onChange={(placeName) => onDraftChange({ ...draft, placeName })}
              />
              <FormField
                label="상세 주소"
                className="col-span-2"
                value={draft.address}
                onChange={(address) => onDraftChange({ ...draft, address })}
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

function ContentEditor({
  draft,
  onDraftChange,
}: {
  draft: TicketDraft;
  onDraftChange: (draft: TicketDraft) => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h3 className="font-bold">상세 화면 문구</h3>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <TextAreaField
          label="한 줄 요약"
          className="col-span-2"
          value={draft.detailSummary}
          onChange={(detailSummary) =>
            onDraftChange({ ...draft, detailSummary })
          }
        />
        <TextAreaField
          label="이 자리에서는 이런 걸 해요"
          className="col-span-2"
          value={draft.detailActivities}
          placeholder="이 자리에서 함께할 활동과 이야기를 자유롭게 적어주세요."
          rows={10}
          onChange={(detailActivities) =>
            onDraftChange({ ...draft, detailActivities })
          }
        />
        <NoticeEditor
          value={draft.detailNotice}
          onChange={(detailNotice) =>
            onDraftChange({ ...draft, detailNotice })
          }
        />
      </div>
    </section>
  );
}

function NoticeEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [editableItems, setEditableItems] = useState(() => {
    const customItems = customNoticeLines(value);
    return customItems.length ? customItems : [""];
  });

  useEffect(() => {
    const customItems = customNoticeLines(value);
    setEditableItems(customItems.length ? customItems : [""]);
  }, [value]);

  const commit = (items: string[]) => {
    setEditableItems(items.length ? items : [""]);
    onChange(
      items
        .map((item) => item.trim())
        .filter((item) => item && !fixedDetailNotices.includes(item))
        .join("\n"),
    );
  };

  const updateItem = (index: number, nextValue: string) => {
    const nextItems = [...editableItems];
    nextItems[index] = nextValue;
    commit(nextItems);
  };

  const addItem = () => {
    commit([...editableItems, ""]);
  };

  const removeItem = (index: number) => {
    const nextItems = editableItems.filter((_, itemIndex) => itemIndex !== index);
    commit(nextItems.length ? nextItems : [""]);
  };

  return (
    <div className="col-span-2">
      <span className="text-xs font-semibold text-black/50">안내사항</span>
      <div className="mt-1.5 rounded-2xl border border-black/10 bg-black/[0.025] px-4 py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-accent">
          fixed
        </p>
        <div className="mt-2 space-y-2">
          {fixedDetailNotices.map((notice) => (
            <div
              key={notice}
              className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-black/62"
            >
              <Check size={14} className="shrink-0 text-accent" aria-hidden />
              <span>{notice}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {editableItems.map((item, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,1fr)_36px] items-center gap-2"
          >
            <input
              type="text"
              value={item}
              placeholder={
                index === 0
                  ? "추가 안내를 입력해요"
                  : "다음 안내를 입력해요"
              }
              onChange={(event) => updateItem(index, event.target.value)}
              className="h-10 w-full rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              disabled={editableItems.length === 1 && !item.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-black/35 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
              aria-label={`${index + 1}번 추가 안내 삭제`}
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="mt-2 inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 px-3 text-xs font-bold text-black/55 transition hover:border-black/20 hover:text-black"
      >
        <Plus size={14} aria-hidden />
        안내 추가
      </button>
    </div>
  );
}

function ProgressPreviewLauncher({ onClick }: { onClick: () => void }) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-black text-sm font-black text-white transition hover:bg-black/85"
      >
        <Eye size={16} aria-hidden />
        실제 진행상황 보기
      </button>
    </section>
  );
}

function AdminProgressPreviewModal({
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
  const [selectedProgressStep, setSelectedProgressStep] =
    useState<TicketProgressStep>(userTicket.progressStep);
  const activeCopyConfig = progressStepCopyEditorConfig[selectedProgressStep];

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
            selectedProgressStep={selectedProgressStep}
            onProgressStepChange={setSelectedProgressStep}
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
              selectedProgressStep={selectedProgressStep}
              draft={draft}
              onDraftChange={onDraftChange}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

type ProgressStepCopyDraftKey =
  | "stageAppliedText"
  | "stageApprovedText"
  | "stagePreStartText"
  | "stageInProgressText"
  | "stageFeedbackOpenText"
  | "feedbackTitle"
  | "feedbackBody";

const progressStepCopyEditorConfig: Record<
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

function ProgressStepCopyEditor({
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

function ScoreEditor({
  draft,
  saving,
  onDraftChange,
}: {
  draft: TicketDraft;
  saving: boolean;
  onDraftChange: (draft: TicketDraft) => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h3 className="font-bold">자리 분위기 점수</h3>
      <div className="mt-4 space-y-5 rounded-2xl border border-black/8 bg-black/[0.025] px-4 py-4">
        {scoreFields.map((field) => {
          const score = Number.parseInt(draft[field.key], 10);
          const hasScore =
            Number.isFinite(score) && score >= 1 && score <= 5;
          const value = hasScore ? score : 3;

          return (
            <VibeAxisBar
              key={field.key}
              axis={field.axis}
              score={hasScore ? value : null}
              axisLabelOverrides={ticketVibeAxisOverrides[field.axis]}
              valueLabel={hasScore ? `${value} / 5` : "미설정"}
              input={{
                value,
                min: 1,
                max: 5,
                step: 1,
                disabled: saving,
                onChange: (nextValue) =>
                  onDraftChange({
                    ...draft,
                    [field.key]: String(nextValue),
                  }),
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

function ParticipantPanel({
  instance,
  assignedProfiles,
  assignableProfiles,
  memberQuery,
  saving,
  onMemberQueryChange,
  onAddMember,
  onRemoveMember,
}: {
  instance: AdminTicketInstance;
  assignedProfiles: AdminProfile[];
  assignableProfiles: AdminProfile[];
  memberQuery: string;
  saving: boolean;
  onMemberQueryChange: (query: string) => void;
  onAddMember: (profileId: string) => void;
  onRemoveMember: (profileId: string) => void;
}) {
  return (
    <section className="space-y-5 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold">참여자</h3>
          <p className="mt-1 text-xs font-semibold text-black/42">
            참여 {instance.participant_count}명 · 신청 대기 {instance.waitlist_count}명
          </p>
        </div>
        <Users size={20} className="text-black/30" aria-hidden />
      </div>

      <div>
        <h4 className="text-sm font-bold">참여 상태</h4>
        <p className="mt-1 text-xs font-semibold text-black/40">
          확정 참여자를 관리합니다. 제거하면 참여 상태도 함께 취소됩니다.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {assignedProfiles.length ? (
            assignedProfiles.map((profile) => (
              <div
                key={profile.user_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-black/8 px-3 py-3"
              >
                <div className="min-w-0">
                  <AdminMemberName profile={profile} />
                  <p className="mt-1 truncate text-[11px] text-black/42">
                    {profile.gender ?? "-"} · {profile.birth_year ?? "-"} ·{" "}
                    {profile.mbti ?? "-"} · {profile.phone ?? "-"}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-accent">
                    {membershipLabel(profile)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onRemoveMember(profile.user_id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40"
                  aria-label={`${profileName(profile)} 참여 제거`}
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-black/15 py-8 text-center text-xs font-semibold text-black/35">
              아직 확정된 참여자가 없습니다.
            </p>
          )}
        </div>

        <div>
          <label className="relative block">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
              aria-hidden
            />
            <input
              value={memberQuery}
              onChange={(event) => onMemberQueryChange(event.target.value)}
              placeholder="신청자 이름 또는 전화번호 검색"
              className="h-10 w-full rounded-xl border border-black/10 pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {assignableProfiles.length ? (
              assignableProfiles.map((profile) => (
                <button
                  key={profile.user_id}
                  type="button"
                  disabled={saving}
                  onClick={() => onAddMember(profile.user_id)}
                  className="flex w-full items-center justify-between rounded-xl bg-[#f7f7f5] px-3 py-2.5 text-left hover:bg-accent/12 disabled:opacity-40"
                >
                  <div>
                    <AdminMemberName profile={profile} />
                    <p className="mt-0.5 text-[10px] text-black/40">
                      {profile.gender ?? "-"} · {profile.birth_year ?? "-"} ·{" "}
                      {profile.mbti ?? "-"} · {profile.phone ?? "-"}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-accent">
                      {membershipLabel(profile)}
                    </p>
                  </div>
                  <Plus size={15} aria-hidden />
                </button>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-black/12 px-3 py-6 text-center text-xs font-semibold leading-5 text-black/35">
                확정할 신청자가 없습니다.
              </p>
            )}
          </div>
        </div>
      </div>

    </section>
  );
}

function TicketPreviewPanel({
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

function StageCopyEditor({
  draft,
  onDraftChange,
}: {
  draft: TicketDraft;
  onDraftChange: (draft: TicketDraft) => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
        progress copy
      </p>
      <h3 className="mt-1 text-sm font-bold">실제 진행상황 문구</h3>
      <div className="mt-3 space-y-3">
        <TextAreaField
          label="결제 확인 안내"
          rows={2}
          value={draft.stagePaymentPendingText}
          onChange={(stagePaymentPendingText) =>
            onDraftChange({ ...draft, stagePaymentPendingText })
          }
        />
        <TextAreaField
          label="대기열 안내"
          rows={2}
          value={draft.stageWaitlistedText}
          onChange={(stageWaitlistedText) =>
            onDraftChange({ ...draft, stageWaitlistedText })
          }
        />
        <TextAreaField
          label="신청 완료 단계 안내"
          rows={2}
          value={draft.stageAppliedText}
          onChange={(stageAppliedText) =>
            onDraftChange({ ...draft, stageAppliedText })
          }
        />
        <TextAreaField
          label="참여 확정 안내"
          rows={2}
          value={draft.stageApprovedText}
          onChange={(stageApprovedText) =>
            onDraftChange({ ...draft, stageApprovedText })
          }
        />
        <TextAreaField
          label="시작 전 안내"
          rows={2}
          value={draft.stagePreStartText}
          onChange={(stagePreStartText) =>
            onDraftChange({ ...draft, stagePreStartText })
          }
        />
        <TextAreaField
          label="진행 중 안내"
          rows={2}
          value={draft.stageInProgressText}
          onChange={(stageInProgressText) =>
            onDraftChange({ ...draft, stageInProgressText })
          }
        />
        <TextAreaField
          label="피드백 오픈 안내"
          rows={2}
          value={draft.stageFeedbackOpenText}
          onChange={(stageFeedbackOpenText) =>
            onDraftChange({ ...draft, stageFeedbackOpenText })
          }
        />
        <TextAreaField
          label="피드백 카드 제목"
          rows={1}
          value={draft.feedbackTitle}
          onChange={(feedbackTitle) =>
            onDraftChange({ ...draft, feedbackTitle })
          }
        />
        <TextAreaField
          label="피드백 카드 본문"
          rows={3}
          value={draft.feedbackBody}
          onChange={(feedbackBody) => onDraftChange({ ...draft, feedbackBody })}
        />
      </div>
    </section>
  );
}

function VisibilityBadge({ visibility }: { visibility: TicketVisibility }) {
  return (
    <span className="shrink-0 rounded-full bg-black/[0.05] px-2.5 py-1 text-[10px] font-bold text-black/50">
      {ticketVisibilityLabels[visibility]}
    </span>
  );
}

function IconButton({
  primary = false,
  disabled,
  onClick,
  icon: Icon,
  children,
}: {
  primary?: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-40",
        primary
          ? "bg-black text-white"
          : "border border-black/10 bg-white text-black/55 hover:border-black/20 hover:text-black",
      )}
    >
      <Icon size={15} aria-hidden />
      {children}
    </button>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-accent"
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
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}) {
  return (
    <label className={className}>
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "mt-1.5 w-full resize-y rounded-xl border border-black/10 px-3 py-2 text-sm leading-5 outline-none focus:border-accent",
          rows ? "min-h-0" : "min-h-24",
        )}
      />
    </label>
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
      <div className="relative mt-1.5">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-black/10 bg-[#fbfbfa] px-3 pr-9 text-sm font-bold text-black/70 outline-none transition hover:border-black/20 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/35"
        />
      </div>
    </label>
  );
}

function PanelMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-black/15 px-5 text-center text-sm font-semibold text-black/40">
      {children}
    </div>
  );
}
