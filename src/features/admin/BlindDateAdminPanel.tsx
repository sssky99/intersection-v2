"use client";

import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clipboard,
  Copy,
  Edit3,
  ImageIcon,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { IntersectionTicketCard } from "@/components/IntersectionTicketCard";
import { blindDateSelectableDateWindowFrom } from "@/lib/blindDateDates";
import type {
  BlindDateAdminOffer,
  BlindDateAdminProfile,
  BlindDateMutualCandidate,
  BlindDateOfferStatus,
  BlindDateTemplate,
} from "@/types/blindDate";

type BlindDateAdminData = {
  templates: BlindDateTemplate[];
  offers: BlindDateAdminOffer[];
  profiles: BlindDateAdminProfile[];
  candidates: BlindDateMutualCandidate[];
  smsCopy: string;
};

type TemplateDraft = {
  title: string;
  imageUrl: string;
  shortDescription: string;
  timeLabel: string;
  region: string;
  actualPlaceName: string;
  actualPlaceAddress: string;
  guideText: string;
  stageInviteText: string;
  stageWaitingText: string;
  stageScheduledText: string;
  stageGuidanceText: string;
  stageCompletedText: string;
  active: boolean;
};

type OfferDraft = {
  participantAId: string;
  participantBId: string;
  templateId: string;
  timeLabel: string;
  region: string;
  actualPlaceName: string;
  actualPlaceAddress: string;
  expiresAtLocal: string;
};

const statusLabels: Record<BlindDateOfferStatus, string> = {
  pending_admin: "운영 검수",
  offered: "제안 발송",
  waiting_response: "응답 대기",
  scheduled: "일정 확정",
  needs_reschedule: "일정 조율 필요",
  declined: "거절",
  expired: "만료",
  cancelled: "취소",
  completed: "완료",
};

const statusOptions = Object.keys(statusLabels) as BlindDateOfferStatus[];

const defaultStageCopy = {
  invite:
    "블라인드 데이트 제안이 도착했어요.\n상대방은 현장에서 만날 수 있어요.",
  waiting: "상대방의 응답을 기다리는 중이에요.",
  scheduled:
    "블라인드 데이트 일정이 확정되었어요.\n확정된 날짜와 장소를 확인해주세요.",
  guidance:
    "오늘은 블라인드 데이트가 곧 시작돼요.\n장소와 시간을 다시 확인해주세요.",
  completed:
    "블라인드 데이트가 완료되었어요.\n짧은 피드백을 남겨주세요.",
};

const emptyTemplateDraft: TemplateDraft = {
  title: "블라인드 데이트",
  imageUrl: "",
  shortDescription:
    "서로 다시 만나보고 싶다고 선택된 분과 단둘이 만나는 자리예요.",
  timeLabel: "저녁 7시",
  region: "성수",
  actualPlaceName: "",
  actualPlaceAddress: "",
  guideText:
    "상대방은 현장에서 알 수 있어요. 정확한 장소는 운영진이 별도로 안내드릴게요.",
  stageInviteText: defaultStageCopy.invite,
  stageWaitingText: defaultStageCopy.waiting,
  stageScheduledText: defaultStageCopy.scheduled,
  stageGuidanceText: defaultStageCopy.guidance,
  stageCompletedText: defaultStageCopy.completed,
  active: true,
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function profileName(profile: BlindDateAdminProfile | null | undefined) {
  return profile?.name?.trim() || profile?.nickname?.trim() || "이름 없음";
}

function profileLabel(profile: BlindDateAdminProfile) {
  const name = profileName(profile);
  const phone = profile.phone?.trim();
  return [name, phone, profile.is_test_participant ? "테스트" : null]
    .filter(Boolean)
    .join(" · ");
}

function formatKoreanDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00+09:00`);
  if (!Number.isFinite(date.getTime())) return value;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")} ${weekday}`;
}

function formatDateRangeLabel(values: string[]) {
  if (values.length === 0) return "-";
  const first = values[0];
  const last = values[values.length - 1];
  if (!last || first === last) return formatDateLabel(first);
  return `${formatDateLabel(first)} ~ ${formatDateLabel(last)} (${values.length}일)`;
}

function toDatetimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultExpiresAtLocal() {
  return toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

function emptyOfferDraft(template?: BlindDateTemplate): OfferDraft {
  return {
    participantAId: "",
    participantBId: "",
    templateId: template?.id ?? "",
    timeLabel: template?.time_label ?? "저녁 7시",
    region: template?.region ?? "성수",
    actualPlaceName: template?.actual_place_name ?? "",
    actualPlaceAddress: template?.actual_place_address ?? "",
    expiresAtLocal: defaultExpiresAtLocal(),
  };
}

function templateDraftFrom(template: BlindDateTemplate): TemplateDraft {
  return {
    title: template.title,
    imageUrl: template.image_url ?? "",
    shortDescription: template.short_description ?? "",
    timeLabel: template.time_label ?? "",
    region: template.region ?? "",
    actualPlaceName: template.actual_place_name ?? "",
    actualPlaceAddress: template.actual_place_address ?? "",
    guideText: template.guide_text ?? "",
    stageInviteText: template.stage_copy?.invite ?? defaultStageCopy.invite,
    stageWaitingText: template.stage_copy?.waiting ?? defaultStageCopy.waiting,
    stageScheduledText:
      template.stage_copy?.scheduled ?? defaultStageCopy.scheduled,
    stageGuidanceText: template.stage_copy?.guidance ?? defaultStageCopy.guidance,
    stageCompletedText:
      template.stage_copy?.completed ?? defaultStageCopy.completed,
    active: template.active,
  };
}

function applyTemplateToDraft(
  draft: OfferDraft,
  template: BlindDateTemplate | undefined,
) {
  if (!template) return draft;
  return {
    ...draft,
    templateId: template.id,
    timeLabel: draft.timeLabel || template.time_label || "저녁 7시",
    region: draft.region || template.region || "성수",
    actualPlaceName:
      draft.actualPlaceName || template.actual_place_name || "",
    actualPlaceAddress:
      draft.actualPlaceAddress || template.actual_place_address || "",
  };
}

function expiresIso(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

async function requestAdminData(
  method: "GET" | "POST" | "PATCH",
  body?: Record<string, unknown>,
) {
  const response = await fetch("/api/admin/blind-dates", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | (BlindDateAdminData & { error?: string })
    | null;

  if (!response.ok || !data) {
    throw new Error(data?.error ?? "blind-date-admin-request-failed");
  }

  return data;
}

export function BlindDateAdminPanel() {
  const [data, setData] = useState<BlindDateAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [templateImageUploading, setTemplateImageUploading] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateDeleteTarget, setTemplateDeleteTarget] =
    useState<BlindDateTemplate | null>(null);
  const [templateDraft, setTemplateDraft] =
    useState<TemplateDraft>(emptyTemplateDraft);
  const [selectedCandidate, setSelectedCandidate] =
    useState<BlindDateMutualCandidate | null>(null);
  const [candidateDraft, setCandidateDraft] = useState<OfferDraft>(() =>
    emptyOfferDraft(),
  );
  const [testDraft, setTestDraft] = useState<OfferDraft>(() => emptyOfferDraft());

  const activeTemplates = useMemo(
    () =>
      (data?.templates ?? []).filter(
        (template) => template.active && !template.deleted_at,
      ),
    [data?.templates],
  );
  const defaultTemplate = activeTemplates[0];
  const profileOptions = data?.profiles ?? [];

  const applyLoadedData = (nextData: BlindDateAdminData) => {
    setData(nextData);
    const activeTemplateIds = new Set(
      nextData.templates
        .filter((item) => item.active && !item.deleted_at)
        .map((item) => item.id),
    );
    const template =
      nextData.templates.find((item) => item.active && !item.deleted_at) ??
      undefined;
    setCandidateDraft((current) =>
      current.templateId && activeTemplateIds.has(current.templateId)
        ? current
        : emptyOfferDraft(template),
    );
    setTestDraft((current) =>
      current.templateId && activeTemplateIds.has(current.templateId)
        ? current
        : emptyOfferDraft(template),
    );
  };

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      applyLoadedData(await requestAdminData("GET"));
    } catch {
      setError("블라인드 데이트 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const saveTemplate = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    const payload = {
      entity: "template",
      id: editingTemplateId,
      title: templateDraft.title,
      imageUrl: templateDraft.imageUrl,
      shortDescription: templateDraft.shortDescription,
      timeLabel: templateDraft.timeLabel,
      region: templateDraft.region,
      actualPlaceName: templateDraft.actualPlaceName,
      actualPlaceAddress: templateDraft.actualPlaceAddress,
      guideText: templateDraft.guideText,
      stageInviteText: templateDraft.stageInviteText,
      stageWaitingText: templateDraft.stageWaitingText,
      stageScheduledText: templateDraft.stageScheduledText,
      stageGuidanceText: templateDraft.stageGuidanceText,
      stageCompletedText: templateDraft.stageCompletedText,
      active: templateDraft.active,
    };

    try {
      const nextData = editingTemplateId
        ? await requestAdminData("PATCH", payload)
        : await requestAdminData("POST", {
            action: "create_template",
            ...payload,
          });
      applyLoadedData(nextData);
      setTemplateFormOpen(false);
      setEditingTemplateId(null);
      setTemplateDraft(emptyTemplateDraft);
      setNotice("블라인드 데이트 템플릿을 저장했습니다.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "템플릿을 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  const uploadTemplateImage = async (file: File) => {
    if (templateImageUploading || saving) return;
    setTemplateImageUploading(true);
    setError(null);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("templateId", editingTemplateId ?? "blind-date-template-draft");

      const response = await fetch("/api/admin/tickets/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as {
        imageUrl?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.imageUrl) {
        throw new Error(payload?.error ?? "이미지를 업로드하지 못했습니다.");
      }

      setTemplateDraft((current) => ({
        ...current,
        imageUrl: payload.imageUrl ?? "",
      }));
      setNotice(
        editingTemplateId
          ? "대표 이미지를 업로드했습니다. 수정 저장을 누르면 반영됩니다."
          : "대표 이미지를 업로드했습니다. 템플릿 생성으로 저장해주세요.",
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "이미지를 업로드하지 못했습니다.",
      );
    } finally {
      setTemplateImageUploading(false);
    }
  };

  const createOffer = async (
    draft: OfferDraft,
    sourceType: "mutual_feedback" | "test",
    source?: BlindDateMutualCandidate | null,
  ) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const nextData = await requestAdminData("POST", {
        action: "create_offer",
        sourceType,
        participantAId: draft.participantAId,
        participantBId: draft.participantBId,
        templateId: draft.templateId,
        timeLabel: draft.timeLabel,
        region: draft.region,
        actualPlaceName: draft.actualPlaceName,
        actualPlaceAddress: draft.actualPlaceAddress,
        expiresAt: expiresIso(draft.expiresAtLocal),
        feedbackAId: source?.feedbackAId,
        feedbackBId: source?.feedbackBId,
        ticketInstanceId: source?.ticketInstanceId,
        ticketTemplateId: source?.ticketTemplateId,
      });
      const nextDefaultTemplate = nextData.templates.find(
        (template) => template.active && !template.deleted_at,
      );
      applyLoadedData(nextData);
      if (sourceType === "mutual_feedback") {
        setSelectedCandidate(null);
        setCandidateDraft(emptyOfferDraft(nextDefaultTemplate));
      } else {
        setTestDraft(emptyOfferDraft(nextDefaultTemplate));
      }
      setNotice(
        sourceType === "test"
          ? "테스트 블라인드 데이트 제안을 생성했습니다."
          : "상호 선택 후보로 블라인드 데이트 제안을 생성했습니다.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "블라인드 데이트 제안을 생성하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateOfferStatus = async (
    offer: BlindDateAdminOffer,
    status: BlindDateOfferStatus,
  ) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      applyLoadedData(
        await requestAdminData("PATCH", {
          entity: "offer",
          id: offer.id,
          status,
        }),
      );
      setNotice("제안 상태를 저장했습니다.");
    } catch {
      setError("제안 상태를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const updateOfferPlace = async (
    offer: BlindDateAdminOffer,
    actualPlaceName: string,
    actualPlaceAddress: string,
  ) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      applyLoadedData(
        await requestAdminData("PATCH", {
          entity: "offer",
          id: offer.id,
          actualPlaceName,
          actualPlaceAddress,
        }),
      );
      setNotice("제안 장소 정보를 저장했습니다.");
    } catch {
      setError("제안 장소 정보를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const duplicateTemplate = async (template: BlindDateTemplate) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      applyLoadedData(
        await requestAdminData("POST", {
          action: "duplicate_template",
          templateId: template.id,
        }),
      );
      setNotice("템플릿 복사본을 만들었습니다.");
    } catch (duplicateError) {
      setError(
        duplicateError instanceof Error
          ? duplicateError.message
          : "템플릿을 복제하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async () => {
    if (saving || !templateDeleteTarget) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      applyLoadedData(
        await requestAdminData("POST", {
          action: "delete_template",
          templateId: templateDeleteTarget.id,
        }),
      );
      if (editingTemplateId === templateDeleteTarget.id) {
        setTemplateFormOpen(false);
        setEditingTemplateId(null);
        setTemplateDraft(emptyTemplateDraft);
      }
      setTemplateDeleteTarget(null);
      setNotice("템플릿을 삭제 처리했습니다.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "템플릿을 삭제하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  const selectCandidate = (candidate: BlindDateMutualCandidate) => {
    const template = defaultTemplate;
    setSelectedCandidate(candidate);
    setCandidateDraft(
      applyTemplateToDraft(
        {
          ...emptyOfferDraft(template),
          participantAId: candidate.participantAId,
          participantBId: candidate.participantBId,
        },
        template,
      ),
    );
  };

  const startCreateTemplate = () => {
    setTemplateDraft(emptyTemplateDraft);
    setEditingTemplateId(null);
    setTemplateFormOpen(true);
  };

  const startEditTemplate = (template: BlindDateTemplate) => {
    setTemplateDraft(templateDraftFrom(template));
    setEditingTemplateId(template.id);
    setTemplateFormOpen(true);
  };

  return (
    <div className="grid h-[calc(100dvh-190px)] min-h-[720px] grid-cols-[330px_minmax(0,1fr)] gap-5">
      <aside className="flex min-h-0 flex-col rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
              blind date
            </p>
            <h2 className="mt-1 text-xl font-bold">블라인드 데이트 관리</h2>
            <p className="mt-2 text-xs font-semibold leading-5 text-black/45">
              운영진 검수 후 직접 초대장을 만들고 응답 상태를 확인합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-black/45 transition hover:text-black disabled:opacity-40"
            aria-label="새로고침"
          >
            <RefreshCw size={16} aria-hidden />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <SummaryBox label="템플릿" value={String(data?.templates.length ?? 0)} />
          <SummaryBox label="상호 후보" value={String(data?.candidates.length ?? 0)} />
          <SummaryBox label="제안" value={String(data?.offers.length ?? 0)} />
          <SummaryBox
            label="응답 대기"
            value={String(
              data?.offers.filter((offer) =>
                ["offered", "waiting_response"].includes(offer.status),
              ).length ?? 0,
            )}
          />
        </div>

        <button
          type="button"
          onClick={startCreateTemplate}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white transition hover:bg-black/85"
        >
          <Plus size={16} aria-hidden />
          블라인드 데이트 템플릿 만들기
        </button>

        {data?.smsCopy && (
          <section className="mt-5 rounded-2xl border border-black/10 bg-[#fbfbfa] p-4">
            <p className="text-xs font-bold text-black/45">운영진 문자 복사용</p>
            <p className="mt-2 whitespace-pre-line text-xs font-semibold leading-5 text-black/62">
              {data.smsCopy}
            </p>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(data.smsCopy)}
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white text-xs font-bold text-black/55 transition hover:text-black"
            >
              <Clipboard size={14} aria-hidden />
              문구 복사
            </button>
          </section>
        )}

        {(notice || error) && (
          <p
            className={cn(
              "mt-4 rounded-xl px-4 py-3 text-xs font-bold leading-5",
              error ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700",
            )}
          >
            {error ?? notice}
          </p>
        )}
      </aside>

      <section className="min-h-0 overflow-y-auto rounded-2xl border border-black/10 bg-white shadow-sm">
        {loading ? (
          <StateMessage message="블라인드 데이트 데이터를 불러오는 중입니다." />
        ) : !data ? (
          <StateMessage message="데이터를 불러오지 못했습니다." tone="error" />
        ) : (
          <div className="space-y-5 p-5">
            <TemplateManagement
              templates={data.templates}
              formOpen={templateFormOpen}
              editingTemplateId={editingTemplateId}
              draft={templateDraft}
              saving={saving}
              imageUploading={templateImageUploading}
              onDraftChange={setTemplateDraft}
              onImageUpload={(file) => void uploadTemplateImage(file)}
              onCreateClick={startCreateTemplate}
              onEditClick={startEditTemplate}
              onDuplicateClick={(template) => void duplicateTemplate(template)}
              onDeleteClick={setTemplateDeleteTarget}
              onCancel={() => {
                setTemplateFormOpen(false);
                setEditingTemplateId(null);
                setTemplateDraft(emptyTemplateDraft);
              }}
              onSave={() => void saveTemplate()}
            />

            <MutualCandidateSection
              candidates={data.candidates}
              selectedCandidate={selectedCandidate}
              draft={candidateDraft}
              templates={activeTemplates}
              saving={saving}
              onSelectCandidate={selectCandidate}
              onDraftChange={setCandidateDraft}
              onCreate={() =>
                void createOffer(candidateDraft, "mutual_feedback", selectedCandidate)
              }
            />

            <OfferList
              offers={data.offers}
              saving={saving}
              onStatusChange={(offer, status) => void updateOfferStatus(offer, status)}
              onPlaceSave={(offer, actualPlaceName, actualPlaceAddress) =>
                void updateOfferPlace(offer, actualPlaceName, actualPlaceAddress)
              }
            />

            <TestMatchSection
              profiles={profileOptions}
              templates={activeTemplates}
              draft={testDraft}
              saving={saving}
              onDraftChange={setTestDraft}
              onCreate={() => void createOffer(testDraft, "test")}
            />
          </div>
        )}
      </section>
      {templateDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-[420px] rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 size={18} aria-hidden />
              </div>
              <div>
                <h3 className="text-base font-black">
                  템플릿을 삭제 처리할까요?
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-black/55">
                  {templateDeleteTarget.title} 템플릿은 새 제안 생성에서 제외되고,
                  기존 제안 기록에는 그대로 남습니다.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setTemplateDeleteTarget(null)}
                className="h-10 rounded-xl border border-black/10 px-4 text-xs font-bold text-black/55 disabled:opacity-40"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void deleteTemplate()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white disabled:bg-red-300"
              >
                <Trash2 size={14} aria-hidden />
                삭제 처리
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateManagement({
  templates,
  formOpen,
  editingTemplateId,
  draft,
  saving,
  imageUploading,
  onDraftChange,
  onImageUpload,
  onCreateClick,
  onEditClick,
  onDuplicateClick,
  onDeleteClick,
  onCancel,
  onSave,
}: {
  templates: BlindDateTemplate[];
  formOpen: boolean;
  editingTemplateId: string | null;
  draft: TemplateDraft;
  saving: boolean;
  imageUploading: boolean;
  onDraftChange: (draft: TemplateDraft) => void;
  onImageUpload: (file: File) => void;
  onCreateClick: () => void;
  onEditClick: (template: BlindDateTemplate) => void;
  onDuplicateClick: (template: BlindDateTemplate) => void;
  onDeleteClick: (template: BlindDateTemplate) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-[#fbfbfa] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
            template
          </p>
          <h3 className="mt-1 text-lg font-bold">
            블라인드 데이트 템플릿 관리
          </h3>
        </div>
        <button
          type="button"
          onClick={onCreateClick}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white"
        >
          <Plus size={15} aria-hidden />
          블라인드 데이트 템플릿 만들기
        </button>
      </div>

      {formOpen && (
        <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="템플릿 제목"
                  value={draft.title}
                  onChange={(title) => onDraftChange({ ...draft, title })}
                />
                <TemplateImageUpload
                  value={draft.imageUrl}
                  uploading={imageUploading}
                  disabled={saving}
                  onUpload={onImageUpload}
                  onClear={() => onDraftChange({ ...draft, imageUrl: "" })}
                />
                <TextField
                  label="시간대"
                  value={draft.timeLabel}
                  onChange={(timeLabel) =>
                    onDraftChange({ ...draft, timeLabel })
                  }
                />
                <TextField
                  label="지역"
                  value={draft.region}
                  onChange={(region) => onDraftChange({ ...draft, region })}
                />
                <TextField
                  label="실제 장소명"
                  value={draft.actualPlaceName}
                  onChange={(actualPlaceName) =>
                    onDraftChange({ ...draft, actualPlaceName })
                  }
                />
                <TextField
                  label="실제 주소"
                  value={draft.actualPlaceAddress}
                  onChange={(actualPlaceAddress) =>
                    onDraftChange({ ...draft, actualPlaceAddress })
                  }
                />
              </div>
              <TextAreaField
                className="mt-3"
                label="짧은 설명"
                rows={2}
                value={draft.shortDescription}
                onChange={(shortDescription) =>
                  onDraftChange({ ...draft, shortDescription })
                }
              />
              <TextAreaField
                className="mt-3"
                label="안내 문구"
                rows={3}
                value={draft.guideText}
                onChange={(guideText) => onDraftChange({ ...draft, guideText })}
              />
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <TextAreaField
                  label="1단계 초대 문구"
                  rows={3}
                  value={draft.stageInviteText}
                  onChange={(stageInviteText) =>
                    onDraftChange({ ...draft, stageInviteText })
                  }
                />
                <TextAreaField
                  label="2단계 응답 대기 문구"
                  rows={3}
                  value={draft.stageWaitingText}
                  onChange={(stageWaitingText) =>
                    onDraftChange({ ...draft, stageWaitingText })
                  }
                />
                <TextAreaField
                  label="3단계 일정 확정 문구"
                  rows={3}
                  value={draft.stageScheduledText}
                  onChange={(stageScheduledText) =>
                    onDraftChange({ ...draft, stageScheduledText })
                  }
                />
                <TextAreaField
                  label="4단계 당일 안내 문구"
                  rows={3}
                  value={draft.stageGuidanceText}
                  onChange={(stageGuidanceText) =>
                    onDraftChange({ ...draft, stageGuidanceText })
                  }
                />
                <TextAreaField
                  label="5단계 완료 문구"
                  rows={3}
                  value={draft.stageCompletedText}
                  onChange={(stageCompletedText) =>
                    onDraftChange({ ...draft, stageCompletedText })
                  }
                />
              </div>
            </div>

            <BlindDateTicketPreview draft={draft} />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-black/55">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) =>
                  onDraftChange({ ...draft, active: event.target.checked })
                }
              />
              활성 템플릿
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-10 rounded-xl border border-black/10 px-4 text-xs font-bold text-black/55"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving || imageUploading}
                onClick={onSave}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white disabled:bg-black/25"
              >
                <Save size={15} aria-hidden />
                {editingTemplateId ? "수정 저장" : "템플릿 생성"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
        {templates.map((template) => {
          const deleted = Boolean(template.deleted_at);

          return (
            <article
              key={template.id}
              className={cn(
                "rounded-2xl border border-black/10 bg-white p-4",
                deleted && "bg-black/[0.025] opacity-70",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-black">{template.title}</h4>
                  <p className="mt-1 text-xs font-semibold text-black/45">
                    {template.time_label ?? "-"} · {template.region ?? "-"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black",
                    deleted
                      ? "bg-red-50 text-red-600"
                      : template.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-black/[0.04] text-black/40",
                  )}
                >
                  {deleted ? "삭제됨" : template.active ? "활성" : "비활성"}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-black/50">
                {template.short_description ?? "설명 없음"}
              </p>
              <p className="mt-2 line-clamp-1 text-[11px] font-bold text-black/35">
                장소: {template.actual_place_name ?? "미입력"} ·{" "}
                {template.actual_place_address ?? "주소 미입력"}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={deleted}
                  onClick={() => onEditClick(template)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-black/10 text-xs font-bold text-black/55 transition hover:text-black disabled:opacity-35"
                >
                  <Edit3 size={14} aria-hidden />
                  수정
                </button>
                <button
                  type="button"
                  disabled={deleted}
                  onClick={() => onDuplicateClick(template)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-black/10 text-xs font-bold text-black/55 transition hover:text-black disabled:opacity-35"
                >
                  <Copy size={14} aria-hidden />
                  복제
                </button>
                <button
                  type="button"
                  disabled={deleted}
                  onClick={() => onDeleteClick(template)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-100 text-xs font-bold text-red-500 transition hover:border-red-200 hover:text-red-600 disabled:opacity-35"
                >
                  <Trash2 size={14} aria-hidden />
                  삭제
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TemplateImageUpload({
  value,
  uploading,
  disabled,
  onUpload,
  onClear,
}: {
  value: string;
  uploading: boolean;
  disabled: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const inputDisabled = disabled || uploading;

  return (
    <div className="block">
      <span className="text-xs font-bold text-black/45">대표 이미지</span>
      <div className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-black/10 bg-white px-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/[0.04] text-black/35">
          {value ? (
            <img
              src={value}
              alt="대표 이미지 미리보기"
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon size={15} aria-hidden />
          )}
        </div>
        <label
          className={cn(
            "flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 text-xs font-bold text-black/55",
            inputDisabled && "cursor-not-allowed opacity-45",
          )}
        >
          <span className="truncate">
            {uploading ? "업로드 중..." : value ? "이미지 교체" : "이미지 파일 선택"}
          </span>
          <Upload size={14} className="shrink-0" aria-hidden />
          <input
            type="file"
            accept="image/*"
            disabled={inputDisabled}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.target.value = "";
            }}
          />
        </label>
        {value && (
          <button
            type="button"
            disabled={inputDisabled}
            onClick={onClear}
            className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-black/35 transition hover:text-black disabled:opacity-40"
          >
            삭제
          </button>
        )}
      </div>
    </div>
  );
}

function BlindDateTicketPreview({ draft }: { draft: TemplateDraft }) {
  return (
    <aside className="self-start">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
        ticket preview
      </p>
      <IntersectionTicketCard
        title={draft.title || "블라인드 데이트"}
        imageUrl={draft.imageUrl}
        time={draft.timeLabel || "시간 미정"}
        location={draft.region || "지역 미정"}
        tags={["블라인드", "비공개"]}
        className="mt-3"
      />
    </aside>
  );
}

function MutualCandidateSection({
  candidates,
  selectedCandidate,
  draft,
  templates,
  saving,
  onSelectCandidate,
  onDraftChange,
  onCreate,
}: {
  candidates: BlindDateMutualCandidate[];
  selectedCandidate: BlindDateMutualCandidate | null;
  draft: OfferDraft;
  templates: BlindDateTemplate[];
  saving: boolean;
  onSelectCandidate: (candidate: BlindDateMutualCandidate) => void;
  onDraftChange: (draft: OfferDraft) => void;
  onCreate: () => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 p-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          mutual feedback
        </p>
        <h3 className="mt-1 text-lg font-bold">상호 선택 후보</h3>
        <p className="mt-1 text-xs font-semibold text-black/40">
          서로 “단둘이 만나고 싶어요”를 선택한 후보만 표시합니다.
        </p>
      </div>

      {selectedCandidate && (
        <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/[0.08] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-black">상호 선택 후보로 제안 만들기</h4>
              <p className="mt-1 text-xs font-semibold text-black/55">
                {profileName(selectedCandidate.participantA)} ·{" "}
                {profileName(selectedCandidate.participantB)} /{" "}
                {selectedCandidate.ticketLabel}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-black/55">
              {selectedCandidate.occurredDate}
            </span>
          </div>
          <OfferDraftFields
            className="mt-4"
            draft={draft}
            templates={templates}
            profiles={[]}
            hideParticipants
            onDraftChange={onDraftChange}
          />
          <button
            type="button"
            disabled={saving}
            onClick={onCreate}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-bold text-white disabled:bg-black/25"
          >
            <Send size={16} aria-hidden />
            블라인드 데이트 제안 만들기
          </button>
        </div>
      )}

      {candidates.length === 0 ? (
        <p className="mt-4 rounded-xl bg-black/[0.03] px-4 py-4 text-sm font-semibold text-black/45">
          아직 상호 선택 후보가 없습니다.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {candidates.map((candidate) => (
            <article
              key={candidate.id}
              className={cn(
                "rounded-2xl border p-4",
                candidate.alreadyOffered
                  ? "border-black/8 bg-black/[0.02]"
                  : "border-black/10 bg-white",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black">
                    {profileName(candidate.participantA)} ·{" "}
                    {profileName(candidate.participantB)}
                  </h4>
                  <p className="mt-1 text-xs font-semibold text-black/45">
                    {candidate.ticketLabel} · {candidate.occurredDate}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={candidate.alreadyOffered}
                  onClick={() => onSelectCandidate(candidate)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-black px-3 text-xs font-bold text-white transition hover:bg-black/85 disabled:bg-black/20"
                >
                  <Wand2 size={14} aria-hidden />
                  {candidate.alreadyOffered
                    ? "제안 생성됨"
                    : "블라인드 데이트 제안 만들기"}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] font-bold text-black/55">
                <SignalPill active={candidate.aSelectedB} label="A가 B 선택" />
                <SignalPill active={candidate.bSelectedA} label="B가 A 선택" />
                <SignalPill
                  active={candidate.hasNegativeFeedback}
                  label="부정 피드백"
                  warn
                />
                <SignalPill
                  active={candidate.hasNoShowOrMannerIssue}
                  label="노쇼/매너 이슈"
                  warn
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function OfferList({
  offers,
  saving,
  onStatusChange,
  onPlaceSave,
}: {
  offers: BlindDateAdminOffer[];
  saving: boolean;
  onStatusChange: (
    offer: BlindDateAdminOffer,
    status: BlindDateOfferStatus,
  ) => void;
  onPlaceSave: (
    offer: BlindDateAdminOffer,
    actualPlaceName: string,
    actualPlaceAddress: string,
  ) => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 p-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          offers
        </p>
        <h3 className="mt-1 text-lg font-bold">생성된 블라인드 데이트 제안</h3>
      </div>

      {offers.length === 0 ? (
        <p className="mt-4 rounded-xl bg-black/[0.03] px-4 py-4 text-sm font-semibold text-black/45">
          아직 생성된 제안이 없습니다.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1320px] w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="bg-[#f8f8f6] text-[11px] font-black uppercase tracking-wide text-black/42">
              <tr>
                <Th>상태</Th>
                <Th>참가자 A</Th>
                <Th>참가자 B</Th>
                <Th>템플릿</Th>
                <Th>시간 / 지역</Th>
                <Th>실제 장소</Th>
                <Th>가능 날짜</Th>
                <Th>A 응답</Th>
                <Th>B 응답</Th>
                <Th>A 가능 날짜</Th>
                <Th>B 가능 날짜</Th>
                <Th>확정 날짜</Th>
                <Th>마감</Th>
                <Th>구분</Th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <Td>
                    <select
                      value={offer.status}
                      disabled={saving}
                      onChange={(event) =>
                        onStatusChange(
                          offer,
                          event.target.value as BlindDateOfferStatus,
                        )
                      }
                      className="h-9 min-w-[128px] rounded-xl border border-black/10 bg-white px-2 font-bold outline-none"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td>{profileName(offer.participantA)}</Td>
                  <Td>{profileName(offer.participantB)}</Td>
                  <Td>{offer.template?.title ?? "-"}</Td>
                  <Td>
                    {offer.time_label} / {offer.region}
                  </Td>
                  <Td>
                    <OfferPlaceEditor
                      offer={offer}
                      saving={saving}
                      onSave={onPlaceSave}
                    />
                  </Td>
                  <Td>{formatDateRangeLabel(offer.candidate_dates)}</Td>
                  <Td>{responseLabel(offer.a_response)}</Td>
                  <Td>{responseLabel(offer.b_response)}</Td>
                  <Td>
                    {offer.a_available_dates.length
                      ? offer.a_available_dates.map(formatDateLabel).join(", ")
                      : "-"}
                  </Td>
                  <Td>
                    {offer.b_available_dates.length
                      ? offer.b_available_dates.map(formatDateLabel).join(", ")
                      : "-"}
                  </Td>
                  <Td>{formatDateLabel(offer.scheduled_date)}</Td>
                  <Td>{formatKoreanDateTime(offer.expires_at)}</Td>
                  <Td>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-black",
                        offer.is_test
                          ? "bg-violet-50 text-violet-700"
                          : "bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {offer.is_test ? "테스트 제안" : "상호 선택"}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OfferPlaceEditor({
  offer,
  saving,
  onSave,
}: {
  offer: BlindDateAdminOffer;
  saving: boolean;
  onSave: (
    offer: BlindDateAdminOffer,
    actualPlaceName: string,
    actualPlaceAddress: string,
  ) => void;
}) {
  const [actualPlaceName, setActualPlaceName] = useState(
    offer.actual_place_name ?? "",
  );
  const [actualPlaceAddress, setActualPlaceAddress] = useState(
    offer.actual_place_address ?? "",
  );

  useEffect(() => {
    setActualPlaceName(offer.actual_place_name ?? "");
    setActualPlaceAddress(offer.actual_place_address ?? "");
  }, [offer.id, offer.actual_place_name, offer.actual_place_address]);

  const dirty =
    actualPlaceName !== (offer.actual_place_name ?? "") ||
    actualPlaceAddress !== (offer.actual_place_address ?? "");

  return (
    <div className="grid min-w-[230px] gap-2">
      <input
        value={actualPlaceName}
        disabled={saving}
        placeholder="장소명"
        onChange={(event) => setActualPlaceName(event.target.value)}
        className="h-8 rounded-lg border border-black/10 bg-white px-2 text-xs font-semibold outline-none focus:border-accent disabled:opacity-45"
      />
      <input
        value={actualPlaceAddress}
        disabled={saving}
        placeholder="주소"
        onChange={(event) => setActualPlaceAddress(event.target.value)}
        className="h-8 rounded-lg border border-black/10 bg-white px-2 text-xs font-semibold outline-none focus:border-accent disabled:opacity-45"
      />
      <button
        type="button"
        disabled={saving || !dirty}
        onClick={() => onSave(offer, actualPlaceName, actualPlaceAddress)}
        className="h-8 rounded-lg bg-black px-3 text-[11px] font-bold text-white disabled:bg-black/20"
      >
        장소 저장
      </button>
    </div>
  );
}

function TestMatchSection({
  profiles,
  templates,
  draft,
  saving,
  onDraftChange,
  onCreate,
}: {
  profiles: BlindDateAdminProfile[];
  templates: BlindDateTemplate[];
  draft: OfferDraft;
  saving: boolean;
  onDraftChange: (draft: OfferDraft) => void;
  onCreate: () => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-[#fbfbfa] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
          <AlertTriangle size={18} aria-hidden />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
            test matching
          </p>
          <h3 className="mt-1 text-lg font-bold">테스트 매칭 생성</h3>
          <p className="mt-1 text-xs font-semibold text-black/45">
            피드백 상호 선택 없이 임의 참가자 2명에게 실제 사용자 화면용 테스트
            초대장을 생성합니다.
          </p>
        </div>
      </div>

      <OfferDraftFields
        className="mt-4"
        draft={draft}
        templates={templates}
        profiles={profiles}
        onDraftChange={onDraftChange}
      />
      <button
        type="button"
        disabled={saving}
        onClick={onCreate}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-bold text-white disabled:bg-black/25"
      >
        <Check size={16} aria-hidden />
        테스트 제안 생성
      </button>
    </section>
  );
}

function OfferDraftFields({
  className,
  draft,
  templates,
  profiles,
  hideParticipants = false,
  onDraftChange,
}: {
  className?: string;
  draft: OfferDraft;
  templates: BlindDateTemplate[];
  profiles: BlindDateAdminProfile[];
  hideParticipants?: boolean;
  onDraftChange: (draft: OfferDraft) => void;
}) {
  const selectedTemplate = templates.find((template) => template.id === draft.templateId);

  return (
    <div className={cn("grid gap-3", className)}>
      {!hideParticipants && (
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="참가자 A"
            value={draft.participantAId}
            onChange={(participantAId) =>
              onDraftChange({ ...draft, participantAId })
            }
          >
            <option value="">선택</option>
            {profiles.map((profile) => (
              <option key={profile.user_id} value={profile.user_id}>
                {profileLabel(profile)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="참가자 B"
            value={draft.participantBId}
            onChange={(participantBId) =>
              onDraftChange({ ...draft, participantBId })
            }
          >
            <option value="">선택</option>
            {profiles.map((profile) => (
              <option key={profile.user_id} value={profile.user_id}>
                {profileLabel(profile)}
              </option>
            ))}
          </SelectField>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <SelectField
          label="블라인드 데이트 템플릿"
          value={draft.templateId}
          onChange={(templateId) => {
            const template = templates.find((item) => item.id === templateId);
            onDraftChange(
              applyTemplateToDraft(
                {
                  ...draft,
                  templateId,
                  timeLabel: template?.time_label ?? draft.timeLabel,
                  region: template?.region ?? draft.region,
                  actualPlaceName:
                    template?.actual_place_name ?? draft.actualPlaceName,
                  actualPlaceAddress:
                    template?.actual_place_address ?? draft.actualPlaceAddress,
                },
                template,
              ),
            );
          }}
        >
          <option value="">선택</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title}
              {template.active ? "" : " (비활성)"}
            </option>
          ))}
        </SelectField>
        <TextField
          label="시간대"
          value={draft.timeLabel || selectedTemplate?.time_label || ""}
          onChange={(timeLabel) => onDraftChange({ ...draft, timeLabel })}
        />
        <TextField
          label="지역"
          value={draft.region || selectedTemplate?.region || ""}
          onChange={(region) => onDraftChange({ ...draft, region })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="실제 장소명"
          value={draft.actualPlaceName || selectedTemplate?.actual_place_name || ""}
          onChange={(actualPlaceName) =>
            onDraftChange({ ...draft, actualPlaceName })
          }
        />
        <TextField
          label="실제 주소"
          value={
            draft.actualPlaceAddress ||
            selectedTemplate?.actual_place_address ||
            ""
          }
          onChange={(actualPlaceAddress) =>
            onDraftChange({ ...draft, actualPlaceAddress })
          }
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_240px] gap-3">
        <BlindDateDateWindowPreview />
        <label className="block">
          <span className="text-xs font-bold text-black/45">응답 마감 시간</span>
          <input
            type="datetime-local"
            value={draft.expiresAtLocal}
            onChange={(event) =>
              onDraftChange({ ...draft, expiresAtLocal: event.target.value })
            }
            className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-accent"
          />
          <span className="mt-2 block text-[11px] font-semibold leading-4 text-black/35">
            비워두지 않으면 입력한 시각을 마감으로 사용합니다. 기본값은 24시간
            뒤입니다.
          </span>
        </label>
      </div>
    </div>
  );
}

function BlindDateDateWindowPreview() {
  const dateWindow = blindDateSelectableDateWindowFrom(new Date());

  return (
    <div className="block">
      <span className="text-xs font-bold text-black/45">가능 날짜</span>
      <div className="mt-2 min-h-[118px] rounded-xl border border-black/10 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-black/42">
          <CalendarDays size={15} aria-hidden />
          <span className="text-[11px] font-bold">제안 생성 기준</span>
        </div>
        <p className="mt-3 text-sm font-black text-black">
          {formatDateLabel(dateWindow.start)} ~ {formatDateLabel(dateWindow.end)}
        </p>
        <p className="mt-2 text-[11px] font-semibold leading-4 text-black/35">
          생성 당일과 다음날을 제외한 뒤 2주간 자동으로 열립니다.
        </p>
      </div>
    </div>
  );
}

function SignalPill({
  active,
  label,
  warn = false,
}: {
  active: boolean;
  label: string;
  warn?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1.5 text-center",
        active
          ? warn
            ? "bg-amber-50 text-amber-700"
            : "bg-emerald-50 text-emerald-700"
          : "bg-black/[0.04] text-black/35",
      )}
    >
      {label}: {active ? "있음" : "없음"}
    </span>
  );
}

function responseLabel(value: string) {
  if (value === "yes") return "YES";
  if (value === "no") return "NO";
  return "대기";
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f7f7f5] px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-black/35">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-black">{value}</p>
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-black/45">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-accent"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  rows,
  className,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  rows: number;
  className?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-xs font-bold text-black/45">{label}</span>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold leading-5 outline-none focus:border-accent"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  children,
  onChange,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-black/45">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-accent"
      >
        {children}
      </select>
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-black/10 px-3 py-3">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="border-b border-black/5 px-3 py-3 font-semibold text-black/62">
      {children}
    </td>
  );
}

function StateMessage({
  message,
  tone = "default",
}: {
  message: string;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={cn(
        "flex h-full items-center justify-center text-sm font-semibold",
        tone === "error" ? "text-red-600" : "text-black/45",
      )}
    >
      {message}
    </div>
  );
}
