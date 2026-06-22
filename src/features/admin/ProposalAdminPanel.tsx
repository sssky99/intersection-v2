"use client";

import {
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Save,
  Search,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { VibeAxisBar } from "@/components/vibe/VibeGraph";
import { vibeAxes, type VibeScores } from "@/components/vibe/vibeGraphConfig";
import type { AdminMeetingProposal } from "@/features/admin/proposalAdminTypes";
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
  flowText: string;
  vibe: VibeScores;
  status: MeetingProposalStatus;
  adminNote: string;
};

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

function splitTags(value: string) {
  return value
    .split(/[#,\s]+/)
    .map((item) => item.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 3);
}

function splitLines(value: string, limit = 5) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function draftFromProposal(proposal: AdminMeetingProposal): ProposalDraft {
  return {
    imageUrl: proposal.imageUrl ?? "",
    title: proposal.title,
    activityDescription: proposal.activityDescription,
    eventDate: proposal.eventDate,
    eventTime: proposal.eventTime,
    region: proposal.region,
    specificPlace: proposal.specificPlace ?? "",
    hashtagsText: proposal.hashtags.join(", "),
    shortDescription: proposal.shortDescription,
    activitiesText: proposal.activities.join("\n"),
    flowText: proposal.flow.join("\n"),
    vibe: proposal.vibe,
    status: proposal.status,
    adminNote: proposal.adminNote ?? "",
  };
}

export function ProposalAdminPanel() {
  const [proposals, setProposals] = useState<AdminMeetingProposal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProposalDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const selectedProposal =
    proposals.find((proposal) => proposal.id === selectedId) ?? null;

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
  }, [selectedProposal?.id]);

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
    if (!selectedProposal || !draft || saving) return false;

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
        eventTime: draft.eventTime,
        region: draft.region,
        specificPlace: draft.specificPlace,
        hashtags: splitTags(draft.hashtagsText),
        shortDescription: draft.shortDescription,
        activities: splitLines(draft.activitiesText, 4),
        vibe: draft.vibe,
        flow: splitLines(draft.flowText, 5),
        status: draft.status,
        adminNote: draft.adminNote,
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

  const convertToTicket = async () => {
    if (!selectedProposal || !draft || converting) return;

    const saved = await saveDraft({ silent: true });
    if (!saved) return;

    setConverting(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/admin/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "convert_to_ticket",
        proposalId: selectedProposal.id,
      }),
    }).catch(() => null);
    const data = response
      ? ((await response.json().catch(() => null)) as ProposalResponse | null)
      : null;

    if (!response?.ok || !data?.proposals) {
      setError(data?.error ?? "초대장으로 전환하지 못했습니다.");
      setConverting(false);
      return;
    }

    replaceFromResponse(data.proposals);
    setNotice("제안을 초대장으로 전환하고 제안자를 참여 확정했어요.");
    setConverting(false);
  };

  if (loading && proposals.length === 0) {
    return <StateMessage message="제안 목록을 불러오고 있어요." />;
  }

  return (
    <section className="grid min-h-[calc(100dvh-180px)] grid-cols-[360px_minmax(0,1fr)] gap-5">
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <header className="shrink-0 border-b border-black/10 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
                proposals
              </p>
              <h2 className="mt-1 text-xl font-bold">제안 관리</h2>
            </div>
            <button
              type="button"
              onClick={() => void loadProposals()}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-black/45"
              aria-label="제안 새로고침"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
          <label className="mt-4 flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-[#f7f7f5] px-3">
            <Search size={15} className="text-black/32" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목, 지역, 제안자 검색"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-black/30"
            />
          </label>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {filteredProposals.length === 0 ? (
            <StateMessage message="확인할 제안이 없습니다." />
          ) : (
            <div className="space-y-2">
              {filteredProposals.map((proposal) => (
                <button
                  key={proposal.id}
                  type="button"
                  onClick={() => setSelectedId(proposal.id)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left transition hover:border-accent/60",
                    selectedId === proposal.id
                      ? "border-accent bg-accent/[0.08]"
                      : "border-black/8 bg-white",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-black">
                        {proposal.title}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-black/45">
                        {proposal.proposerProfile.displayName} · {proposal.region}
                      </p>
                    </div>
                    <StatusBadge status={proposal.status} />
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-black/35">
                    {formatDateTime(proposal.submittedAt)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <main className="min-h-0 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        {!selectedProposal || !draft ? (
          <StateMessage message="제안을 선택하면 상세 정보가 표시됩니다." />
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <header className="shrink-0 border-b border-black/10 px-6 py-5">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
                    proposal detail
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">
                    {selectedProposal.title}
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-black/45">
                    {selectedProposal.proposerProfile.displayName}님 제안 · 제출{" "}
                    {formatDateTime(selectedProposal.submittedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void saveDraft()}
                    disabled={saving || converting}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-bold text-black/62 disabled:opacity-45"
                  >
                    {saving ? (
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                    ) : (
                      <Save size={15} aria-hidden />
                    )}
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => void convertToTicket()}
                    disabled={
                      saving ||
                      converting ||
                      selectedProposal.status === "converted_to_ticket"
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white disabled:bg-black/25"
                  >
                    {converting ? (
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                    ) : (
                      <WandSparkles size={15} aria-hidden />
                    )}
                    초대장으로 만들기
                  </button>
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              {(error || notice) && (
                <p
                  className={cn(
                    "mb-5 rounded-2xl px-4 py-3 text-sm font-semibold",
                    error ? "bg-red-50 text-red-600" : "bg-accent/10 text-black/65",
                  )}
                >
                  {error ?? notice}
                </p>
              )}

              <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-6">
                <aside className="space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-black/10 bg-[#f7f7f5]">
                    {draft.imageUrl ? (
                      <img
                        src={draft.imageUrl}
                        alt=""
                        className="h-[360px] w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-[360px] items-center justify-center text-black/30">
                        <ImageIcon size={32} aria-hidden />
                      </div>
                    )}
                  </div>
                  <InfoCard
                    title="제안자"
                    rows={[
                      ["공개 이름", selectedProposal.proposerProfile.displayName],
                      ["제출 당시 멤버십", display(selectedProposal.proposerMembershipStatus)],
                      ["현재 멤버십", display(selectedProposal.proposerCurrentMembershipStatus)],
                      ["역할 동의", selectedProposal.proposerRoleAgreed ? "동의" : "미동의"],
                    ]}
                  />
                  <InfoCard
                    title="전환 정보"
                    rows={[
                      ["상태", meetingProposalStatusLabels[selectedProposal.status]],
                      ["템플릿 ID", display(selectedProposal.convertedTemplateId)],
                      ["회차 ID", display(selectedProposal.convertedInstanceId)],
                      ["전환일", formatDateTime(selectedProposal.convertedAt)],
                    ]}
                  />
                </aside>

                <section className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <AdminField
                      label="제목"
                      value={draft.title}
                      onChange={(value) => setDraft({ ...draft, title: value })}
                    />
                    <label className="block">
                      <span className="text-xs font-bold text-black/45">상태</span>
                      <select
                        value={draft.status}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            status: event.target.value as MeetingProposalStatus,
                          })
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none"
                      >
                        {meetingProposalStatuses.map((status) => (
                          <option key={status} value={status}>
                            {meetingProposalStatusLabels[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <AdminField
                    label="사진 URL"
                    value={draft.imageUrl}
                    onChange={(value) => setDraft({ ...draft, imageUrl: value })}
                  />

                  <div className="grid grid-cols-4 gap-4">
                    <AdminField
                      label="지역"
                      value={draft.region}
                      onChange={(value) => setDraft({ ...draft, region: value })}
                    />
                    <AdminField
                      label="날짜"
                      type="date"
                      value={draft.eventDate}
                      onChange={(value) => setDraft({ ...draft, eventDate: value })}
                    />
                    <AdminField
                      label="시간"
                      type="time"
                      value={draft.eventTime}
                      onChange={(value) => setDraft({ ...draft, eventTime: value })}
                    />
                    <AdminField
                      label="구체적 장소"
                      value={draft.specificPlace}
                      onChange={(value) =>
                        setDraft({ ...draft, specificPlace: value })
                      }
                    />
                  </div>

                  <AdminTextarea
                    label="활동 설명"
                    value={draft.activityDescription}
                    onChange={(value) =>
                      setDraft({ ...draft, activityDescription: value })
                    }
                  />
                  <AdminField
                    label="해시태그"
                    value={draft.hashtagsText}
                    onChange={(value) => setDraft({ ...draft, hashtagsText: value })}
                  />
                  <AdminTextarea
                    label="한 줄 설명"
                    value={draft.shortDescription}
                    onChange={(value) =>
                      setDraft({ ...draft, shortDescription: value })
                    }
                  />
                  <AdminTextarea
                    label="이 자리에서는 이런 걸 해요"
                    value={draft.activitiesText}
                    onChange={(value) =>
                      setDraft({ ...draft, activitiesText: value })
                    }
                  />

                  <section className="rounded-2xl border border-black/10 bg-[#fbfbfa] p-4">
                    <h3 className="text-sm font-bold">자리 분위기</h3>
                    <div className="mt-4 space-y-5">
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
                                setDraft({
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

                  <AdminTextarea
                    label="이렇게 진행돼요"
                    value={draft.flowText}
                    onChange={(value) => setDraft({ ...draft, flowText: value })}
                  />
                  <AdminTextarea
                    label="관리자 메모"
                    value={draft.adminNote}
                    onChange={(value) => setDraft({ ...draft, adminNote: value })}
                  />
                </section>
              </div>
            </div>
          </div>
        )}
      </main>
    </section>
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
    <section className="rounded-2xl border border-black/10 bg-white p-4">
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

function AdminField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date" | "time";
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-black/45">{label}</span>
      <input
        type={type}
        step={type === "time" ? 900 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none transition focus:border-accent"
      />
    </label>
  );
}

function AdminTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-black/45">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-2 w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold leading-6 outline-none transition focus:border-accent"
      />
    </label>
  );
}

function StateMessage({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center text-sm font-semibold text-black/45">
      {message}
    </div>
  );
}
