-- Operational commands own application/participation synchronization. API routes
-- authenticate and validate inputs; all related writes commit together here.
create or replace function public.admin_update_meeting_application(
  p_application_id bigint, p_patch jsonb
) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  application public.meeting_date_applications%rowtype;
  target public.ticket_instances%rowtype;
  next_instance_id uuid;
  next_status text;
  participation_id bigint;
  group_id uuid;
  moving boolean;
begin
  select * into application from public.meeting_date_applications
  where id = p_application_id for update;
  if not found then raise exception using errcode = 'P0002', message = '신청자를 찾을 수 없습니다.'; end if;
  next_instance_id := case when p_patch ? 'ticketInstanceId'
    then (p_patch->>'ticketInstanceId')::uuid else application.assigned_ticket_instance_id end;
  next_status := coalesce(p_patch->>'status', application.status);
  if next_status not in ('payment_pending','waitlisted','on_hold','approved','not_selected','cancelled','feedback_done','completed') then
    raise exception using errcode = '22023', message = '대기열 상태가 올바르지 않습니다.';
  end if;
  if application.ticket_participation_id is not null and next_instance_id is null then
    raise exception using errcode = 'P0001', message = '확정된 참여자는 다른 세부 티켓으로 이동하거나 취소 처리해주세요.';
  end if;
  if next_status = 'approved' and next_instance_id is null then
    raise exception using errcode = '22023', message = '참여 확정 전에 세부 티켓을 배정해주세요.';
  end if;
  -- Lock source and destination in stable order before the participation writer.
  perform id from public.ticket_instances
  where id in (application.assigned_ticket_instance_id, next_instance_id)
  order by id for update;
  if next_instance_id is not null then
    select * into target from public.ticket_instances where id = next_instance_id;
    if not found or target.event_date is distinct from application.meeting_date then
      raise exception using errcode = '22023', message = '신청 날짜와 같은 날짜의 티켓만 배정할 수 있습니다.';
    end if;
    select id into group_id from public.meeting_groups
    where legacy_ticket_instance_id = next_instance_id;
  end if;
  participation_id := application.ticket_participation_id;
  moving := participation_id is not null
    and next_instance_id is distinct from application.assigned_ticket_instance_id;
  if moving then
    perform public.set_ticket_participation_status(
      application.assigned_ticket_instance_id, application.user_id, 'cancelled');
    -- Preserve the current state unless the operator explicitly changes it.
    participation_id := public.set_ticket_participation_status(
      next_instance_id, application.user_id, next_status);
  elsif p_patch ? 'status' and next_instance_id is not null
    and (next_status = 'approved' or participation_id is not null) then
    participation_id := public.set_ticket_participation_status(
      next_instance_id, application.user_id, next_status);
  end if;
  if participation_id is not null and (moving or p_patch ? 'status') then
    update public.ticket_participations set cancelled_at =
      case when next_status = 'cancelled' then coalesce(cancelled_at, now()) else null end
    where id = participation_id;
  end if;
  update public.meeting_date_applications set
    status = next_status,
    assigned_ticket_instance_id = next_instance_id,
    assigned_group_id = case when p_patch ? 'ticketInstanceId' then group_id else assigned_group_id end,
    assigned_at = case when p_patch ? 'ticketInstanceId'
      then case when next_instance_id is not null then now() else null end else assigned_at end,
    ticket_participation_id = participation_id,
    confirmed_at = case when next_status = 'approved' then coalesce(confirmed_at, now()) else confirmed_at end,
    cancelled_at = case when next_status = 'cancelled' then coalesce(cancelled_at, now()) else null end,
    admin_note = case when p_patch ? 'adminNote' then p_patch->>'adminNote' else admin_note end,
    updated_at = now()
  where id = p_application_id;
  return participation_id;
end;
$$;
revoke all on function public.admin_update_meeting_application(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_meeting_application(bigint,jsonb) to service_role;

-- Legacy participation IDs remain accepted. Linked rows use the application
-- command so older admin screens cannot silently leave the application stale.
create or replace function public.admin_update_ticket_participation(
  p_participation_id bigint, p_patch jsonb
) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  participation public.ticket_participations%rowtype;
  linked_id bigint;
  target public.ticket_instances%rowtype;
  next_instance_id uuid;
  next_status text;
  result_id bigint;
begin
  select id into linked_id from public.meeting_date_applications
  where ticket_participation_id = p_participation_id;
  if linked_id is not null then
    perform id from public.meeting_date_applications where id = linked_id for update;
    if not exists(select 1 from public.meeting_date_applications
      where id = linked_id and ticket_participation_id = p_participation_id) then
      raise exception using errcode = 'P0001', message = '배정 정보가 변경되었습니다. 새로고침 후 다시 시도해주세요.';
    end if;
    return public.admin_update_meeting_application(linked_id, p_patch);
  end if;
  select * into participation from public.ticket_participations where id = p_participation_id;
  if not found then raise exception using errcode = 'P0002', message = '참가자를 찾을 수 없습니다.'; end if;
  next_instance_id := case when p_patch ? 'ticketInstanceId'
    then (p_patch->>'ticketInstanceId')::uuid else participation.ticket_instance_id end;
  perform id from public.ticket_instances where id in (participation.ticket_instance_id, next_instance_id)
    order by id for update;
  perform id from public.ticket_participations where id = p_participation_id for update;
  if exists(select 1 from public.ticket_participations where id = p_participation_id
    and ticket_instance_id is distinct from participation.ticket_instance_id)
    or exists(select 1 from public.meeting_date_applications where ticket_participation_id = p_participation_id) then
    raise exception using errcode = 'P0001', message = '배정 정보가 변경되었습니다. 새로고침 후 다시 시도해주세요.';
  end if;
  -- Re-read status after locking, so a note-only request cannot undo a status change.
  select * into participation from public.ticket_participations where id = p_participation_id;
  next_status := coalesce(p_patch->>'status', participation.status);
  if next_status not in ('payment_pending','waitlisted','on_hold','approved','not_selected','cancelled','feedback_done','completed') then
    raise exception using errcode = '22023', message = '대기열 상태가 올바르지 않습니다.';
  end if;
  if next_instance_id is not null then
    select * into target from public.ticket_instances where id = next_instance_id;
    if not found or target.event_date is null then
      raise exception using errcode = '22023', message = '세부 티켓을 찾을 수 없습니다.';
    end if;
    if exists(select 1 from public.ticket_participations where user_id = participation.user_id
      and ticket_instance_id = next_instance_id and id <> p_participation_id) then
      raise exception using errcode = 'P0001', message = '대상 티켓에 이미 참가 기록이 있습니다.';
    end if;
  end if;
  update public.ticket_participations set
    ticket_instance_id = next_instance_id,
    ticket_template_id = case when p_patch ? 'ticketInstanceId' then target.template_id else ticket_template_id end,
    ticket_id = case when next_instance_id is not null then next_instance_id::text else ticket_id end,
    meeting_date = case when next_instance_id is not null then target.event_date else meeting_date end,
    ticket_snapshot = case when next_instance_id is distinct from participation.ticket_instance_id then '{}'::jsonb else ticket_snapshot end,
    admin_note = case when p_patch ? 'adminNote' then p_patch->>'adminNote' else admin_note end,
    status = next_status,
    updated_at = now()
  where id = p_participation_id;
  if next_instance_id is not null and (p_patch ? 'status' or p_patch ? 'ticketInstanceId') then
    result_id := public.set_ticket_participation_status(next_instance_id, participation.user_id, next_status);
  end if;
  update public.ticket_participations set cancelled_at =
    case when next_status = 'cancelled' then coalesce(cancelled_at, now()) else null end
  where id = p_participation_id;
  return p_participation_id;
end;
$$;
revoke all on function public.admin_update_ticket_participation(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_ticket_participation(bigint,jsonb) to service_role;

-- Batch distribution/confirmation uses the same writer and rolls back the
-- entire batch (including group confirmation) if any participant fails.
create or replace function public.admin_assign_waitlist_applications(
  p_application_ids bigint[], p_ticket_instance_id uuid, p_confirm boolean,
  p_only_current_group boolean default false
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  application public.meeting_date_applications%rowtype;
  requested_ids bigint[];
  processed integer := 0;
begin
  select array_agg(distinct id) into requested_ids from unnest(p_application_ids) id;
  if coalesce(cardinality(requested_ids), 0) = 0 then
    raise exception using errcode = '22023', message = '신청자를 선택해주세요.';
  end if;
  if p_confirm and p_ticket_instance_id is null then
    raise exception using errcode = '22023', message = '세부 티켓을 선택해주세요.';
  end if;
  perform id from public.meeting_date_applications where id = any(requested_ids) order by id for update;
  perform id from public.ticket_instances where id = p_ticket_instance_id or id in (
    select assigned_ticket_instance_id from public.meeting_date_applications where id = any(requested_ids)
  ) order by id for update;
  for application in select * from public.meeting_date_applications
    where id = any(requested_ids) order by id for update
  loop
    if p_only_current_group and application.assigned_ticket_instance_id is distinct from p_ticket_instance_id then
      raise exception using errcode = 'P0001', message = '그룹 배정이 변경되었습니다. 새로고침 후 다시 시도해주세요.';
    end if;
    if application.status <> 'waitlisted' or application.ticket_participation_id is not null then
      raise exception using errcode = 'P0001', message = '대기 중이며 참여 확정 전인 신청자만 배정할 수 있습니다.';
    end if;
    perform public.admin_update_meeting_application(application.id,
      jsonb_build_object('ticketInstanceId', p_ticket_instance_id)
      || case when p_confirm then '{"status":"approved"}'::jsonb else '{}'::jsonb end);
    processed := processed + 1;
  end loop;
  if processed <> cardinality(requested_ids) then
    raise exception using errcode = 'P0002', message = '일부 신청자를 찾을 수 없습니다.';
  end if;
  if p_confirm then
    update public.meeting_groups set status = 'confirmed', updated_at = now()
    where legacy_ticket_instance_id = p_ticket_instance_id;
  end if;
  return processed;
end;
$$;
revoke all on function public.admin_assign_waitlist_applications(bigint[],uuid,boolean,boolean) from public, anon, authenticated;
grant execute on function public.admin_assign_waitlist_applications(bigint[],uuid,boolean,boolean) to service_role;
