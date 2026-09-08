"use client";
import { useEffect, useState } from "react";
import { sanitizeTicketStageCopy } from "@/lib/ticketStageCopy";
import {
  displayTicketCourseSteps,
  normalizeStoredTicketCourseSteps,
} from "@/lib/ticketCourse";
import { TicketDetailContent } from "@/features/meetings/TicketDetailContent";
import type { TicketStageCopy } from "@/types/ticket";
import type { AdminMeetingEvent } from "./meetingEventAdminTypes";

export function EventCommonContent({
  event,
  saving,
  onSave,
}: {
  event: AdminMeetingEvent;
  saving: boolean;
  onSave: (copy: TicketStageCopy) => Promise<unknown>;
}) {
  const [copy, setCopy] = useState<TicketStageCopy>({});
  useEffect(
    () => setCopy(sanitizeTicketStageCopy(event.detail_snapshot?.stageCopy)),
    [event.id, event.detail_snapshot],
  );
  return (
    <details className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
      <summary className="cursor-pointer font-bold">
        배정 전 공통 화면 · 진행 안내
      </summary>
      <p className="my-3 text-sm text-black/50">
        배정 대기 중에는 이 행사의 공통 여정을 봅니다. 배정 확정 후에는 조별
        장소와 멤버 정보가 공개 설정에 따라 반영됩니다.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-[#faf8f2] p-4">
          <h3 className="text-center text-xl font-bold">{event.title}</h3>
          <TicketDetailContent
            ticket={{
              id: event.id,
              templateId: event.program_id,
              title: event.title,
              subtitle: "",
              date: event.event_date,
              time: event.starts_at,
              area: event.region,
              moodTags: [],
              peopleHint: "",
              reason: "",
              courseSteps: displayTicketCourseSteps(
                normalizeStoredTicketCourseSteps(
                  event.detail_snapshot?.courseSteps,
                ),
                { includePlaceDetails: false },
              ),
            }}
          />
        </div>
        <fieldset disabled={saving} className="space-y-3">
          <p className="text-xs text-black/50">
            티켓 상단 상태 안내와 피드백 화면 문구입니다. 비워두면 공통 기본
            문구를 사용합니다.
          </p>
          {Object.entries(labels).map(([key, label]) => (
            <label key={key} className="block text-sm">
              {label}
              <textarea
                className="mt-1 w-full rounded-xl border p-2"
                value={copy[key as keyof TicketStageCopy] || ""}
                onChange={(e) => setCopy({ ...copy, [key]: e.target.value })}
              />
            </label>
          ))}
          <button
            className="rounded-xl bg-black px-4 py-2 text-white"
            onClick={() => void onSave(copy)}
          >
            진행 안내 저장
          </button>
        </fieldset>
      </div>
    </details>
  );
}
const labels = {
  paymentPending: "결제 확인 중",
  waitlisted: "신청 대기",
  applied: "신청 완료",
  approved: "참여 확정",
  preStart: "시작 전",
  inProgress: "진행 중",
  feedbackOpen: "피드백 공개",
  feedbackTitle: "피드백 제목",
  feedbackBody: "피드백 본문",
};
