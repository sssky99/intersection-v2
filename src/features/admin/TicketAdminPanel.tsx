"use client";

import {
  CalendarDays,
  Check,
  Copy,
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IntersectionTicketCard } from "@/components/IntersectionTicketCard";
import {
  AdminMemberName,
  profileName,
} from "@/features/admin/adminDisplay";
import type { AdminProfile } from "@/features/admin/adminProfile";
import { membershipStatusLabels } from "@/features/membership/membershipTypes";
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

type TicketData = {
  templates: AdminTicketTemplate[];
  profiles: AdminProfile[];
  waitlist: AdminTicketWaitlistEntry[];
};

let ticketDataCache: TicketData | null = null;
let ticketDataRequest: Promise<TicketData> | null = null;

type TemplateDraft = {
  title: string;
  shortDescription: string;
  detailSummary: string;
  detailActivities: string;
  detailGoodFor: string;
  detailNotice: string;
  imageUrl: string;
  moodTags: string;
  activityType: string;
  recommendationCopy: string;
  defaultRegion: string;
  defaultTime: string;
  visibility: TicketVisibility;
  questionOrder: string;
  scoreTemperature: string;
  scoreTexture: string;
  scoreTone: string;
  scoreRhythm: string;
  scoreAlcohol: string;
  scoreRomance: string;
};

type InstanceDraft = {
  title: string;
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
};

type ListMode = "templates" | "dates";
type TemplateScoreDraftKey =
  | "scoreTemperature"
  | "scoreTexture"
  | "scoreTone"
  | "scoreRhythm"
  | "scoreAlcohol"
  | "scoreRomance";

const questionOrders = [1, 2, 3, 4, 5] as const;
const scoreValues = [1, 2, 3, 4, 5] as const;
const minuteSteps = ["00", "15", "30", "45"] as const;
const timeOptions = [
  { value: "", label: "시간 선택" },
  ...Array.from({ length: 24 }, (_, hour) =>
    minuteSteps.map((minute) => {
      const value = `${String(hour).padStart(2, "0")}:${minute}`;
      const period = hour < 12 ? "오전" : "오후";
      const displayHour = hour % 12 || 12;

      return {
        value,
        label: `${period} ${String(displayHour).padStart(2, "0")}:${minute}`,
      };
    }),
  ).flat(),
];
const templateTicketVisibilities = ticketVisibilities.filter(
  (visibility) => visibility !== "question",
);
const instanceTicketVisibilities = ticketVisibilities.filter(
  (visibility) => visibility !== "question",
);

const scoreFields: Array<{
  key: TemplateScoreDraftKey;
  column:
    | "score_temperature"
    | "score_texture"
    | "score_tone"
    | "score_rhythm"
    | "score_alcohol"
    | "score_romance";
  label: string;
  shortLabel: string;
  guide: string;
}> = [
  {
    key: "scoreTemperature",
    column: "score_temperature",
    label: "온도",
    shortLabel: "온",
    guide: "조용함 1 ↔ 활기참 5",
  },
  {
    key: "scoreTexture",
    column: "score_texture",
    label: "결",
    shortLabel: "결",
    guide: "현실·경험 1 ↔ 의미·아이디어 5",
  },
  {
    key: "scoreTone",
    column: "score_tone",
    label: "톤",
    shortLabel: "톤",
    guide: "공감 1 ↔ 분석·해결 5",
  },
  {
    key: "scoreRhythm",
    column: "score_rhythm",
    label: "리듬",
    shortLabel: "리듬",
    guide: "계획적 1 ↔ 즉흥적 5",
  },
  {
    key: "scoreAlcohol",
    column: "score_alcohol",
    label: "술",
    shortLabel: "술",
    guide: "술 거의 없음 1 ↔ 술 중심 5",
  },
  {
    key: "scoreRomance",
    column: "score_romance",
    label: "설렘",
    shortLabel: "설렘",
    guide: "편한 관계 1 ↔ 설렘 가능성 5",
  },
];

const scoreGuideExamples = [
  "화덕피자: 온3 / 결2 / 톤2 / 리듬3 / 술2 / 설렘3",
  "일 얘기 밤: 온2 / 결4 / 톤4 / 리듬2 / 술2 / 설렘2",
  "전시+카페: 온2 / 결4 / 톤2 / 리듬2 / 술1 / 설렘2",
  "볼링: 온5 / 결1 / 톤2 / 리듬4 / 술2 / 설렘3",
  "망한 연애 썰: 온4 / 결3 / 톤1 / 리듬4 / 술3 / 설렘4",
  "트레일러닝: 온5 / 결2 / 톤3 / 리듬3 / 술1 / 설렘2",
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

function templateDraft(template: AdminTicketTemplate): TemplateDraft {
  return {
    title: template.title,
    shortDescription: template.short_description ?? "",
    detailSummary: template.detail_summary ?? "",
    detailActivities: template.detail_activities.join("\n"),
    detailGoodFor: template.detail_good_for.join("\n"),
    detailNotice: template.detail_notice ?? "",
    imageUrl: template.image_url ?? "",
    moodTags: template.mood_tags.join(", "),
    activityType: template.activity_type ?? "",
    recommendationCopy: template.recommendation_copy ?? "",
    defaultRegion: template.default_region ?? "",
    defaultTime: template.default_time?.slice(0, 5) ?? "",
    visibility: template.visibility === "question" ? "public" : template.visibility,
    questionOrder:
      template.question_order == null ? "" : String(template.question_order),
    scoreTemperature:
      template.score_temperature == null ? "" : String(template.score_temperature),
    scoreTexture:
      template.score_texture == null ? "" : String(template.score_texture),
    scoreTone: template.score_tone == null ? "" : String(template.score_tone),
    scoreRhythm:
      template.score_rhythm == null ? "" : String(template.score_rhythm),
    scoreAlcohol:
      template.score_alcohol == null ? "" : String(template.score_alcohol),
    scoreRomance:
      template.score_romance == null ? "" : String(template.score_romance),
  };
}

function instanceDraft(instance: AdminTicketInstance): InstanceDraft {
  return {
    title: instance.title,
    eventDate: instance.event_date ?? "",
    eventTime: instance.event_time?.slice(0, 5) ?? "",
    region: instance.region ?? "",
    placeName: instance.place_name ?? "",
    address: instance.address ?? "",
    operationCode: instance.operation_code ?? "",
    operationNote: instance.operation_note ?? "",
    placeVisibility: instance.place_visibility,
    visibility: instance.visibility,
    remainingSeatLabelCount: String(instance.remaining_seat_label_count ?? 0),
  };
}

function requestBody(draft: TemplateDraft) {
  return {
    title: draft.title,
    shortDescription: draft.shortDescription,
    detailSummary: draft.detailSummary,
    detailActivities: draft.detailActivities
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean),
    detailGoodFor: draft.detailGoodFor
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean),
    detailNotice: draft.detailNotice,
    imageUrl: draft.imageUrl,
    moodTags: draft.moodTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    activityType: draft.activityType,
    recommendationCopy: draft.recommendationCopy,
    defaultRegion: draft.defaultRegion,
    defaultTime: draft.defaultTime,
    visibility: draft.visibility,
    questionOrder: draft.questionOrder || null,
    scoreTemperature: draft.scoreTemperature || null,
    scoreTexture: draft.scoreTexture || null,
    scoreTone: draft.scoreTone || null,
    scoreRhythm: draft.scoreRhythm || null,
    scoreAlcohol: draft.scoreAlcohol || null,
    scoreRomance: draft.scoreRomance || null,
  };
}

function instanceRequestBody(draft: InstanceDraft) {
  return {
    title: draft.title,
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
  };
}

function limitTagInput(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
}

function dateTimeText(instance: AdminTicketInstance) {
  return [instance.event_date, instance.event_time?.slice(0, 5)]
    .filter(Boolean)
    .join(" ") || "일정 미정";
}

function shortDateText(value: string | null) {
  if (!value) return "날짜 미정";
  const [, month, day] = value.split("-");
  return month && day ? `${month}.${day}` : value;
}

function instanceDisplayTitle(instance: AdminTicketInstance) {
  return instance.operation_code
    ? `[${instance.operation_code}] ${instance.title}`
    : instance.title;
}

function membershipText(profile: AdminProfile) {
  return membershipStatusLabels[profile.membership_status ?? "none"];
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

function scoreSummary(template: AdminTicketTemplate) {
  const items = scoreFields
    .map((field) => {
      const value = template[field.column];
      return value == null ? null : `${field.shortLabel}${value}`;
    })
    .filter(Boolean);

  return items.length ? items.join(" · ") : "성향 점수 미입력";
}

export function TicketAdminPanel() {
  const [templates, setTemplates] = useState<AdminTicketTemplate[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [waitlist, setWaitlist] = useState<AdminTicketWaitlistEntry[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [openDateTemplateIds, setOpenDateTemplateIds] = useState<string[]>([]);
  const [listMode, setListMode] = useState<ListMode>("templates");
  const [query, setQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [templateForm, setTemplateForm] = useState<TemplateDraft | null>(null);
  const [instanceForm, setInstanceForm] = useState<InstanceDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback((data: TicketData) => {
    ticketDataCache = data;
    setTemplates(data.templates ?? []);
    setProfiles(data.profiles ?? []);
    setWaitlist(data.waitlist ?? []);
    setSelectedTemplateId((current) => {
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
      const data = await fetchTicketData(force);
      hydrate(data);
    } catch {
      setError("티켓 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? null;
  const selectedInstance =
    selectedTemplate?.instances.find(
      (instance) => instance.id === selectedInstanceId,
    ) ?? null;

  useEffect(() => {
    setTemplateForm(selectedTemplate ? templateDraft(selectedTemplate) : null);
    if (
      selectedInstanceId &&
      !selectedTemplate?.instances.some(
        (instance) => instance.id === selectedInstanceId,
      )
    ) {
      setSelectedInstanceId(null);
    }
  }, [selectedInstanceId, selectedTemplate]);

  useEffect(() => {
    setInstanceForm(selectedInstance ? instanceDraft(selectedInstance) : null);
  }, [selectedInstance]);

  const applyResponse = async (response: Response, successMessage: string) => {
    const data = (await response.json().catch(() => null)) as
      | (TicketData & { error?: string })
      | null;
    if (!response.ok || !data) {
      throw new Error(data?.error ?? "ticket-action-failed");
    }
    hydrate(data);
    setNotice(successMessage);
  };

  const runAction = async (
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown> | null,
    successMessage: string,
    queryString = "",
  ) => {
    if (saving) return false;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/tickets${queryString}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      await applyResponse(response, successMessage);
      return true;
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "티켓 작업을 처리하지 못했습니다.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const createTemplate = async () => {
    const created = await runAction(
      "POST",
      {
        action: "create_template",
        title: "새 티켓 템플릿",
        visibility: "draft",
      },
      "새 템플릿을 만들었습니다.",
    );
    if (created) setSelectedInstanceId(null);
  };

  const saveTemplate = async () => {
    if (!selectedTemplate || !templateForm) return;
    await runAction(
      "PATCH",
      {
        entity: "template",
        id: selectedTemplate.id,
        ...requestBody(templateForm),
      },
      "템플릿을 저장했습니다.",
    );
  };

  const duplicateTemplate = async () => {
    if (!selectedTemplate) return;
    const includeInstances = window.confirm(
      "세부 티켓도 함께 복제할까요?\n확인: 함께 복제 / 취소: 템플릿만 복제",
    );
    await runAction(
      "POST",
      {
        action: "duplicate_template",
        templateId: selectedTemplate.id,
        includeInstances,
      },
      "템플릿을 복제했습니다.",
    );
  };

  const deleteTemplate = async () => {
    if (!selectedTemplate) return;
    const confirmed = window.confirm(
      `"${selectedTemplate.title}" 템플릿을 삭제할까요?\n연결된 세부 티켓과 배정 정보도 함께 삭제됩니다.`,
    );
    if (!confirmed) return;

    const deleted = await runAction(
      "DELETE",
      null,
      "템플릿을 삭제했습니다.",
      `?templateId=${encodeURIComponent(selectedTemplate.id)}`,
    );
    if (deleted) setSelectedInstanceId(null);
  };

  const createInstance = async () => {
    if (!selectedTemplate) return;
    const created = await runAction(
      "POST",
      {
        action: "create_instance",
        templateId: selectedTemplate.id,
        title: selectedTemplate.title,
        eventTime: selectedTemplate.default_time?.slice(0, 5) ?? "",
        region: selectedTemplate.default_region ?? "",
        visibility: "draft",
        placeVisibility: "confirmed_only",
      },
      "세부 티켓을 만들었습니다.",
    );
    if (created) {
      const latestTemplate = templates.find(
        (template) => template.id === selectedTemplate.id,
      );
      setSelectedInstanceId(latestTemplate?.instances.at(-1)?.id ?? null);
    }
  };

  const saveInstance = async () => {
    if (!selectedInstance || !instanceForm) return;
    await runAction(
      "PATCH",
      {
        entity: "instance",
        id: selectedInstance.id,
        ...instanceRequestBody(instanceForm),
      },
      "세부 티켓을 저장했습니다.",
    );
  };

  const duplicateInstance = async () => {
    if (!selectedInstance) return;
    await runAction(
      "POST",
      { action: "duplicate_instance", instanceId: selectedInstance.id },
      "세부 티켓을 복제했습니다.",
    );
  };

  const uploadImage = async (file: File) => {
    if (!selectedTemplate || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("templateId", selectedTemplate.id);
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

      const nextForm = { ...templateForm!, imageUrl: uploadData.imageUrl };
      setTemplateForm(nextForm);
      const saveResponse = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "template",
          id: selectedTemplate.id,
          ...requestBody(nextForm),
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

  const allInstances = useMemo(
    () =>
      templates
        .flatMap((template) =>
          template.instances.map((instance) => ({ template, instance })),
        )
        .sort((left, right) =>
          `${left.instance.event_date ?? "9999"}${left.instance.event_time ?? ""}`.localeCompare(
            `${right.instance.event_date ?? "9999"}${right.instance.event_time ?? ""}`,
          ),
        ),
    [templates],
  );
  const instanceById = useMemo(
    () =>
      new Map(
        allInstances.map(({ instance, template }) => [
          instance.id,
          { instance, template },
        ]),
      ),
    [allInstances],
  );
  const dateOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allInstances
            .map(({ instance }) => instance.event_date)
            .filter((date): date is string => Boolean(date)),
        ),
      ).sort(),
    [allInstances],
  );
  const dateTemplateGroups = useMemo(
    () =>
      selectedDate
        ? templates
            .map((template) => ({
              template,
              instances: template.instances
                .filter((instance) => instance.event_date === selectedDate)
                .sort((left, right) =>
                  `${left.event_time ?? ""}${left.operation_code ?? ""}${left.title}`.localeCompare(
                    `${right.event_time ?? ""}${right.operation_code ?? ""}${right.title}`,
                  ),
                ),
            }))
            .filter((group) => group.instances.length > 0)
        : [],
    [selectedDate, templates],
  );

  useEffect(() => {
    if (listMode !== "dates") return;
    if (!dateOptions.length) {
      setSelectedDate("");
      return;
    }
    setSelectedDate((current) =>
      current && dateOptions.includes(current) ? current : dateOptions[0],
    );
  }, [dateOptions, listMode]);

  useEffect(() => {
    setOpenDateTemplateIds([]);
  }, [selectedDate]);

  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return templates;
    return templates.filter((template) =>
      `${template.title} ${template.activity_type ?? ""} ${template.default_region ?? ""}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, templates]);

  const assignableProfiles = useMemo(() => {
    if (!selectedInstance || !selectedTemplate || !selectedInstance.event_date) {
      return [];
    }
    const assignedIds = new Set(
      selectedInstance.assignments.map((assignment) => assignment.profile_id),
    );
    for (const { instance } of allInstances) {
      if (instance.event_date === selectedInstance.event_date) {
        for (const assignment of instance.assignments) {
          assignedIds.add(assignment.profile_id);
        }
      }
    }
    const candidateIds = new Set<string>();
    for (const row of waitlist) {
      const rowInstance = row.ticket_instance_id
        ? instanceById.get(row.ticket_instance_id)?.instance
        : instanceById.get(row.ticket_id)?.instance;
      const rowTemplateId =
        row.ticket_template_id ?? rowInstance?.template_id ?? null;
      const rowDate = row.meeting_date ?? rowInstance?.event_date ?? null;

      if (
        row.user_id &&
        rowDate === selectedInstance.event_date &&
        rowTemplateId === selectedTemplate.id &&
        !assignedIds.has(row.user_id)
      ) {
        candidateIds.add(row.user_id);
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
      .slice(0, 8);
  }, [
    allInstances,
    instanceById,
    memberQuery,
    profiles,
    selectedInstance,
    selectedTemplate,
    waitlist,
  ]);

  return (
    <section className="flex h-[calc(100dvh-190px)] min-h-[680px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="shrink-0 border-b border-black/10 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">티켓 관리</h2>
            <p className="mt-1 text-xs text-black/45">
              템플릿과 실제 운영 티켓, 배정 멤버를 한곳에서 관리합니다.
            </p>
            {loading && templates.length > 0 && (
              <p className="mt-1 text-[11px] font-semibold text-accent">
                새로고침 중입니다.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-[#f2f3f1] p-1">
              <ModeButton
                selected={listMode === "templates"}
                onClick={() => setListMode("templates")}
              >
                템플릿 보기
              </ModeButton>
              <ModeButton
                selected={listMode === "dates"}
                onClick={() => setListMode("dates")}
              >
                날짜별 보기
              </ModeButton>
            </div>
            <button
              type="button"
              disabled={loading || saving}
              onClick={() => void load(true)}
              className="h-10 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black disabled:opacity-40"
            >
              새로고침
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void createTemplate()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white disabled:bg-black/30"
            >
              <Plus size={16} aria-hidden />
              티켓 템플릿 만들기
            </button>
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

      <div className="grid min-h-0 flex-1 grid-cols-[390px_minmax(0,1fr)]">
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
              placeholder="템플릿 제목, 유형, 지역 검색"
              className="h-10 w-full rounded-xl border border-black/10 pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </label>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {loading && templates.length === 0 ? (
              <PanelMessage>티켓 정보를 불러오는 중입니다.</PanelMessage>
            ) : listMode === "templates" ? (
              filteredTemplates.length ? (
                <div className="space-y-3">
                  {filteredTemplates.map((template) => (
                    <TemplateListCard
                      key={template.id}
                      template={template}
                      selected={template.id === selectedTemplateId}
                      onClick={() => {
                        setSelectedTemplateId(template.id);
                        setSelectedInstanceId(null);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <PanelMessage>등록된 티켓 템플릿이 없습니다.</PanelMessage>
              )
            ) : dateOptions.length ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-black/10 bg-white p-3">
                  <p className="text-[11px] font-bold text-black/45">
                    날짜 선택
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {dateOptions.map((date) => (
                      <button
                        key={date}
                        type="button"
                        onClick={() => setSelectedDate(date)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-left text-xs font-bold transition",
                          selectedDate === date
                            ? "border-accent bg-accent/12 text-black"
                            : "border-black/10 text-black/45 hover:border-black/20",
                        )}
                      >
                        {date}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedDate && dateTemplateGroups.length ? (
                  <div className="space-y-2">
                    {dateTemplateGroups.map(({ template, instances }) => {
                      const open = openDateTemplateIds.includes(template.id);
                      const assignmentCount = instances.reduce(
                        (sum, instance) => sum + instance.assignment_count,
                        0,
                      );
                      const waitlistCount = instances.reduce(
                        (sum, instance) => sum + instance.waitlist_count,
                        0,
                      );

                      return (
                        <section
                          key={template.id}
                          className="overflow-hidden rounded-2xl border border-black/10 bg-white"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDateTemplateIds((current) =>
                                current.includes(template.id)
                                  ? current.filter((id) => id !== template.id)
                                  : [...current, template.id],
                              )
                            }
                            className="w-full px-4 py-3 text-left transition hover:bg-black/[0.02]"
                          >
                            <h3 className="text-sm font-bold text-black">
                              {template.title}
                            </h3>
                            <p className="mt-1 text-[11px] font-semibold text-black/42">
                              세부 {instances.length}개 · 배정 {assignmentCount}명 · 신청{" "}
                              {waitlistCount}명
                            </p>
                          </button>

                          {open && (
                            <div className="border-t border-black/8 p-2">
                              {instances.map((instance) => (
                                <button
                                  key={instance.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedTemplateId(template.id);
                                    setSelectedInstanceId(instance.id);
                                  }}
                                  className={cn(
                                    "w-full rounded-xl px-3 py-2.5 text-left transition",
                                    instance.id === selectedInstanceId
                                      ? "bg-accent/12"
                                      : "hover:bg-black/[0.03]",
                                  )}
                                >
                                  <p className="text-xs font-bold text-black">
                                    {instanceDisplayTitle(instance)}
                                  </p>
                                  <p className="mt-1 text-[11px] font-semibold text-black/42">
                                    {instance.event_time?.slice(0, 5) ?? "시간 미정"} ·{" "}
                                    {instance.region ?? "지역 미정"} · 배정{" "}
                                    {instance.assignment_count}명
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <PanelMessage>
                    해당 날짜에 등록된 티켓이 없습니다.
                  </PanelMessage>
                )}
              </div>
            ) : (
              <PanelMessage>등록된 세부 티켓이 없습니다.</PanelMessage>
            )}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-[#fbfbfa] p-5">
          {!selectedTemplate || !templateForm ? (
            <PanelMessage>템플릿을 선택하거나 새로 만들어주세요.</PanelMessage>
          ) : selectedInstance && instanceForm ? (
            <InstanceEditor
              template={selectedTemplate}
              instance={selectedInstance}
              draft={instanceForm}
              profiles={assignableProfiles}
              memberQuery={memberQuery}
              saving={saving}
              onDraftChange={setInstanceForm}
              onMemberQueryChange={setMemberQuery}
              onBack={() => setSelectedInstanceId(null)}
              onSave={() => void saveInstance()}
              onDuplicate={() => void duplicateInstance()}
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
          ) : (
            <TemplateEditor
              template={selectedTemplate}
              draft={templateForm}
              saving={saving}
              onDraftChange={setTemplateForm}
              onSave={() => void saveTemplate()}
              onDuplicate={() => void duplicateTemplate()}
              onDelete={() => void deleteTemplate()}
              onCreateInstance={() => void createInstance()}
              onSelectInstance={setSelectedInstanceId}
              onUploadImage={(file) => void uploadImage(file)}
            />
          )}
        </main>
      </div>
    </section>
  );
}

function TemplateListCard({
  template,
  selected,
  onClick,
}: {
  template: AdminTicketTemplate;
  selected: boolean;
  onClick: () => void;
}) {
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
          {template.activity_type || "유형 미정"} ·{" "}
          {template.default_region || "지역 미정"}
        </p>
        <p className="mt-2 text-[11px] font-semibold text-accent">
          {ticketVisibilityLabels[template.visibility]}
        </p>
        <p className="mt-1 truncate text-[10px] font-semibold text-black/40">
          {scoreSummary(template)}
        </p>
        <p className="mt-1 text-[10px] text-black/38">
          세부 {template.instance_count} · 배정 {template.assignment_count} · 대기열{" "}
          {template.waitlist_count}
        </p>
        <p className="mt-1 text-[10px] text-black/30">
          수정 {updatedDate(template.updated_at)}
        </p>
      </div>
    </button>
  );
}

function TemplateEditor({
  template,
  draft,
  saving,
  onDraftChange,
  onSave,
  onDuplicate,
  onDelete,
  onCreateInstance,
  onSelectInstance,
  onUploadImage,
}: {
  template: AdminTicketTemplate;
  draft: TemplateDraft;
  saving: boolean;
  onDraftChange: (draft: TemplateDraft) => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCreateInstance: () => void;
  onSelectInstance: (id: string) => void;
  onUploadImage: (file: File) => void;
}) {
  return (
    <div className="mx-auto max-w-[980px] space-y-5">
      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
              ticket template
            </p>
            <h3 className="mt-1 text-xl font-bold">템플릿 상세</h3>
          </div>
          <div className="flex gap-2">
            <ActionButton disabled={saving} onClick={onDelete} icon={Trash2}>
              삭제
            </ActionButton>
            <ActionButton disabled={saving} onClick={onDuplicate} icon={Copy}>
              복제
            </ActionButton>
            <ActionButton primary disabled={saving} onClick={onSave} icon={Check}>
              저장
            </ActionButton>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[260px_minmax(0,1fr)] gap-5">
          <div>
            <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-[#f7f7f5]">
              {draft.imageUrl ? (
                <img
                  src={draft.imageUrl}
                  alt="티켓 대표 이미지 미리보기"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-center text-xs font-semibold text-black/35">
                  <ImageIcon size={30} className="mx-auto mb-2" aria-hidden />
                  대표 이미지 없음
                </div>
              )}
            </div>
            <label className="mt-3 flex h-10 cursor-pointer items-center justify-center rounded-xl border border-black/10 text-sm font-semibold text-black/55">
              이미지 업로드/교체
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
            <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs font-bold text-black/60">
              <input
                type="checkbox"
                checked={Boolean(draft.questionOrder)}
                disabled={saving}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    questionOrder: event.target.checked
                      ? draft.questionOrder || "1"
                      : "",
                  })
                }
                className="h-4 w-4 accent-black disabled:opacity-40"
              />
              질문 샘플 티켓 사용
            </label>
            {draft.questionOrder ? (
              <div className="mt-3 rounded-2xl border border-accent/20 bg-accent/[0.06] p-3">
                <p className="text-[11px] font-bold text-black/55">
                  질문 노출 순서
                </p>
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {questionOrders.map((order) => {
                    const selected = draft.questionOrder === String(order);
                    return (
                      <button
                        key={order}
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          onDraftChange({
                            ...draft,
                            questionOrder: String(order),
                          })
                        }
                        className={cn(
                          "flex h-8 items-center justify-center rounded-lg border text-sm font-bold transition",
                          selected
                            ? "border-accent bg-accent text-white"
                            : "border-black/10 bg-white text-black/55 hover:border-accent/50",
                        )}
                      >
                        {order}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <p className="mt-2 text-[10px] leading-4 text-black/35">
              원본 파일을 리사이즈 없이 `ticket-images`에 저장합니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextAreaField
              label="템플릿 제목"
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
              label="활동 유형"
              value={draft.activityType}
              placeholder="cafe"
              onChange={(activityType) =>
                onDraftChange({ ...draft, activityType })
              }
            />
            <SelectField
              label="공개 범위"
              value={draft.visibility}
              options={templateTicketVisibilities.map((value) => ({
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
            <FormField
              label="기본 지역"
              value={draft.defaultRegion}
              onChange={(defaultRegion) =>
                onDraftChange({ ...draft, defaultRegion })
              }
            />
            <SelectField
              label="기본 시간"
              value={draft.defaultTime}
              options={timeOptions}
              onChange={(defaultTime) =>
                onDraftChange({ ...draft, defaultTime })
              }
            />
            <FormField
              label="분위기 태그"
              className="col-span-2"
              value={draft.moodTags}
              placeholder="카페, 가벼운 대화, 조용한 분위기"
              onChange={(moodTags) =>
                onDraftChange({ ...draft, moodTags: limitTagInput(moodTags) })
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
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div>
          <h3 className="font-bold">사용자 상세 콘텐츠</h3>
          <p className="mt-1 text-xs leading-5 text-black/45">
            사용자가 티켓을 자세히 볼 때 카드 아래에 표시되는 템플릿 설명입니다.
            세부 티켓의 운영 코드/운영 메모와 분리해서 관리합니다.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <TextAreaField
            label="상세 한 줄 요약"
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
            placeholder={"최근 기억에 남는 이야기\n가볍게 나누는 실패담\n서로의 취향과 생각"}
            onChange={(detailActivities) =>
              onDraftChange({ ...draft, detailActivities })
            }
          />
          <TextAreaField
            label="이런 결의 분들에게 잘 맞아요"
            className="col-span-2"
            value={draft.detailGoodFor}
            placeholder={"처음 보는 사람과도 편하게 대화하는 분\n너무 무겁지 않은 이야기가 좋은 분"}
            onChange={(detailGoodFor) =>
              onDraftChange({ ...draft, detailGoodFor })
            }
          />
          <TextAreaField
            label="티켓별 안내사항"
            className="col-span-2"
            value={draft.detailNotice}
            onChange={(detailNotice) =>
              onDraftChange({ ...draft, detailNotice })
            }
          />
        </div>
      </section>

      <ScoreEditor draft={draft} saving={saving} onDraftChange={onDraftChange} />

      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold">세부 티켓</h3>
            <p className="mt-1 text-xs text-black/40">
              정원 없이 현재 배정 인원과 대기열만 집계합니다.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onCreateInstance}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white disabled:bg-black/30"
          >
            <Plus size={16} aria-hidden />
            세부 티켓 만들기
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {template.instances.length ? (
            template.instances.map((instance) => (
              <button
                key={instance.id}
                type="button"
                onClick={() => onSelectInstance(instance.id)}
                className="rounded-2xl border border-black/10 p-4 text-left transition hover:border-accent hover:bg-accent/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold">{instanceDisplayTitle(instance)}</h4>
                    <p className="mt-1 text-xs text-black/45">
                      {dateTimeText(instance)}
                    </p>
                    <p className="mt-1 text-xs text-black/45">
                      {instance.region ?? "지역 미정"} ·{" "}
                      {instance.place_name ?? "장소 미정"}
                    </p>
                    {instance.operation_note && (
                      <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-black/38">
                        {instance.operation_note}
                      </p>
                    )}
                  </div>
                  <VisibilityBadge visibility={instance.visibility} />
                </div>
                <div className="mt-4 flex gap-4 text-xs font-semibold text-black/50">
                  <span>배정 {instance.assignment_count}명</span>
                  <span>대기열 {instance.waitlist_count}명</span>
                </div>
              </button>
            ))
          ) : (
            <div className="col-span-2 rounded-2xl border border-dashed border-black/15 py-10 text-center text-sm font-semibold text-black/40">
              아직 세부 티켓이 없습니다.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ScoreEditor({
  draft,
  saving,
  onDraftChange,
}: {
  draft: TemplateDraft;
  saving: boolean;
  onDraftChange: (draft: TemplateDraft) => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-bold">모임 성향 점수</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-black/45">
            이 점수는 사람과 모임을 같은 기준으로 비교하기 위한 운영용
            점수입니다. 사용자에게 직접 노출되지 않습니다.
          </p>
        </div>
        <div className="rounded-xl bg-[#f7f7f5] px-3 py-2 text-[10px] font-semibold leading-4 text-black/42">
          {scoreGuideExamples.slice(0, 2).map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {scoreFields.map((field) => {
          const selectedValue = draft[field.key];

          return (
            <div
              key={field.key}
              className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-black/8 px-3 py-3"
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

      <details className="mt-4 rounded-xl bg-[#f7f7f5] px-4 py-3 text-xs leading-5 text-black/50">
        <summary className="cursor-pointer font-bold text-black/55">
          모임 점수 참고표
        </summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {scoreGuideExamples.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </details>
    </section>
  );
}

function InstanceEditor({
  template,
  instance,
  draft,
  profiles,
  memberQuery,
  saving,
  onDraftChange,
  onMemberQueryChange,
  onBack,
  onSave,
  onDuplicate,
  onAddMember,
  onRemoveMember,
}: {
  template: AdminTicketTemplate;
  instance: AdminTicketInstance;
  draft: InstanceDraft;
  profiles: AdminProfile[];
  memberQuery: string;
  saving: boolean;
  onDraftChange: (draft: InstanceDraft) => void;
  onMemberQueryChange: (query: string) => void;
  onBack: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  onAddMember: (profileId: string) => void;
  onRemoveMember: (profileId: string) => void;
}) {
  return (
    <div className="mx-auto max-w-[980px] space-y-5">
      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-semibold text-black/45 underline underline-offset-4"
            >
              템플릿 상세로 돌아가기
            </button>
            <h3 className="mt-3 text-xl font-bold">세부 티켓 수정</h3>
            <p className="mt-1 text-xs text-black/40">{template.title}</p>
          </div>
          <div className="flex gap-2">
            <ActionButton disabled={saving} onClick={onDuplicate} icon={Copy}>
              복제
            </ActionButton>
            <ActionButton primary disabled={saving} onClick={onSave} icon={Check}>
              저장
            </ActionButton>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <TextAreaField
            label="세부 티켓명"
            className="col-span-2"
            value={draft.title}
            onChange={(title) => onDraftChange({ ...draft, title })}
          />
          <FormField
            label="운영 코드"
            value={draft.operationCode}
            placeholder="LOVE-0620-A"
            onChange={(operationCode) =>
              onDraftChange({ ...draft, operationCode })
            }
          />
          <FormField
            label="운영 메모"
            value={draft.operationNote}
            placeholder="A조 / 차분한 대화형"
            onChange={(operationNote) =>
              onDraftChange({ ...draft, operationNote })
            }
          />
          <FormField
            label="날짜"
            type="date"
            value={draft.eventDate}
            onChange={(eventDate) => onDraftChange({ ...draft, eventDate })}
          />
          <SelectField
            label="시간"
            value={draft.eventTime}
            options={timeOptions}
            onChange={(eventTime) => onDraftChange({ ...draft, eventTime })}
          />
          <TextAreaField
            label="지역"
            value={draft.region}
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
            label="장소 공개 상태"
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
          <SelectField
            label="공개 범위"
            value={draft.visibility}
            options={instanceTicketVisibilities.map((value) => ({
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
          <SelectField
            label="잔여 자리 문구"
            value={draft.remainingSeatLabelCount}
            options={Array.from({ length: 7 }, (_, count) => ({
              value: String(count),
              label: count === 0 ? "표시 안 함" : `🚨 ${count}자리 남았어요`,
            }))}
            onChange={(remainingSeatLabelCount) =>
              onDraftChange({ ...draft, remainingSeatLabelCount })
            }
          />
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5">
        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold">현재 배정 멤버</h3>
              <p className="mt-1 text-xs text-black/40">
                배정 {instance.assignment_count}명 · 대기열{" "}
                {instance.waitlist_count}명
              </p>
            </div>
            <Users size={20} className="text-black/30" aria-hidden />
          </div>

          <div className="mt-4 space-y-2">
            {instance.assignments.length ? (
              instance.assignments.map((assignment) => {
                const profile = assignment.profile;
                if (!profile) return null;
                return (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-black/8 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <AdminMemberName profile={profile} />
                      <p className="mt-1 truncate text-[11px] text-black/42">
                        {profile.gender ?? "-"} · {profile.birth_year ?? "-"} ·{" "}
                        {profile.mbti ?? "-"} · {profile.phone ?? "-"}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-accent">
                        {membershipText(profile)}
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
                );
              })
            ) : (
              <p className="rounded-xl border border-dashed border-black/15 py-8 text-center text-xs font-semibold text-black/35">
                아직 배정된 멤버가 없습니다.
              </p>
            )}
          </div>

          <div className="mt-5 border-t border-black/8 pt-5">
            <h4 className="text-sm font-bold">멤버 추가</h4>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-black/38">
              기본 후보는 이 날짜와 이 티켓 템플릿에 신청한 사람만 표시됩니다.
            </p>
            <label className="relative mt-3 block">
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
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {profiles.length ? (
                profiles.map((profile) => (
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
                        {membershipText(profile)}
                      </p>
                    </div>
                    <Plus size={15} aria-hidden />
                  </button>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-black/12 px-3 py-6 text-center text-xs font-semibold leading-5 text-black/35">
                  이 날짜와 템플릿에 신청한 추가 후보가 없습니다.
                </p>
              )}
            </div>
          </div>
        </section>

        <TicketPreview
          template={template}
          instance={{ ...instance, ...draftToInstanceFields(draft) }}
        />
      </div>
    </div>
  );
}

function draftToInstanceFields(draft: InstanceDraft) {
  return {
    title: draft.title,
    event_date: draft.eventDate || null,
    event_time: draft.eventTime || null,
    region: draft.region || null,
    place_name: draft.placeName || null,
    address: draft.address || null,
    operation_code: draft.operationCode || null,
    operation_note: draft.operationNote || null,
    place_visibility: draft.placeVisibility,
    visibility: draft.visibility,
    remaining_seat_label_count: Number.parseInt(
      draft.remainingSeatLabelCount,
      10,
    ),
  };
}

function TicketPreview({
  template,
  instance,
}: {
  template: AdminTicketTemplate;
  instance: AdminTicketInstance;
}) {
  return (
    <aside className="self-start rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
        user preview
      </p>
      <IntersectionTicketCard
        title={instance.title || template.title}
        imageUrl={template.image_url}
        date={instance.event_date}
        time={instance.event_time?.slice(0, 5)}
        location={instance.region || template.default_region || "지역 미정"}
        tags={template.mood_tags}
        remainingSeatCount={instance.remaining_seat_label_count}
        className="mt-3"
      />
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

function ModeButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-lg px-3 text-xs font-semibold",
        selected ? "bg-white text-black shadow-sm" : "text-black/45",
      )}
    >
      {children}
    </button>
  );
}

function ActionButton({
  primary = false,
  disabled,
  onClick,
  icon: Icon,
  children,
}: {
  primary?: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: typeof Copy;
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
          : "border border-black/10 bg-white text-black/55",
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
    <label>
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent"
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

function PanelMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-black/15 px-5 text-center text-sm font-semibold text-black/40">
      {children}
    </div>
  );
}
