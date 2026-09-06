import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isWaitlistStatus } from "@/lib/waitlistStatus";

class InvalidCommand extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function positiveId(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function ticketId(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value.trim())) {
    throw new InvalidCommand("세부 티켓 정보가 올바르지 않습니다.");
  }
  return value.trim();
}

/** All writes go through one atomic DB command; never add compensating API writes here. */
export async function executeWaitlistCommand(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new InvalidCommand("잘못된 요청입니다.");
  const body = input as Record<string, unknown>;
  const client = createAdminClient();
  const batchActions = ["distribute_date_applications", "assign_date_applications", "confirm_date_application_group"];
  if (typeof body.action === "string" && batchActions.includes(body.action)) {
    const instanceId = ticketId(body.ticketInstanceId);
    const confirm = body.action !== "distribute_date_applications";
    if (confirm && !instanceId) throw new InvalidCommand("세부 티켓을 선택해주세요.");
    let applicationIds: number[];
    if (body.action === "confirm_date_application_group") {
      const { data, error } = await client.from("meeting_date_applications").select("id")
        .eq("assigned_ticket_instance_id", instanceId!).eq("status", "waitlisted")
        .is("ticket_participation_id", null).returns<Array<{ id: number }>>();
      if (error) throw error;
      applicationIds = (data ?? []).map((row) => row.id);
      if (!applicationIds.length) throw new InvalidCommand("이 그룹에 확정할 대기 신청자가 없습니다.", 409);
    } else {
      if (!Array.isArray(body.applicationIds) || body.applicationIds.some((id) => positiveId(id) === null)) {
        throw new InvalidCommand("신청자 정보가 올바르지 않습니다.");
      }
      applicationIds = [...new Set(body.applicationIds.map((id) => positiveId(id)!))];
      if (!applicationIds.length) throw new InvalidCommand("신청자를 선택해주세요.");
    }
    const { data, error } = await client.rpc("admin_assign_waitlist_applications", {
      p_application_ids: applicationIds, p_ticket_instance_id: instanceId, p_confirm: confirm,
      p_only_current_group: body.action === "confirm_date_application_group",
    });
    if (error) throw error;
    return confirm ? { assignedCount: data as number } : { movedCount: data as number };
  }
  if (body.action !== undefined) throw new InvalidCommand("지원하지 않는 요청입니다.");
  const isApplication = typeof body.id === "string" && body.id.startsWith("date:");
  const id = positiveId(isApplication ? String(body.id).slice(5) : body.id);
  if (!id) throw new InvalidCommand("잘못된 신청자 정보입니다.");
  const patch: Record<string, string | null> = {};
  if ("status" in body) {
    if (!isWaitlistStatus(body.status)) throw new InvalidCommand("대기열 상태가 올바르지 않습니다.");
    patch.status = body.status;
  }
  if ("ticketInstanceId" in body) patch.ticketInstanceId = ticketId(body.ticketInstanceId);
  if ("adminNote" in body) {
    if (body.adminNote !== null && typeof body.adminNote !== "string") throw new InvalidCommand("메모가 올바르지 않습니다.");
    patch.adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() || null : null;
  }
  if (!Object.keys(patch).length) throw new InvalidCommand("변경할 내용이 없습니다.");
  const { error } = await client.rpc(isApplication ? "admin_update_meeting_application" : "admin_update_ticket_participation", {
    [isApplication ? "p_application_id" : "p_participation_id"]: id, p_patch: patch,
  });
  if (error) throw error;
  return {};
}

export function waitlistCommandError(error: unknown) {
  if (error instanceof InvalidCommand) return { status: error.status, message: error.message };
  const db = error as { code?: string; message?: string } | null;
  const status = db?.code === "P0002" ? 404 : db?.code === "22023" ? 400 :
    db?.code === "P0001" || db?.code === "23505" || db?.code === "40P01" ? 409 : 500;
  return { status, message: status !== 500 && db?.code !== "23505" && db?.code !== "40P01"
    ? db?.message || "요청을 처리하지 못했습니다."
    : status === 409 ? "배정 정보가 변경되었습니다. 새로고침 후 다시 시도해주세요." : "대기열 정보를 저장하지 못했습니다." };
}
