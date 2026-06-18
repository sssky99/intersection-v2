import type { AdminProfile } from "@/features/admin/adminProfile";
import type { GatheringTicket } from "@/types/ticket";

export type WaitlistStatus =
  | "waitlisted"
  | "approved"
  | "on_hold"
  | "not_selected"
  | "cancelled"
  | "payment_pending";

export const waitlistStatuses: WaitlistStatus[] = [
  "waitlisted",
  "approved",
  "on_hold",
  "not_selected",
  "cancelled",
  "payment_pending",
];

export const waitlistStatusLabels: Record<WaitlistStatus, string> = {
  waitlisted: "대기중",
  approved: "승인",
  on_hold: "보류",
  not_selected: "미선정",
  cancelled: "취소",
  payment_pending: "결제 확인 필요",
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
  id: number | string;
  user_id: string;
  ticket_id: string;
  ticket_template_id: string | null;
  ticket_instance_id: string | null;
  meeting_date: string | null;
  status: WaitlistStatus;
  admin_note: string | null;
  ticket_snapshot: GatheringTicket | null;
  created_at: string | null;
  updated_at: string | null;
  profile: AdminProfile | null;
  ticket_template: WaitlistTicketTemplate | null;
  ticket_instance: WaitlistTicketInstance | null;
};

export type AdminWaitlistData = {
  waitlist: AdminWaitlistRow[];
  templates: WaitlistTicketTemplate[];
  instances: WaitlistTicketInstance[];
};

export function isWaitlistStatus(value: unknown): value is WaitlistStatus {
  return (
    typeof value === "string" &&
    waitlistStatuses.includes(value as WaitlistStatus)
  );
}
