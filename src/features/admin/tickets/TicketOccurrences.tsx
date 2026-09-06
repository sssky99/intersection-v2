"use client";
import { profileName } from "@/features/admin/adminDisplay";
import {
  ticketVisibilityLabels,
  type AdminTicketCourseStep,
  type AdminTicketInstance,
  type TicketVisibility,
} from "@/features/admin/ticketAdminTypes";
import { cn } from "@/lib/cn";
import {
  courseStepOpenOffsetMinutes,
  TICKET_COURSE_MAX_STEPS,
} from "@/lib/ticketCourse";
import { Clock3, Copy, Plus, Trash2 } from "lucide-react";
import { IconButton } from "./TicketFormControls";

export type TestTimeMode =
  | "applied"
  | "approved"
  | "pre_start"
  | "in_progress"
  | "feedback"
  | "closed"
  | `activity:${number}`;

export type TestTimeOption = {
  mode: TestTimeMode;
  label: string;
  description: string;
};

export const testTimeBaseOptions: TestTimeOption[] = [
  { mode: "applied", label: "신청", description: "시작 24시간 전" },
  { mode: "approved", label: "확정", description: "시작 12시간 전" },
  { mode: "pre_start", label: "시작 전", description: "시작 1시간 전" },
  { mode: "feedback", label: "피드백", description: "시작 3시간 후" },
  { mode: "closed", label: "종료", description: "채팅 종료 후" },
];

export function testTimeOptions(courseSteps: AdminTicketCourseStep[]) {
  const activityOptions = courseSteps.length
    ? courseSteps.slice(0, TICKET_COURSE_MAX_STEPS).map((step, index) => ({
        mode: `activity:${index + 1}` as TestTimeMode,
        label: `${index + 1}차 활동`,
        description: `시작 ${courseStepOpenOffsetMinutes(step.openOffsetMinutes, index)}분 후`,
      }))
    : [
        {
          mode: "in_progress" as const,
          label: "진행 중",
          description: "시작 5분 후",
        },
      ];

  return [
    ...testTimeBaseOptions.slice(0, 3),
    ...activityOptions,
    ...testTimeBaseOptions.slice(3),
  ];
}

export const detailTicketLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function detailTicketLabel(index: number) {
  const letter = detailTicketLetters[index] ?? String(index + 1);
  return `세부티켓 ${letter}`;
}

export function OccurrenceManager({
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
          <h3 className="font-bold">세부티켓</h3>
          <p className="mt-1 text-xs font-semibold text-black/42">
            한 티켓에 모인 신청자를 A/B/C 팀으로 나눕니다. 날짜와 시간은
            공유하고, 장소와 참여자는 세부티켓별로 다르게 운영할 수 있어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <IconButton
            disabled={saving || !selectedInstanceId}
            onClick={onDuplicate}
            icon={Copy}
          >
            세부티켓 복제
          </IconButton>
          <IconButton
            disabled={saving || !selectedInstanceId}
            onClick={onDelete}
            icon={Trash2}
          >
            세부티켓 삭제
          </IconButton>
          <IconButton primary disabled={saving} onClick={onCreate} icon={Plus}>
            세부티켓 추가
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
                <span className="text-xs font-black">
                  {detailTicketLabel(index)}
                </span>
                <VisibilityBadge visibility={instance.visibility} />
              </div>
              <p className="mt-2 truncate text-sm font-bold">
                {instance.title || detailTicketLabel(index)}
              </p>
              <p className="mt-2 truncate text-sm font-bold">
                {[instance.event_date, instance.event_time]
                  .filter(Boolean)
                  .join(" ") || "일정 미정"}
              </p>
              <p className="mt-1 truncate text-xs font-semibold text-black/42">
                {instance.place_name || instance.region || "장소 미정"} · 참여{" "}
                {instance.participant_count}명
              </p>
              <div className="mt-3 border-t border-black/8 pt-3">
                <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
                  현재 그룹 멤버
                </p>
                {instance.participants.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {instance.participants.map((participation) => (
                      <span
                        key={participation.id}
                        className="inline-flex rounded-full border border-black/8 bg-black/[0.035] px-2.5 py-1 text-[11px] font-bold text-black/70"
                      >
                        {participation.profile
                          ? profileName(participation.profile)
                          : "프로필 확인 필요"}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] font-semibold text-black/32">
                    아직 배정된 멤버가 없습니다.
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-black/15 py-8 text-center text-xs font-semibold text-black/35">
          세부티켓 A가 아직 없습니다. 세부티켓을 추가해 주세요.
        </p>
      )}
    </section>
  );
}

export function TestTimeControl({
  instance,
  courseSteps,
  saving,
  onMove,
}: {
  instance: AdminTicketInstance;
  courseSteps: AdminTicketCourseStep[];
  saving: boolean;
  onMove: (mode: TestTimeMode) => void;
}) {
  const options = testTimeOptions(courseSteps);

  return (
    <section className="rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Clock3 size={18} aria-hidden />
        </div>
        <div>
          <h3 className="font-bold">테스트 시간 이동</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-black/52">
            운영자 전용 테스트 티켓에서만 사용할 수 있습니다. 단계를 선택하면
            참여자 화면의 채팅, 도착 확인, 피드백 상태를 바로 점검할 수
            있습니다.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.mode}
            type="button"
            disabled={saving}
            onClick={() => onMove(option.mode)}
            className="rounded-xl border border-black/10 bg-white px-3 py-3 text-left transition hover:border-accent hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="block text-sm font-bold text-black">
              {option.label}
            </span>
            <span className="mt-1 block text-[11px] font-semibold text-black/42">
              {option.description}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11px] font-semibold text-black/42">
        현재 설정:{" "}
        {[instance.event_date, instance.event_time].filter(Boolean).join(" ") ||
          "일정 미정"}
      </p>
    </section>
  );
}

export function VisibilityBadge({
  visibility,
}: {
  visibility: TicketVisibility;
}) {
  return (
    <span className="shrink-0 rounded-full bg-black/[0.05] px-2.5 py-1 text-[10px] font-bold text-black/50">
      {ticketVisibilityLabels[visibility]}
    </span>
  );
}
