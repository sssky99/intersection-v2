"use client";

import {
  Check,
  ChevronDown,
  Clock3,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IntersectionTicketCard } from "@/components/IntersectionTicketCard";
import {
  AdminMemberName,
  membershipLabel,
  profileName,
} from "@/features/admin/adminDisplay";
import type { AdminProfile } from "@/features/admin/adminProfile";
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
import type { GatheringTicket } from "@/types/ticket";

type TicketData = {
  templates: AdminTicketTemplate[];
  profiles: AdminProfile[];
  waitlist: AdminTicketWaitlistEntry[];
};

type TicketDraft = {
  proposerUserId: string;
  title: string;
  shortDescription: string;
  detailSummary: string;
  detailActivities: string;
  detailFlow: string;
  detailGoodFor: string;
  detailNotice: string;
  imageUrl: string;
  moodTags: string;
  activityType: string;
  recommendationCopy: string;
  eventDate: string;
  eventTime: string;
  region: string;
  placeName: string;
  address: string;
  operationCode: string;
  operationNote: string;
  placeVisibility: PlaceVisibility;
  visibility: TicketVisibility;
  remainingSeatLabelCount: string;
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

const scoreValues = [1, 2, 3, 4, 5] as const;
const minuteSteps = ["00", "15", "30", "45"] as const;
const hourOptions = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);
const editableTicketVisibilities = ticketVisibilities.filter(
  (visibility) => visibility !== "question",
);

const scoreFields: Array<{
  key: ScoreDraftKey;
  label: string;
  guide: string;
}> = [
  {
    key: "scoreTemperature",
    label: "온도",
    guide: "조용함 1 / 활기참 5",
  },
  {
    key: "scoreTexture",
    label: "결",
    guide: "현실·경험 1 / 의미·아이디어 5",
  },
  {
    key: "scoreTone",
    label: "톤",
    guide: "공감 1 / 분석·해결 5",
  },
  {
    key: "scoreRhythm",
    label: "리듬",
    guide: "계획적 1 / 즉흥적 5",
  },
  {
    key: "scoreAlcohol",
    label: "술",
    guide: "술 거의 없음 1 / 술 중심 5",
  },
  {
    key: "scoreRomance",
    label: "설렘",
    guide: "편한 관계 1 / 설렘 가능성 5",
  },
];

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

function tags(value: string) {
  return value
    .split(/[#,\s]+/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 3);
}

function limitTagInput(value: string) {
  return tags(value).join(", ");
}

function splitTimeValue(value: string) {
  const [hour, minute] = value.split(":");
  return {
    hour: typeof hour === "string" && hourOptions.includes(hour) ? hour : "",
    minute:
      typeof minute === "string" &&
      minuteSteps.includes(minute as (typeof minuteSteps)[number])
        ? minute
        : "",
  };
}

function joinTimeValue(
  currentValue: string,
  patch: Partial<{ hour: string; minute: string }>,
) {
  if (patch.hour === "" || patch.minute === "") return "";

  const current = splitTimeValue(currentValue);
  const hour = patch.hour ?? current.hour;
  const minute = patch.minute ?? current.minute;
  if (!hour && !minute) return "";
  return `${hour || "00"}:${minute || "00"}`;
}

function hourLabel(hour: string) {
  const number = Number.parseInt(hour, 10);
  const period = number < 12 ? "오전" : "오후";
  const displayHour = number % 12 || 12;
  return `${period} ${String(displayHour).padStart(2, "0")}시`;
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

function draftFromTicket(template: AdminTicketTemplate): TicketDraft {
  const instance = primaryInstance(template);

  return {
    proposerUserId: template.proposer_user_id ?? "",
    title: template.title,
    shortDescription: template.short_description ?? "",
    detailSummary: template.detail_summary ?? "",
    detailActivities: template.detail_activities.join("\n"),
    detailFlow: template.detail_flow.join("\n"),
    detailGoodFor: template.detail_good_for.join("\n"),
    detailNotice: template.detail_notice ?? "",
    imageUrl: template.image_url ?? "",
    moodTags: template.mood_tags.join(", "),
    activityType: template.activity_type ?? "",
    recommendationCopy: template.recommendation_copy ?? "",
    eventDate: template.event_date ?? instance?.event_date ?? "",
    eventTime:
      template.event_time?.slice(0, 5) ??
      instance?.event_time?.slice(0, 5) ??
      template.default_time?.slice(0, 5) ??
      "",
    region: template.region ?? instance?.region ?? template.default_region ?? "",
    placeName: template.place_name ?? instance?.place_name ?? "",
    address: template.address ?? instance?.address ?? "",
    operationCode: template.operation_code ?? instance?.operation_code ?? "",
    operationNote: template.operation_note ?? instance?.operation_note ?? "",
    placeVisibility:
      template.place_visibility ?? instance?.place_visibility ?? "confirmed_only",
    visibility:
      template.visibility === "question"
        ? "public"
        : template.visibility ?? instance?.visibility ?? "draft",
    remainingSeatLabelCount: String(
      template.remaining_seat_label_count ??
        instance?.remaining_seat_label_count ??
        0,
    ),
    scoreTemperature: scoreDraft(template.score_temperature),
    scoreTexture: scoreDraft(template.score_texture),
    scoreTone: scoreDraft(template.score_tone),
    scoreRhythm: scoreDraft(template.score_rhythm),
    scoreAlcohol: scoreDraft(template.score_alcohol),
    scoreRomance: scoreDraft(template.score_romance),
  };
}

function ticketRequestBody(draft: TicketDraft) {
  return {
    proposerUserId: draft.proposerUserId,
    title: draft.title,
    shortDescription: draft.shortDescription,
    detailSummary: draft.detailSummary,
    detailActivities: lines(draft.detailActivities, 4),
    detailFlow: lines(draft.detailFlow, 6),
    detailGoodFor: lines(draft.detailGoodFor),
    detailNotice: draft.detailNotice,
    imageUrl: draft.imageUrl,
    moodTags: tags(draft.moodTags),
    activityType: draft.activityType,
    recommendationCopy: draft.recommendationCopy,
    defaultRegion: draft.region,
    defaultTime: draft.eventTime,
    eventDate: draft.eventDate,
    eventTime: draft.eventTime,
    region: draft.region,
    placeName: draft.placeName,
    address: draft.address,
    operationCode: draft.operationCode,
    operationNote: draft.operationNote,
    placeVisibility: draft.placeVisibility,
    visibility: draft.visibility,
    remainingSeatLabelCount: draft.remainingSeatLabelCount,
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

function operatorSummary(profile: AdminProfile | null | undefined) {
  if (!profile) return "제안자 미지정";
  return `${profileName(profile)} 운영자`;
}

function ticketPreview(
  draft: TicketDraft,
  template: AdminTicketTemplate | null,
  instance: AdminTicketInstance | null,
  proposer: AdminProfile | null,
): GatheringTicket {
  const proposerName =
    proposer?.name?.trim() || template?.proposer_display_name?.trim() || "운영자";
  const shortDescription =
    draft.shortDescription.trim() || draft.recommendationCopy.trim();

  return {
    id: instance?.id ?? template?.id ?? "preview",
    templateId: template?.id ?? "preview",
    title: draft.title.trim() || "새 초대장",
    subtitle: shortDescription || "교집합 초대장",
    date: draft.eventDate,
    time: draft.eventTime || "시간 미정",
    area: draft.region.trim() || "지역 미정",
    moodTags: tags(draft.moodTags),
    activityType: draft.activityType.trim() || "admin_ticket",
    imageUrl: draft.imageUrl.trim() || undefined,
    remainingSeatCount: Number.parseInt(draft.remainingSeatLabelCount, 10) || 0,
    peopleHint: draft.recommendationCopy.trim() || shortDescription || "초대장",
    reason: draft.recommendationCopy.trim() || shortDescription || "초대장",
    detailSummary: draft.detailSummary.trim() || shortDescription || undefined,
    detailActivities: lines(draft.detailActivities, 4),
    detailFlow: lines(draft.detailFlow, 6),
    detailGoodFor: lines(draft.detailGoodFor),
    detailNotice: draft.detailNotice.trim() || undefined,
    proposerLabel: `${proposerName}님이 제안한 교집합`,
    proposerProfile: {
      userId: proposer?.user_id ?? template?.proposer_user_id,
      displayName: proposerName,
      publicIntro:
        proposer?.public_intro ?? template?.proposer_public_intro ?? null,
      publicEmoji:
        proposer?.public_emoji ?? template?.proposer_public_emoji ?? null,
    },
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

export function TicketAdminPanel() {
  const [templates, setTemplates] = useState<AdminTicketTemplate[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [waitlist, setWaitlist] = useState<AdminTicketWaitlistEntry[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TicketDraft | null>(null);
  const [query, setQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const selectedInstance = primaryInstance(selectedTicket);
  const operatorProfiles = useMemo(
    () => profiles.filter((profile) => profile.is_test_participant === true),
    [profiles],
  );
  const proposer =
    operatorProfiles.find((profile) => profile.user_id === draft?.proposerUserId) ??
    profiles.find((profile) => profile.user_id === selectedTicket?.proposer_user_id) ??
    null;

  useEffect(() => {
    setDraft(selectedTicket ? draftFromTicket(selectedTicket) : null);
    setMemberQuery("");
  }, [selectedTicket]);

  const instanceById = useMemo(() => {
    const pairs = templates.flatMap((template) =>
      template.instances.map((instance) => [instance.id, instance] as const),
    );
    return new Map(pairs);
  }, [templates]);

  const assignedProfiles = useMemo(() => {
    if (!selectedInstance) return [];
    return selectedInstance.assignments
      .map((assignment) => assignment.profile)
      .filter((profile): profile is AdminProfile => Boolean(profile));
  }, [selectedInstance]);

  const assignableProfiles = useMemo(() => {
    if (!selectedTicket || !selectedInstance) return [];

    const assignedIds = new Set(
      selectedInstance.assignments.map((assignment) => assignment.profile_id),
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

  const previewTicket =
    draft && ticketPreview(draft, selectedTicket, selectedInstance, proposer);

  const filteredTickets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return templates;
    return templates.filter((template) =>
      [
        template.title,
        template.proposer_display_name,
        template.region,
        template.default_region,
        template.activity_type,
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

  const createTicket = async () => {
    const firstOperator = operatorProfiles[0];
    if (!firstOperator) {
      setError("운영자로 표시된 프로필을 먼저 만들어주세요.");
      return;
    }

    const data = await runAction(
      "POST",
      {
        action: "create_ticket",
        title: "새 초대장",
        proposerUserId: firstOperator.user_id,
        visibility: "draft",
        placeVisibility: "confirmed_only",
        remainingSeatLabelCount: "0",
        eventTime: "19:00",
        region: "",
      },
      "새 초대장을 만들었습니다.",
    );
    if (data?.templates[0]) setSelectedTicketId(data.templates[0].id);
  };

  const saveTicket = async () => {
    if (!selectedTicket || !draft) return;
    await runAction(
      "PATCH",
      {
        entity: "ticket",
        id: selectedTicket.id,
        ...ticketRequestBody(draft),
      },
      "초대장을 저장했습니다.",
    );
  };

  const deleteTicket = async () => {
    if (!selectedTicket) return;
    const confirmed = window.confirm(
      `"${selectedTicket.title}" 초대장을 삭제할까요?\n연결된 운영 티켓과 배정 정보도 함께 삭제됩니다.`,
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
              제안자, 초대장 문구, 일정과 장소를 한 티켓 안에서 관리합니다.
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
              primary
              disabled={saving}
              onClick={() => void createTicket()}
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
              placeholder="제목, 제안자, 지역 검색"
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
                  proposer={proposer}
                  operators={operatorProfiles}
                  saving={saving}
                  onDraftChange={setDraft}
                  onSave={() => void saveTicket()}
                  onDelete={() => void deleteTicket()}
                />

                <BasicEditor
                  draft={draft}
                  saving={saving}
                  onDraftChange={setDraft}
                  onUploadImage={(file) => void uploadImage(file)}
                />

                <ContentEditor
                  draft={draft}
                  onDraftChange={setDraft}
                />

                <ScoreEditor
                  draft={draft}
                  saving={saving}
                  onDraftChange={setDraft}
                />

                {selectedInstance && (
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
                          action: "add_assignment",
                          instanceId: selectedInstance.id,
                          profileId,
                        },
                        "멤버를 배정했습니다.",
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
                <TicketPreviewPanel ticket={previewTicket} />
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
  const dateTime = [
    template.event_date ?? instance?.event_date,
    (template.event_time ?? instance?.event_time)?.slice(0, 5),
  ]
    .filter(Boolean)
    .join(" ");
  const region = template.region ?? instance?.region ?? template.default_region;

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
        <p className="mt-1 truncate text-xs font-semibold text-black/42">
          {template.proposer_display_name
            ? `${template.proposer_display_name} 제안`
            : "제안자 미지정"}
        </p>
        <p className="mt-1 truncate text-[11px] font-semibold text-black/38">
          {dateTime || "일정 미정"} · {region || "지역 미정"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <VisibilityBadge visibility={template.visibility} />
          {template.instance_count > 1 && (
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
              기존 세부 {template.instance_count}
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
  proposer,
  operators,
  saving,
  onDraftChange,
  onSave,
  onDelete,
}: {
  ticket: AdminTicketTemplate;
  draft: TicketDraft;
  proposer: AdminProfile | null;
  operators: AdminProfile[];
  saving: boolean;
  onDraftChange: (draft: TicketDraft) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            invitation
          </p>
          <h3 className="mt-1 text-xl font-bold">{draft.title || "새 초대장"}</h3>
          <p className="mt-1 text-xs font-semibold text-black/42">
            {operatorSummary(proposer)} · {ticketVisibilityLabels[draft.visibility]} ·{" "}
            수정 {updatedDate(ticket.updated_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <IconButton disabled={saving} onClick={onDelete} icon={Trash2}>
            삭제
          </IconButton>
          <IconButton primary disabled={saving} onClick={onSave} icon={Check}>
            저장
          </IconButton>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <SelectField
          label="제안자"
          value={draft.proposerUserId}
          options={[
            { value: "", label: "운영자 선택" },
            ...operators.map((profile) => ({
              value: profile.user_id,
              label: `${profileName(profile)} · ${membershipLabel(profile)}`,
            })),
          ]}
          onChange={(proposerUserId) =>
            onDraftChange({ ...draft, proposerUserId })
          }
        />
        <SelectField
          label="공개 상태"
          value={draft.visibility}
          options={editableTicketVisibilities.map((value) => ({
            value,
            label: ticketVisibilityLabels[value],
          }))}
          onChange={(visibility) =>
            onDraftChange({ ...draft, visibility: visibility as TicketVisibility })
          }
        />
      </div>
    </section>
  );
}

function BasicEditor({
  draft,
  saving,
  onDraftChange,
  onUploadImage,
}: {
  draft: TicketDraft;
  saving: boolean;
  onDraftChange: (draft: TicketDraft) => void;
  onUploadImage: (file: File) => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h3 className="font-bold">기본 정보</h3>
      <div className="mt-4 grid grid-cols-[220px_minmax(0,1fr)] gap-5">
        <div>
          <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-[#f7f7f5]">
            {draft.imageUrl ? (
              <img
                src={draft.imageUrl}
                alt="티켓 대표 이미지 미리보기"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-center text-xs font-semibold text-black/35">
                <ImageIcon size={30} className="mx-auto mb-2" aria-hidden />
                대표 이미지 없음
              </div>
            )}
          </div>
          <label className="mt-3 flex h-10 cursor-pointer items-center justify-center rounded-xl border border-black/10 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black">
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

        <div className="grid grid-cols-2 gap-4">
          <TextAreaField
            label="초대장 제목"
            className="col-span-2"
            value={draft.title}
            onChange={(title) => onDraftChange({ ...draft, title })}
          />
          <FormField
            label="한 줄 설명"
            className="col-span-2"
            value={draft.shortDescription}
            onChange={(shortDescription) =>
              onDraftChange({ ...draft, shortDescription })
            }
          />
          <FormField
            label="분위기 태그"
            className="col-span-2"
            value={draft.moodTags}
            placeholder="영화, 산책, 편한 대화"
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
        </div>
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
          label="자리 분위기 초안"
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
          placeholder={"영화를 함께 보고 감상을 나눠요\n좋아하는 장면과 캐릭터 이야기를 해요"}
          onChange={(detailActivities) =>
            onDraftChange({ ...draft, detailActivities })
          }
        />
        <TextAreaField
          label="이렇게 진행돼요"
          className="col-span-2"
          value={draft.detailFlow}
          placeholder={"가볍게 인사해요\n영화를 함께 봐요\n근처에서 짧게 이야기해요"}
          onChange={(detailFlow) => onDraftChange({ ...draft, detailFlow })}
        />
        <TextAreaField
          label="잘 맞는 사람"
          value={draft.detailGoodFor}
          onChange={(detailGoodFor) =>
            onDraftChange({ ...draft, detailGoodFor })
          }
        />
        <TextAreaField
          label="안내사항"
          value={draft.detailNotice}
          onChange={(detailNotice) =>
            onDraftChange({ ...draft, detailNotice })
          }
        />
        <TextAreaField
          label="추천 문구"
          className="col-span-2"
          value={draft.recommendationCopy}
          onChange={(recommendationCopy) =>
            onDraftChange({ ...draft, recommendationCopy })
          }
        />
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
      <div className="mt-4 grid gap-3">
        {scoreFields.map((field) => {
          const selectedValue = draft[field.key];

          return (
            <div
              key={field.key}
              className="grid grid-cols-[86px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-black/8 px-3 py-3"
            >
              <div>
                <p className="text-sm font-bold text-black">{field.label}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-black/38">
                  {field.guide}
                </p>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {scoreValues.map((value) => {
                  const selected = selectedValue === String(value);

                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        onDraftChange({
                          ...draft,
                          [field.key]: selected ? "" : String(value),
                        })
                      }
                      className={cn(
                        "flex h-9 items-center justify-center rounded-lg border text-sm font-bold transition disabled:opacity-45",
                        selected
                          ? "border-black bg-black text-white"
                          : "border-black/10 bg-white text-black/55 hover:border-accent/50 hover:text-black",
                      )}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={saving || !selectedValue}
                onClick={() => onDraftChange({ ...draft, [field.key]: "" })}
                className="h-9 rounded-lg border border-black/10 px-3 text-xs font-bold text-black/42 transition hover:border-black/20 hover:text-black disabled:opacity-30"
              >
                비움
              </button>
            </div>
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
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold">참여자</h3>
          <p className="mt-1 text-xs font-semibold text-black/42">
            배정 {instance.assignment_count}명 · 대기열 {instance.waitlist_count}명
          </p>
        </div>
        <Users size={20} className="text-black/30" aria-hidden />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
                  aria-label={`${profileName(profile)} 배정 제거`}
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-black/15 py-8 text-center text-xs font-semibold text-black/35">
              아직 배정된 멤버가 없습니다.
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
              placeholder="이름 또는 전화번호 검색"
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
                추가할 후보가 없습니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TicketPreviewPanel({ ticket }: { ticket: GatheringTicket }) {
  return (
    <aside className="sticky top-5 self-start space-y-4">
      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
          ticket card
        </p>
        <IntersectionTicketCard
          title={ticket.title}
          imageUrl={ticket.imageUrl}
          date={ticket.date}
          time={ticket.time}
          location={ticket.area}
          tags={ticket.moodTags}
          proposerLabel={ticket.proposerLabel}
          remainingSeatCount={ticket.remainingSeatCount}
          className="mt-3"
        />
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-black/10 px-3 py-2 text-sm leading-5 outline-none focus:border-accent"
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
  const { hour, minute } = splitTimeValue(value);

  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <div className="relative">
          <Clock3
            size={15}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
          />
          <select
            value={hour}
            aria-label={`${label} 시간`}
            onChange={(event) =>
              onChange(joinTimeValue(value, { hour: event.target.value }))
            }
            className="h-11 w-full appearance-none rounded-xl border border-black/10 bg-[#fbfbfa] pl-9 pr-8 text-sm font-bold text-black/72 outline-none transition hover:border-black/20 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15"
          >
            <option value="">시간</option>
            {hourOptions.map((option) => (
              <option key={option} value={option}>
                {hourLabel(option)}
              </option>
            ))}
          </select>
          <ChevronDown
            size={15}
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/35"
          />
        </div>

        <div className="relative">
          <select
            value={minute}
            aria-label={`${label} 분`}
            onChange={(event) =>
              onChange(joinTimeValue(value, { minute: event.target.value }))
            }
            className="h-11 w-full appearance-none rounded-xl border border-black/10 bg-[#fbfbfa] px-3 pr-8 text-sm font-bold text-black/72 outline-none transition hover:border-black/20 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15"
          >
            <option value="">분</option>
            {minuteSteps.map((option) => (
              <option key={option} value={option}>
                {option}분
              </option>
            ))}
          </select>
          <ChevronDown
            size={15}
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/35"
          />
        </div>
      </div>
    </label>
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
