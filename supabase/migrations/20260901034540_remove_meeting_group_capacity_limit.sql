-- Meeting groups are operational buckets, not capacity-limited sale units.
-- Keep the legacy columns for compatibility while making their effective
-- capacity unbounded.
alter table public.ticket_instances
  drop constraint if exists ticket_instances_max_participant_count_check;

update public.ticket_instances instance
set
  max_participant_count = 2147483647,
  updated_at = now()
where exists (
  select 1
  from public.meeting_groups meeting_group
  where meeting_group.legacy_ticket_instance_id = instance.id
);

create or replace function public.reassign_confirmed_meeting_date_application(
  p_application_id bigint,
  p_ticket_instance_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  application_record public.meeting_date_applications%rowtype;
  target_instance public.ticket_instances%rowtype;
  target_group_id uuid;
  participation_id bigint;
begin
  select *
  into application_record
  from public.meeting_date_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Date application was not found.';
  end if;

  select *
  into target_instance
  from public.ticket_instances
  where id = p_ticket_instance_id
  for update;

  if not found or target_instance.event_date is null then
    raise exception 'Ticket occurrence is not available.';
  end if;

  if application_record.meeting_date <> target_instance.event_date then
    raise exception 'Application date does not match ticket occurrence date.';
  end if;

  if application_record.assigned_ticket_instance_id is not null
     and application_record.assigned_ticket_instance_id <> p_ticket_instance_id then
    perform public.set_ticket_participation_status(
      application_record.assigned_ticket_instance_id,
      application_record.user_id,
      'cancelled'
    );
  end if;

  participation_id := public.set_ticket_participation_status(
    p_ticket_instance_id,
    application_record.user_id,
    'approved'
  );

  select id
  into target_group_id
  from public.meeting_groups
  where legacy_ticket_instance_id = p_ticket_instance_id
  limit 1;

  update public.meeting_date_applications
  set
    status = 'approved',
    assigned_ticket_instance_id = p_ticket_instance_id,
    assigned_group_id = target_group_id,
    ticket_participation_id = participation_id,
    assigned_at = now(),
    confirmed_at = now(),
    cancelled_at = null,
    updated_at = now()
  where id = p_application_id;

  return participation_id;
end;
$$;

revoke all on function public.reassign_confirmed_meeting_date_application(
  bigint,
  uuid
) from public, anon, authenticated;

grant execute on function public.reassign_confirmed_meeting_date_application(
  bigint,
  uuid
) to service_role;
