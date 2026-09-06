"use client";
import { TicketPublicationSettings } from "./tickets/TicketPublicationSettings";

import type { AdminProfile } from "@/features/admin/adminProfile";
import {
  type AdminTicketTemplate,
  type AdminTicketWaitlistEntry,
} from "@/features/admin/ticketAdminTypes";
import { TICKET_COURSE_MAX_STEPS } from "@/lib/ticketCourse";
import {
  MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
  MEETING_MAX_PARTICIPANT_COUNT,
} from "@/types/ticket";
import { inferTicketCategory } from "@/types/ticketCategory";
import { Eye, Image as ImageIcon, Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BasicEditor,
  CourseStepsEditor,
  TicketEditorHeader,
} from "./tickets/TicketEditors";
import {
  IconButton,
  normalizeTimeValue,
  PanelMessage,
} from "./tickets/TicketFormControls";
import {
  detailTicketLabel,
  OccurrenceManager,
  TestTimeControl,
  TestTimeMode,
  testTimeOptions,
  VisibilityBadge,
} from "./tickets/TicketOccurrences";
import {
  AdminProgressPreviewModal,
  TicketPreviewPanel,
} from "./tickets/TicketPreview";
import { updatedDate } from "./tickets/ticketCourseDraft";
import {
  draftFromTicket,
  firstNormalizedTimeValue,
  primaryInstance,
  progressPreviewUserTicket,
  ticketPreview,
  ticketRequestBody,
} from "./tickets/ticketDraft";
import { TicketDraft } from "./tickets/ticketDraftTypes";

type TicketData = {
  templates: AdminTicketTemplate[];
  profiles: AdminProfile[];
  waitlist: AdminTicketWaitlistEntry[];
};

let ticketDataCache: TicketData | null = null;
let ticketDataRequest: Promise<TicketData> | null = null;

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

export function TicketAdminPanel({
  focusTicketId,
  onFocusTicketHandled,
  onOpenEvent,
}: {
  focusTicketId?: string | null;
  onFocusTicketHandled?: () => void;
  onOpenEvent?: (eventId: string) => void;
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
      if (
        current &&
        data.templates.some((template) => template.id === current)
      ) {
        return current;
      }
      return data.templates[0]?.id ?? null;
    });
  }, []);

  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      try {
        hydrate(await fetchTicketData(force));
      } catch {
        setError("티켓 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [hydrate],
  );

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
      selectedTicket ? draftFromTicket(selectedTicket, selectedInstance) : null,
    );
    setProgressPreviewOpen(false);
  }, [selectedInstance, selectedTicket]);

  const assignedProfiles = useMemo(() => {
    if (!selectedInstance) return [];
    return selectedInstance.participants
      .map((participation) => participation.profile)
      .filter((profile): profile is AdminProfile => Boolean(profile));
  }, [selectedInstance]);

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
  const linkedEventId = selectedInstance?.meeting_event_id ?? null;
  const templateHasEvent =
    selectedTicket?.instances.some((instance) =>
      Boolean(instance.meeting_event_id),
    ) ?? false;
  const isSampleTicket = draft?.templateKind === "question_sample";

  const filteredTickets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return templates;
    return templates.filter((template) =>
      [
        template.title,
        template.default_region,
        inferTicketCategory({
          activityType: template.activity_type,
          title: template.title,
          moodTags: template.mood_tags,
          shortDescription: template.short_description,
        }),
        ...template.course_steps.flatMap((step) => [
          step.title,
          step.activityType,
          step.placeName,
          step.address,
        ]),
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
        title: sampleOnly ? "새 샘플 티켓" : "새 코스",
        visibility: sampleOnly ? "question" : "draft",
        questionOrder: sampleOnly ? "1" : null,
        placeVisibility: "confirmed_only",
        remainingSeatLabelCount: "0",
        minimumParticipantCount: String(MEETING_DEFAULT_MIN_PARTICIPANT_COUNT),
        maxParticipantCount: "6",
        eventTime: "19:00",
        region: "",
      },
      sampleOnly ? "새 샘플 티켓을 만들었습니다." : "새 코스를 만들었습니다.",
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
      setError("저장할 세부티켓을 먼저 만들어주세요.");
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

  const createDetailTicket = async () => {
    if (!selectedTicket) return;
    const baseInstance = selectedInstance ?? primaryInstance(selectedTicket);
    const nextIndex = selectedTicket.instances.length;
    const previousIds = new Set(
      selectedTicket.instances.map((instance) => instance.id),
    );
    const data = await runAction(
      "POST",
      {
        action: "create_instance",
        templateId: selectedTicket.id,
        title: selectedTicket.title,
        eventDate: baseInstance?.event_date ?? draft?.eventDate ?? null,
        eventTime:
          baseInstance?.event_time ??
          normalizeTimeValue(draft?.eventTime ?? "") ??
          selectedTicket.default_time ??
          "19:00",
        region:
          baseInstance?.region ??
          draft?.region ??
          selectedTicket.default_region ??
          "",
        placeName: baseInstance?.place_name ?? draft?.placeName ?? "",
        address: baseInstance?.address ?? draft?.address ?? "",
        place: baseInstance?.place_payload ?? draft?.place ?? null,
        operationCode: baseInstance?.operation_code ?? "",
        operationNote: baseInstance?.operation_note ?? "",
        visibility: "draft",
        placeVisibility: baseInstance?.place_visibility ?? "confirmed_only",
        remainingSeatLabelCount: 0,
        minimumParticipantCount:
          baseInstance?.minimum_participant_count ??
          MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
        maxParticipantCount:
          baseInstance?.max_participant_count ?? MEETING_MAX_PARTICIPANT_COUNT,
      },
      `${detailTicketLabel(nextIndex)}을 만들었습니다.`,
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
      "세부티켓을 복제했습니다.",
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
    if (!window.confirm("선택한 세부티켓과 연결된 참여 정보를 삭제할까요?")) {
      return;
    }
    await runAction(
      "DELETE",
      null,
      "세부티켓을 삭제했습니다.",
      `?instanceId=${encodeURIComponent(selectedInstance.id)}`,
    );
    setSelectedInstanceId(null);
  };

  const moveTestTime = async (mode: TestTimeMode) => {
    if (!selectedInstance || selectedInstance.visibility !== "test_only")
      return;
    const option = testTimeOptions(selectedTicket?.course_steps ?? []).find(
      (item) => item.mode === mode,
    );
    await runAction(
      "POST",
      {
        action: "set_instance_test_time",
        instanceId: selectedInstance.id,
        mode,
      },
      `테스트 시간을 ${option?.label ?? "선택한"} 상태로 이동했습니다.`,
    );
  };

  const revealInstanceNow = async () => {
    if (!selectedInstance || selectedInstance.ticket_reveal_override_at) return;
    if (
      !window.confirm(
        "배정된 확정 참가자에게 이 티켓을 지금 공개할까요?\n여정별 활동과 장소의 순차 공개 시점은 그대로 유지됩니다.",
      )
    ) {
      return;
    }

    await runAction(
      "POST",
      {
        action: "reveal_instance_now",
        instanceId: selectedInstance.id,
      },
      "확정 참가자에게 티켓을 즉시 공개했습니다.",
    );
  };

  const deleteTicket = async () => {
    if (!selectedTicket) return;
    const confirmed = window.confirm(
      `"${selectedTicket.title}" 초대장을 삭제할까요?\n연결된 세부티켓과 참여 정보도 함께 삭제됩니다.`,
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

  return (
    <section className="flex h-[calc(100dvh-190px)] min-h-[720px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="shrink-0 border-b border-black/10 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">티켓·프로그램 관리</h2>
            <p className="mt-1 text-xs font-semibold text-black/42">
              티켓과 프로그램 원본을 관리합니다. 실제 행사 일정·장소·조는 행사
              관리에서 수정하세요.
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
              새 코스 만들기
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
              placeholder="제목, 카테고리, 지역 검색"
              className="h-10 w-full rounded-xl border border-black/10 pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </label>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {loading && templates.length === 0 ? (
              <PanelMessage>코스 정보를 불러오는 중입니다.</PanelMessage>
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
              <PanelMessage>등록된 코스가 없습니다.</PanelMessage>
            )}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-[#fbfbfa] p-5">
          {!selectedTicket || !draft ? (
            <PanelMessage>코스를 선택하거나 새로 만들어주세요.</PanelMessage>
          ) : (
            <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)_390px] gap-5">
              <div className="min-w-0 space-y-5">
                {linkedEventId && (
                  <section className="rounded-2xl border border-black/10 bg-white p-5">
                    <h3 className="font-bold">행사에 연결된 티켓</h3>
                    <p className="mt-2 text-sm text-black/55">
                      {selectedInstance?.title} · {selectedInstance?.event_date}{" "}
                      · {selectedInstance?.event_time}
                    </p>
                    <p className="mt-1 text-sm text-black/55">
                      {selectedInstance?.place_name || "장소 미정"} · 참가{" "}
                      {selectedInstance?.participant_count ?? 0}명
                    </p>
                    <p className="mt-3 text-xs text-black/50">
                      일정·장소·조 변경은 행사 관리에서 반영됩니다.
                    </p>
                    {onOpenEvent && (
                      <button
                        type="button"
                        onClick={() => onOpenEvent(linkedEventId)}
                        className="mt-3 rounded-xl bg-black px-4 py-2 text-sm text-white"
                      >
                        이 행사 관리하기
                      </button>
                    )}
                  </section>
                )}
                {linkedEventId && selectedInstance && (
                  <TicketPublicationSettings
                    key={selectedInstance.id + selectedInstance.updated_at}
                    instance={selectedInstance}
                    saving={saving}
                    onSave={(visibility) =>
                      runAction(
                        "PATCH",
                        {
                          entity: "publication",
                          id: selectedInstance.id,
                          visibility,
                        },
                        "티켓 공개 상태를 저장했습니다.",
                      )
                    }
                  />
                )}
                {templateHasEvent && !linkedEventId && (
                  <p className="rounded-xl bg-white p-4 text-sm text-black/55">
                    이 프로그램은 다른 행사에서도 사용 중입니다. 연결된
                    세부티켓을 선택하면 행사 관리로 이동할 수 있습니다.
                  </p>
                )}
                <fieldset
                  disabled={saving || templateHasEvent}
                  className="space-y-5 disabled:opacity-60"
                >
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
                    <CourseStepsEditor
                      draft={draft}
                      saving={saving}
                      onDraftChange={setDraft}
                    />
                  )}
                </fieldset>
                {!isSampleTicket && (
                  <OccurrenceManager
                    instances={selectedTicket.instances}
                    selectedInstanceId={selectedInstance?.id ?? null}
                    saving={saving || templateHasEvent}
                    onSelect={setSelectedInstanceId}
                    onCreate={() => void createDetailTicket()}
                    onDuplicate={() => void duplicateOccurrence()}
                    onDelete={() => void deleteOccurrence()}
                  />
                )}

                {!linkedEventId &&
                  selectedInstance?.visibility === "test_only" && (
                    <TestTimeControl
                      instance={selectedInstance}
                      courseSteps={selectedTicket.course_steps}
                      saving={saving}
                      onMove={(mode) => void moveTestTime(mode)}
                    />
                  )}

                <fieldset disabled={saving || templateHasEvent}>
                  <BasicEditor
                    draft={draft}
                    saving={saving}
                    sampleOnly={isSampleTicket}
                    onDraftChange={setDraft}
                  />
                </fieldset>

                {!templateHasEvent &&
                  !isSampleTicket &&
                  progressPreviewTicket && (
                    <ProgressPreviewLauncher
                      onClick={() => setProgressPreviewOpen(true)}
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
  const courseCount = Math.max(
    2,
    Math.min(TICKET_COURSE_MAX_STEPS, template.course_steps?.length || 2),
  );

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
          <VisibilityBadge
            visibility={instance?.visibility ?? template.visibility}
          />
          {!isSampleTicket && (
            <span className="rounded-full bg-black/[0.045] px-2 py-1 text-[10px] font-bold text-black/45">
              {courseCount}단계 여정
            </span>
          )}
          {template.instance_count > 1 && (
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
              세부티켓 {template.instance_count}
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

import { cn } from "@/lib/cn";
