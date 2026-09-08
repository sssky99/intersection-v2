import type { WaitlistStatus } from "@/lib/waitlistStatus";
export { isWaitlistStatus, waitlistStatuses, type WaitlistStatus } from "@/lib/waitlistStatus";
import type { AdminProfile } from "@/features/admin/adminProfile";
import type { GatheringTicket } from "@/types/ticket";
import type {
  MeetingDateDepositStatus,
} from "@/lib/meetingDateApplications";

export type AdminArrivalStatus =
  | "on_time"
  | "late_10"
  | "late_20"
  | "late_30_plus"
  | "no_show";

export const waitlistStatusLabels: Record<WaitlistStatus, string> = {
  waitlisted: "대기중",
  approved: "승인",
  on_hold: "보류",
  not_selected: "미선정",
  cancelled: "취소",
  payment_pending: "멤버십 결제 확인 중",
  feedback_done: "피드백 완료",
  completed: "모임 종료",
};

export const arrivalStatusLabels: Record<AdminArrivalStatus, string> = {
  on_time: "정상 도착 예정",
  late_10: "10분 정도 늦음",
  late_20: "20분 정도 늦음",
  late_30_plus: "30분 이상 늦음",
  no_show: "불참",
};

export type WaitlistTicketTemplate = {
  id: string;
  title: string;
};

export type WaitlistTicketInstance = {
  id: string;
  template_id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  operation_code: string | null;
};

export type AdminWaitlistRow = {
  is_friend_application?: boolean;
  friend_name?: string | null;
  id: number | string;
  source: "ticket_participation" | "date_application";
  source_id: number | string;
  user_id: string;
  ticket_id: string;
  ticket_template_id: string | null;
  ticket_instance_id: string | null;
  meeting_date: string | null;
  status: WaitlistStatus;
  arrival_status: AdminArrivalStatus | null;
  arrival_status_updated_at: string | null;
  admin_note: string | null;
  ticket_snapshot: GatheringTicket | null;
  created_at: string | null;
  updated_at: string | null;
  deposit_amount: number | null;
  deposit_status: MeetingDateDepositStatus | null;
  profile: AdminProfile | null;
  ticket_template: WaitlistTicketTemplate | null;
  ticket_instance: WaitlistTicketInstance | null;
};

export type AdminWaitlistData = {
  waitlist: AdminWaitlistRow[];
  templates: WaitlistTicketTemplate[];
  instances: WaitlistTicketInstance[];
};
