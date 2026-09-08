"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TicketDetailContent } from "@/features/meetings/TicketDetailContent";
import {
  programDraft,
  programPreview,
  type AdminProgram,
  type ProgramDraft,
} from "./programDraft";

const LegacyTickets = dynamic(() =>
  import("./TicketAdminPanel").then((module) => module.TicketAdminPanel),
);
const inputClass =
  "w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm";
const buttonClass =
  "rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40";

export function ProgramAdminPanel(props: {
  onCreateEvent: (programId: string) => void;
  onOpenEvent?: (eventId: string) => void;
  focusTicketId?: string | null;
  onFocusTicketHandled?: () => void;
}) {
  const [legacy, setLegacy] = useState(false);
  const [programs, setPrograms] = useState<AdminProgram[]>([]);
  const [selected, setSelected] = useState<AdminProgram | null>(null);
  const [draft, setDraft] = useState<ProgramDraft>(() => programDraft());
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(programDraft()),
  );
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = baseline !== JSON.stringify(draft);
  const preview = useMemo(() => programPreview(draft), [draft]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/programs", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPrograms(result.programs);
    } catch {
      setError("프로그램을 불러오지 못했습니다. 새로고침해주세요.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (props.focusTicketId) setLegacy(true);
  }, [props.focusTicketId]);

  function select(program: AdminProgram | null) {
    if (dirty && !window.confirm("저장하지 않은 변경사항을 버리고 이동할까요?"))
      return;
    const next = programDraft(program ?? undefined);
    setSelected(program);
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setMessage("");
    setError("");
  }
  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: selected?.id, draft }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const next = programDraft(result.program);
      setPrograms((current) => [result.program, ...current]);
      setSelected(result.program);
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setMessage(
        "저장했습니다. ‘이 프로그램으로 모임 만들기’에서 날짜를 지정해주세요.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">프로그램 관리</h2>
          <p className="mt-1 text-sm text-black/50">
            프로그램 제목과 기본 여정을 준비하세요. 날짜와 장소는 행사
            관리에서 정합니다.
          </p>
        </div>
        <button
          className={buttonClass}
          disabled={saving}
          onClick={() => setLegacy(!legacy)}
        >
          {legacy ? "프로그램으로 돌아가기" : "기존 티켓·샘플 도구"}
        </button>
      </header>
      {legacy ? (
        <>
          <p className="rounded-xl bg-amber-50 p-4 text-sm">
            이전 티켓·샘플을 위한 도구입니다. 새 모임은 프로그램 → 행사 관리에서
            만들어주세요.
          </p>
          <LegacyTickets {...props} />
        </>
      ) : (
        <>
          {(message || error) && (
            <p
              role="status"
              className={`rounded-xl p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}
            >
              {error || message}
            </p>
          )}
          <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_380px]">
            <aside className="space-y-3">
              <div className="flex gap-2">
                <button
                  disabled={saving}
                  className={buttonClass}
                  onClick={() => select(null)}
                >
                  + 새 프로그램
                </button>
                <button
                  disabled={loading || saving}
                  className={buttonClass}
                  onClick={() => void load()}
                >
                  새로고침
                </button>
              </div>
              <input
                aria-label="프로그램 검색"
                className={inputClass}
                placeholder="프로그램 제목 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="max-h-[70vh] space-y-2 overflow-y-auto">
                {loading && <p className="p-3 text-sm">불러오는 중...</p>}
                {!loading && programs.length === 0 && (
                  <p className="p-3 text-sm text-black/50">
                    새 프로그램을 만들어주세요.
                  </p>
                )}
                {programs
                  .filter((p) => p.title.includes(query))
                  .map((program) => (
                    <button
                      key={program.id}
                      disabled={saving}
                      onClick={() => select(program)}
                      className={`w-full rounded-2xl border p-4 text-left ${selected?.id === program.id ? "border-black bg-black text-white" : "border-black/10 bg-white"}`}
                    >
                      <p className="font-bold">{program.title}</p>
                      <p className="mt-2 text-xs opacity-60">
                        저장{" "}
                        {new Date(program.updated_at).toLocaleString("ko-KR")}
                      </p>
                    </button>
                  ))}
              </div>
            </aside>
            <div className="min-w-0 rounded-2xl border border-black/10 bg-white p-5">
              <p className="mb-5 rounded-xl bg-[#f6f4ef] p-3 text-sm leading-6">
                수정한 내용은 새 프로그램으로 저장됩니다. 기존 행사와 신청
                티켓에는 영향을 주지 않습니다.
              </p>
              <fieldset disabled={saving} className="space-y-5">
                <Field
                  label="프로그램 제목"
                  value={draft.title}
                  onChange={(title) => setDraft({ ...draft, title })}
                />
                <section className="space-y-3">
                  <h3 className="font-bold">기본 여정</h3>
                  <p className="text-xs text-black/50">
                    활동 이름과 순서를 정하세요. 실제 시간·장소는 행사에서
                    설정합니다.
                  </p>
                  {draft.steps.map((step, index) => (
                    <div
                      key={index}
                      className="space-y-3 rounded-xl border border-black/10 p-3"
                    >
                      <Field
                        label={`${index + 1}번째 활동`}
                        value={step.title}
                        onChange={(title) =>
                          setDraft({
                            ...draft,
                            steps: draft.steps.map((s, i) =>
                              i === index ? { ...s, title } : s,
                            ),
                          })
                        }
                      />
                      {index === 2 && (
                        <button
                          className={buttonClass}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              steps: draft.steps.slice(0, 2),
                            })
                          }
                        >
                          활동 삭제
                        </button>
                      )}
                    </div>
                  ))}
                  {draft.steps.length < 3 && (
                    <button
                      className={buttonClass}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          steps: [
                            ...draft.steps,
                            { title: "" },
                          ],
                        })
                      }
                    >
                      활동 추가
                    </button>
                  )}
                </section>
                <details>
                  <summary className="cursor-pointer font-bold">
                    진행 단계별 안내 문구
                  </summary>
                  <div className="mt-4 space-y-3">
                    <p className="text-xs leading-5 text-black/50">신청·참여 상태 문구는 티켓 상단에, 피드백 제목·본문은 피드백 작성 화면에 표시됩니다. 비워두면 공통 기본 문구를 사용합니다.</p>
                    {Object.entries(copyLabels).map(([key, label]) => (
                      <Field
                        key={key}
                        label={label}
                        multiline
                        value={
                          draft.stageCopy[key as keyof typeof copyLabels] ?? ""
                        }
                        onChange={(value) =>
                          setDraft({
                            ...draft,
                            stageCopy: { ...draft.stageCopy, [key]: value },
                          })
                        }
                      />
                    ))}
                  </div>
                </details>
                <div className="flex flex-wrap gap-2 border-t border-black/10 pt-4">
                  <button
                    className={`${buttonClass} !bg-black text-white`}
                    disabled={!dirty || !draft.title.trim()}
                    onClick={() => void save()}
                  >
                    {saving
                      ? "저장 중..."
                      : selected
                        ? "새 수정본으로 저장"
                        : "프로그램 저장"}
                  </button>
                  <button
                    className={buttonClass}
                    disabled={!selected || dirty}
                    onClick={() => selected && props.onCreateEvent(selected.id)}
                  >
                    이 프로그램으로 모임 만들기
                  </button>
                </div>
                {dirty && (
                  <p className="text-xs text-black/50">
                    변경사항을 저장하면 모임을 만들 수 있어요.
                  </p>
                )}
              </fieldset>
            </div>
            <aside className="min-w-0">
              <h3 className="mb-3 font-bold">사용자 화면 미리보기</h3>
              <p className="mb-3 text-xs text-black/50">
                기본 내용 미리보기입니다. 날짜·시간·장소는 행사 설정에 따라
                표시됩니다.
              </p>
              <div className="overflow-hidden rounded-[28px] border border-black/10 bg-[#faf8f2]">
                <h2 className="px-6 pt-8 text-center text-2xl font-bold">
                  {preview.title}
                </h2>
                <TicketDetailContent
                  ticket={preview}
                  className="px-5 pb-6"
                  startWithBorder
                />
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

const copyLabels = {
  paymentPending: "결제 확인 중",
  waitlisted: "신청 대기",
  applied: "신청 완료",
  approved: "참여 확정",
  preStart: "시작 전",
  inProgress: "진행 중",
  feedbackOpen: "피드백 공개",
  feedbackTitle: "피드백 제목",
  feedbackBody: "피드백 본문",
} as const;
function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block text-sm font-bold">
      {label}
      {multiline ? (
        <textarea
          className={`${inputClass} mt-2 min-h-24`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={`${inputClass} mt-2`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
