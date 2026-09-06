-- Group names are display text, not operational rules. Materialize the old
-- rules once; subsequent renames must not change eligibility or arrival time.
alter table public.meeting_groups
  add column feedback_scope_key text,
  add column starts_from_stage_sequence integer not null default 1
    check (starts_from_stage_sequence > 0);
with numbered as (
  select id, (regexp_match(title || ' ' || code, '(?:^|\D)(\d+)\s*(?:그룹|$)'))[1]::integer as n
  from public.meeting_groups
)
update public.meeting_groups g set
  feedback_scope_key = case when n is null then null when n <= 3 or n = 7 then '123' else '456' end,
  starts_from_stage_sequence = case when n = 7 then 2 else 1 end
from numbered where g.id = numbered.id;

-- Compatibility projection. Event, stage and group records are authoritative;
-- legacy instances are derived in the same transaction as an operational edit.
create or replace function public.refresh_meeting_group_projection(p_group_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  g public.meeting_groups%rowtype;
  e public.meeting_events%rowtype;
  s public.meeting_event_stages%rowtype;
  l public.meeting_group_stage_locations%rowtype;
begin
  select * into g from public.meeting_groups where id = p_group_id;
  if not found or g.legacy_ticket_instance_id is null then return; end if;
  select * into e from public.meeting_events where id = g.event_id;
  select * into s from public.meeting_event_stages where event_id = g.event_id and sequence = 1;
  if s.location_mode = 'group_specific' then
    select * into l from public.meeting_group_stage_locations where group_id = g.id and stage_id = s.id;
  end if;
  update public.ticket_instances set
    title = e.title, event_date = e.event_date, event_time = e.starts_at, region = e.region,
    operation_code = g.code, operation_note = g.title,
    place_name = case when s.id is null then place_name when s.location_mode = 'shared' then s.place_name when s.location_mode = 'group_specific' then l.place_name else null end,
    address = case when s.id is null then address when s.location_mode = 'shared' then s.address when s.location_mode = 'group_specific' then l.address else null end,
    place_payload = case when s.id is null then place_payload when s.location_mode = 'shared' then s.place_payload when s.location_mode = 'group_specific' then l.place_payload else null end,
    updated_at = now()
  where id = g.legacy_ticket_instance_id;
  update public.ticket_participations set meeting_date = e.event_date, updated_at = now()
  where ticket_instance_id = g.legacy_ticket_instance_id and meeting_date is distinct from e.event_date;
end;
$$;
revoke all on function public.refresh_meeting_group_projection(uuid) from public, anon, authenticated;
grant execute on function public.refresh_meeting_group_projection(uuid) to service_role;

create or replace function public.sync_meeting_operations_projection()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  target_event uuid;
  group_record record;
begin
  if tg_table_name = 'meeting_events' then
    target_event := new.id;
    perform id from public.meeting_date_applications where event_id = new.id order by id for update;
    -- Preserve custom stage intervals instead of resetting every event to 90 minutes.
    if new.starts_at is distinct from old.starts_at then
      update public.meeting_event_stages set starts_at = starts_at + (new.starts_at - old.starts_at), updated_at = now()
      where event_id = new.id and starts_at is not null;
    end if;
    update public.meeting_date_applications set meeting_date = new.event_date, meeting_time = new.starts_at, updated_at = now()
    where event_id = new.id and (meeting_date is distinct from new.event_date or meeting_time is distinct from new.starts_at);
  elsif tg_table_name = 'meeting_event_stages' then
    target_event := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
    if tg_op <> 'DELETE' then
      update public.meeting_events e set detail_snapshot = jsonb_set(e.detail_snapshot,
        array['courseSteps',(new.sequence - 1)::text],
        (e.detail_snapshot #> array['courseSteps',(new.sequence - 1)::text])
          || jsonb_build_object('title',new.title)
          || case when new.starts_at is not null then jsonb_build_object('openOffsetMinutes',
            mod(extract(epoch from (new.starts_at - e.starts_at))::integer / 60 + 1440,1440)) else '{}'::jsonb end),
        updated_at = now()
      where e.id = new.event_id and jsonb_typeof(e.detail_snapshot->'courseSteps') = 'array'
        and jsonb_typeof(e.detail_snapshot #> array['courseSteps',(new.sequence - 1)::text]) = 'object';
    end if;
  elsif tg_table_name = 'meeting_groups' then
    perform public.refresh_meeting_group_projection(new.id);
    return new;
  else
    perform public.refresh_meeting_group_projection(case when tg_op = 'DELETE' then old.group_id else new.group_id end);
    return null;
  end if;
  for group_record in select id from public.meeting_groups where event_id = target_event order by id loop
    perform public.refresh_meeting_group_projection(group_record.id);
  end loop;
  return null;
end;
$$;
revoke all on function public.sync_meeting_operations_projection() from public, anon, authenticated;
grant execute on function public.sync_meeting_operations_projection() to service_role;
create trigger project_meeting_event after update of title,event_date,starts_at,region on public.meeting_events
for each row execute function public.sync_meeting_operations_projection();
create trigger project_meeting_stage after insert or update or delete on public.meeting_event_stages
for each row execute function public.sync_meeting_operations_projection();
create trigger project_meeting_group after insert or update of code,title,legacy_ticket_instance_id on public.meeting_groups
for each row execute function public.sync_meeting_operations_projection();
create trigger project_meeting_location after insert or update or delete on public.meeting_group_stage_locations
for each row execute function public.sync_meeting_operations_projection();

create or replace function public.validate_meeting_location()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'meeting_event_stages' then
    if tg_op = 'UPDATE' and new.event_id is distinct from old.event_id then
      raise exception using errcode = '22023', message = '일정을 다른 행사로 옮길 수 없습니다.';
    end if;
  end if;
  if tg_table_name = 'meeting_group_stage_locations' then
    if not exists(select 1 from public.meeting_groups g join public.meeting_event_stages s on s.event_id = g.event_id
      where g.id = new.group_id and s.id = new.stage_id) then
      raise exception using errcode = '22023', message = '같은 행사의 그룹과 일정만 연결할 수 있습니다.';
    end if;
  end if;
  if tg_op = 'UPDATE' and (new.place_name is distinct from old.place_name or new.address is distinct from old.address)
    and new.place_payload is not distinct from old.place_payload then
    new.place_payload := null;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_meeting_location() from public, anon, authenticated;
grant execute on function public.validate_meeting_location() to service_role;
create trigger validate_meeting_stage_location before insert or update on public.meeting_event_stages
for each row execute function public.validate_meeting_location();
create trigger validate_meeting_group_location before insert or update on public.meeting_group_stage_locations
for each row execute function public.validate_meeting_location();

-- A user cancellation revalidates ownership and state under lock; approval
-- racing with the request must never be overwritten by the stale API read.
create or replace function public.cancel_own_meeting_application(p_application_id bigint, p_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.meeting_date_applications%rowtype;
begin
  select * into a from public.meeting_date_applications where id = p_application_id and user_id = p_user_id for update;
  if not found then raise exception using errcode = 'P0002', message = '취소할 신청을 찾지 못했어요.'; end if;
  if a.status not in ('waitlisted','on_hold') then
    raise exception using errcode = 'P0001', message = '현재 상태에서는 신청을 취소할 수 없어요.';
  end if;
  perform public.admin_update_meeting_application(a.id, '{"status":"cancelled"}');
  update public.ticket_user_interactions set status = 'open', updated_at = now()
  where user_id = p_user_id and (case when a.event_id is not null then event_id = a.event_id
    else ticket_instance_id = a.assigned_ticket_instance_id end);
  select * into a from public.meeting_date_applications where id = a.id;
  return to_jsonb(a);
end;
$$;
revoke all on function public.cancel_own_meeting_application(bigint,uuid) from public, anon, authenticated;
grant execute on function public.cancel_own_meeting_application(bigint,uuid) to service_role;

create or replace function public.admin_set_instance_member_status(p_instance_id uuid,p_user_id uuid,p_status text)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare a_id bigint; participation_id bigint;
begin
  select id into a_id from public.meeting_date_applications
  where user_id = p_user_id and assigned_ticket_instance_id = p_instance_id;
  if a_id is not null then
    perform id from public.meeting_date_applications where id = a_id for update;
    if not exists(select 1 from public.meeting_date_applications where id = a_id and assigned_ticket_instance_id = p_instance_id) then
      raise exception using errcode = 'P0001', message = '배정이 변경되었습니다. 새로고침 후 다시 시도해주세요.';
    end if;
    return public.admin_update_meeting_application(a_id,jsonb_build_object('status',p_status));
  end if;
  select id into participation_id from public.ticket_participations where user_id = p_user_id and ticket_instance_id = p_instance_id;
  if participation_id is not null then
    return public.admin_update_ticket_participation(participation_id,jsonb_build_object('status',p_status));
  end if;
  return public.set_ticket_participation_status(p_instance_id,p_user_id,p_status);
end;
$$;
revoke all on function public.admin_set_instance_member_status(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.admin_set_instance_member_status(uuid,uuid,text) to service_role;

create or replace function public.prepare_checkout_participation(
  p_application_id bigint,p_instance_id uuid,p_user_id uuid,p_snapshot jsonb,p_invitation_id uuid
) returns bigint language plpgsql security invoker set search_path = '' as $$
declare a public.meeting_date_applications%rowtype; p public.ticket_participations%rowtype;
begin
  if p_application_id is null then
    select * into a from public.meeting_date_applications where user_id = p_user_id and assigned_ticket_instance_id = p_instance_id for update;
  else
    select * into a from public.meeting_date_applications where id = p_application_id and user_id = p_user_id for update;
    if not found then raise exception 'Application not found'; end if;
  end if;
  if a.id is not null then
    if a.status <> 'payment_pending' then return a.ticket_participation_id; end if;
    if a.assigned_ticket_instance_id is distinct from p_instance_id then raise exception 'Application ticket mismatch'; end if;
  end if;
  perform id from public.ticket_instances where id = p_instance_id for update;
  select * into p from public.ticket_participations where user_id = p_user_id and ticket_instance_id = p_instance_id for update;
  if found and p.status not in ('payment_pending','cancelled','not_selected') then return p.id; end if;
  return public.set_ticket_participation_status(p_instance_id,p_user_id,'payment_pending',p_snapshot,p_invitation_id);
end;
$$;
revoke all on function public.prepare_checkout_participation(bigint,uuid,uuid,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.prepare_checkout_participation(bigint,uuid,uuid,jsonb,uuid) to service_role;

-- Payment advances only a pending application. Confirmed/finished/cancelled
-- participation states cannot be downgraded by delayed payment delivery.
create or replace function public.advance_paid_meeting_applications(
  p_user_id uuid,p_group_id uuid,p_application_id bigint,p_merchant_uid text,p_event_id text,p_paid_at timestamptz,p_confirm_deposit boolean
) returns void language plpgsql security invoker set search_path = '' as $$
declare a public.meeting_date_applications%rowtype; protected_status text;
begin
  for a in select * from public.meeting_date_applications where user_id = p_user_id
    and ((p_application_id is not null and id = p_application_id) or (p_application_id is null and application_group_id = p_group_id))
    order by id for update
  loop
    if a.status not in ('payment_pending','waitlisted','on_hold','approved') then continue; end if;
    if a.status = 'payment_pending' then
      select status into protected_status from public.ticket_participations
      where id = a.ticket_participation_id and status in ('approved','feedback_done','completed');
      perform public.admin_update_meeting_application(a.id,jsonb_build_object('status',coalesce(protected_status,'waitlisted')));
    end if;
    update public.ticket_participations set status = 'waitlisted', updated_at = now()
    where user_id = p_user_id and ticket_instance_id = a.assigned_ticket_instance_id and status = 'payment_pending';
    update public.meeting_date_applications set
      groble_merchant_uid = p_merchant_uid, groble_payment_event_id = p_event_id,
      deposit_status = case when p_confirm_deposit then 'confirmed' else deposit_status end,
      deposit_confirmed_at = case when p_confirm_deposit then p_paid_at else deposit_confirmed_at end, updated_at = now()
    where id = a.id;
  end loop;
end;
$$;
revoke all on function public.advance_paid_meeting_applications(uuid,uuid,bigint,text,text,timestamptz,boolean) from public, anon, authenticated;
grant execute on function public.advance_paid_meeting_applications(uuid,uuid,bigint,text,text,timestamptz,boolean) to service_role;

create or replace function public.cancel_one_time_payment(p_transaction_id bigint,p_cancelled_at timestamptz)
returns void language plpgsql security invoker set search_path = '' as $$
declare t public.payment_transactions%rowtype; a public.meeting_date_applications%rowtype;
begin
  select * into t from public.payment_transactions where id = p_transaction_id and payment_kind = 'one_time' for update;
  if not found then raise exception 'One-time transaction not found'; end if;
  for a in select * from public.meeting_date_applications where user_id = t.user_id and application_group_id = t.application_group_id order by id for update loop
    perform public.admin_update_meeting_application(a.id,'{"status":"cancelled"}');
    update public.meeting_date_applications set deposit_status = 'refunded',cancelled_at = p_cancelled_at,
      refund_completed_at = p_cancelled_at,updated_at = now() where id = a.id;
    update public.ticket_participations set cancelled_at = p_cancelled_at where id = a.ticket_participation_id;
  end loop;
  update public.payment_transactions set status = 'cancelled',cancelled_at = p_cancelled_at,updated_at = now() where id = t.id;
end;
$$;
revoke all on function public.cancel_one_time_payment(bigint,timestamptz) from public, anon, authenticated;
grant execute on function public.cancel_one_time_payment(bigint,timestamptz) to service_role;

create or replace function public.save_operational_group(p_group_id uuid,p_patch jsonb,p_stage_id uuid,p_location jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform id from public.meeting_groups where id = p_group_id for update;
  if not found then raise exception 'Group not found'; end if;
  update public.meeting_groups set
    code = coalesce(p_patch->>'code',code), title = coalesce(p_patch->>'title',title),
    operation_note = case when p_patch ? 'operationNote' then p_patch->>'operationNote' else operation_note end,
    feedback_scope_key = case when p_patch ? 'feedbackScopeKey' then nullif(btrim(p_patch->>'feedbackScopeKey'),'') else feedback_scope_key end,
    starts_from_stage_sequence = coalesce((p_patch->>'startsFromStageSequence')::integer,starts_from_stage_sequence),updated_at = now()
  where id = p_group_id;
  if p_stage_id is not null and p_location is not null then
    insert into public.meeting_group_stage_locations(group_id,stage_id,place_name,address,updated_at)
    values(p_group_id,p_stage_id,nullif(btrim(p_location->>'placeName'),''),nullif(btrim(p_location->>'address'),''),now())
    on conflict(group_id,stage_id) do update set place_name = excluded.place_name,address = excluded.address,updated_at = excluded.updated_at;
  end if;
end;
$$;
revoke all on function public.save_operational_group(uuid,jsonb,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_operational_group(uuid,jsonb,uuid,jsonb) to service_role;

-- Backfill only projections of existing operational groups, not standalone tickets.
do $$ declare g record; begin
  for g in select id from public.meeting_groups order by id loop
    perform public.refresh_meeting_group_projection(g.id);
  end loop;
end $$;
