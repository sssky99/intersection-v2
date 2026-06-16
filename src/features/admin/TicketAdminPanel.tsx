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
import type { AdminProfile } from "@/features/admin/adminProfile";
import { membershipStatusLabels } from "@/features/membership/membershipTypes";
import {
  placeVisibilities,
  placeVisibilityLabels,
  ticketVisibilities,
  ticketVisibilityLabels,
  type AdminTicketInstance,
  type AdminTicketTemplate,
  type PlaceVisibility,
  type TicketVisibility,
} from "@/features/admin/ticketAdminTypes";

type TicketData = {
  templates: AdminTicketTemplate[];
  profiles: AdminProfile[];
};

type TemplateDraft = {
  title: string;
  shortDescription: string;
  imageUrl: string;
  moodTags: string;
  activityType: string;
  recommendationCopy: string;
  defaultRegion: string;
  defaultTime: string;
  visibility: TicketVisibility;
};

type InstanceDraft = {
  title: string;
  eventDate: string;
  eventTime: string;
  region: string;
  placeName: string;
  address: string;
  placeVisibility: PlaceVisibility;
  visibility: TicketVisibility;
  remainingSeatLabelCount: string;
};

type ListMode = "templates" | "dates";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function templateDraft(template: AdminTicketTemplate): TemplateDraft {
  return {
    title: template.title,
    shortDescription: template.short_description ?? "",
    imageUrl: template.image_url ?? "",
    moodTags: template.mood_tags.join(", "),
    activityType: template.activity_type ?? "",
    recommendationCopy: template.recommendation_copy ?? "",
    defaultRegion: template.default_region ?? "",
    defaultTime: template.default_time?.slice(0, 5) ?? "",
    visibility: template.visibility,
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
    placeVisibility: instance.place_visibility,
    visibility: instance.visibility,
    remainingSeatLabelCount: String(instance.remaining_seat_label_count ?? 0),
  };
}

function requestBody(draft: TemplateDraft) {
  return {
    title: draft.title,
    shortDescription: draft.shortDescription,
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

function profileName(profile: AdminProfile) {
  return profile.name?.trim() || "이름 없음";
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

function MemberName({ profile }: { profile: AdminProfile }) {
  return (
    <span className="inline-flex items-center gap-1 font-bold text-black">
      {profile.active_membership && <span aria-label="멤버십 적용중">💎</span>}
      {profile.expired_membership && (
        <span className="font-black text-red-500" aria-label="멤버십 만료">
          ♦
        </span>
      )}
      <span>{profileName(profile)}</span>
    </span>
  );
}

export function TicketAdminPanel() {
  const [templates, setTemplates] = useState<AdminTicketTemplate[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    null,
  );
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
    setTemplates(data.templates ?? []);
    setProfiles(data.profiles ?? []);
    setSelectedTemplateId((current) => {
      if (current && data.templates.some((template) => template.id === current)) {
        return current;
      }
      return data.templates[0]?.id ?? null;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/tickets", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as
        | (TicketData & { error?: string })
        | null;
      if (!response.ok || !data) {
        throw new Error(data?.error ?? "tickets-load-failed");
      }
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

  const createInstance = async () => {
    if (!selectedTemplate) return;
    const created = await runAction(
      "POST",
      {
        action: "create_instance",
        templateId: selectedTemplate.id,
        title: "새 세부 티켓",
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
    if (!selectedInstance) return [];
    const assignedIds = new Set(
      selectedInstance.assignments.map((assignment) => assignment.profile_id),
    );
    const normalized = memberQuery.trim().toLowerCase();
    return profiles
      .filter((profile) => !assignedIds.has(profile.user_id))
      .filter((profile) =>
        `${profile.name ?? ""} ${profile.phone ?? ""}`
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 8);
  }, [memberQuery, profiles, selectedInstance]);

  return (
    <section className="flex h-[calc(100dvh-190px)] min-h-[680px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="shrink-0 border-b border-black/10 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">티켓 관리</h2>
            <p className="mt-1 text-xs text-black/45">
              템플릿과 실제 운영 티켓, 배정 멤버를 한곳에서 관리합니다.
            </p>
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
            {loading ? (
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
            ) : allInstances.length ? (
              <div className="space-y-3">
                {allInstances.map(({ template, instance }) => (
                  <button
                    key={instance.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      setSelectedInstanceId(instance.id);
                    }}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition",
                      instance.id === selectedInstanceId
                        ? "border-accent bg-accent/10"
                        : "border-black/10 hover:border-black/20",
                    )}
                  >
                    <p className="text-xs font-semibold text-accent">
                      {instance.event_date ?? "날짜 미정"}
                    </p>
                    <h3 className="mt-1 font-bold">{instance.title}</h3>
                    <p className="mt-1 text-xs text-black/45">
                      {template.title} · {instance.event_time?.slice(0, 5) ?? "시간 미정"} ·{" "}
                      {instance.region ?? "지역 미정"}
                    </p>
                  </button>
                ))}
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
              options={ticketVisibilities.map((value) => ({
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
            <FormField
              label="기본 시간"
              type="time"
              value={draft.defaultTime}
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
                    <h4 className="font-bold">{instance.title}</h4>
                    <p className="mt-1 text-xs text-black/45">
                      {dateTimeText(instance)}
                    </p>
                    <p className="mt-1 text-xs text-black/45">
                      {instance.region ?? "지역 미정"} ·{" "}
                      {instance.place_name ?? "장소 미정"}
                    </p>
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
            label="날짜"
            type="date"
            value={draft.eventDate}
            onChange={(eventDate) => onDraftChange({ ...draft, eventDate })}
          />
          <FormField
            label="시간"
            type="time"
            value={draft.eventTime}
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
            options={ticketVisibilities.map((value) => ({
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
                      <MemberName profile={profile} />
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
              {profiles.map((profile) => (
                <button
                  key={profile.user_id}
                  type="button"
                  disabled={saving}
                  onClick={() => onAddMember(profile.user_id)}
                  className="flex w-full items-center justify-between rounded-xl bg-[#f7f7f5] px-3 py-2.5 text-left hover:bg-accent/12 disabled:opacity-40"
                >
                  <div>
                    <MemberName profile={profile} />
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
              ))}
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
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <textarea
        value={value}
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
