export const MEETING_DATE_DEPOSIT_AMOUNT = 10_000;
export const MEETING_DATE_REGION = "서울";
export type MeetingDateApplicationStatus =
  | "payment_pending"
  | "waitlisted"
  | "on_hold"
  | "approved"
  | "not_selected"
  | "cancelled"
  | "feedback_done"
  | "completed";

export type MeetingDateDepositStatus =
  | "payment_pending"
  | "confirmed"
  | "refund_pending"
  | "refunded"
  | "forfeited";

export type MeetingDateApplication = {
  id: number | string;
  meetingDate: string;
  meetingTime: string;
  region: string;
  status: MeetingDateApplicationStatus;
  depositAmount: number;
  depositStatus: MeetingDateDepositStatus;
  assignedTicketInstanceId: string | null;
  createdAt: string | null;
};

function dateParts(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, weekday: date.getUTCDay() };
}

function formatUtcDate(value: number) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function meetingDateApplicationDates(today: string) {
  const current = dateParts(today);
  if (!current) return [];

  const dayMs = 24 * 60 * 60 * 1000;
  const currentDateMs = Date.UTC(current.year, current.month - 1, current.day);
  const daysUntilVisibleFriday =
    current.weekday === 6 ? 6 : (5 - current.weekday + 7) % 7;
  const visibleFridayMs = currentDateMs + daysUntilVisibleFriday * dayMs;

  return [0, 1, 7, 8].map((offset) =>
    formatUtcDate(visibleFridayMs + offset * dayMs),
  );
}

export function meetingDateSchedule(value: string) {
  const parts = dateParts(value);
  if (!parts) return null;

  if (parts.weekday === 5) {
    return {
      ...parts,
      weekdayLabel: "금요일",
      time: "19:00",
      timeLabel: "오후 7시",
    };
  }

  if (parts.weekday === 6) {
    return {
      ...parts,
      weekdayLabel: "토요일",
      time: "18:00",
      timeLabel: "오후 6시",
    };
  }

  return null;
}

export function isMeetingDateApplicationDate(value: string) {
  return Boolean(meetingDateSchedule(value));
}

export function meetingDateLabel(value: string) {
  const schedule = meetingDateSchedule(value);
  if (!schedule) return value;

  return `${schedule.month}월 ${schedule.day}일 ${schedule.weekdayLabel}`;
}

export function meetingDateRelativeWeekLabel(value: string, today: string) {
  const target = dateParts(value);
  const current = dateParts(today);
  const schedule = meetingDateSchedule(value);
  if (!target || !current || !schedule) return schedule?.weekdayLabel ?? value;

  const dayMs = 24 * 60 * 60 * 1000;
  const weekMs = 7 * dayMs;
  const targetDateMs = Date.UTC(target.year, target.month - 1, target.day);
  const currentDateMs = Date.UTC(current.year, current.month - 1, current.day);
  const targetMonday =
    targetDateMs - ((target.weekday + 6) % 7) * dayMs;
  const currentMonday =
    currentDateMs - ((current.weekday + 6) % 7) * dayMs;
  const weekOffset = Math.round((targetMonday - currentMonday) / weekMs);

  if (weekOffset === 0) return `이번주 ${schedule.weekdayLabel}`;
  if (weekOffset === 1) return `다음주 ${schedule.weekdayLabel}`;
  if (weekOffset > 1) return `${weekOffset}주 후 ${schedule.weekdayLabel}`;

  return schedule.weekdayLabel;
}

export const meetingDateApplicationStatusLabels: Record<
  MeetingDateApplicationStatus,
  string
> = {
  payment_pending: "입금 확인 중",
  waitlisted: "배정 대기",
  on_hold: "배정 보류",
  approved: "참여 확정",
  not_selected: "미배정",
  cancelled: "취소",
  feedback_done: "참여 완료",
  completed: "참여 완료",
};

export const meetingDateDepositStatusLabels: Record<
  MeetingDateDepositStatus,
  string
> = {
  payment_pending: "입금 확인 필요",
  confirmed: "참여 보증금 확인",
  refund_pending: "환급 예정",
  refunded: "환급 완료",
  forfeited: "미환급",
};
