create or replace function public.assign_meeting_date_applications_to_ticket(
  p_application_ids bigint[],
  p_ticket_instance_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_instance public.ticket_instances%rowtype;
  application_record public.meeting_date_applications%rowtype;
  participation_id bigint;
  assigned_count integer := 0;
  requested_count integer;
begin
  requested_count := coalesce(array_length(p_application_ids, 1), 0);
  if requested_count = 0 then
    raise exception 'At least one date application is required.';
  end if;

  select *
  into target_instance
  from public.ticket_instances
  where id = p_ticket_instance_id
  for update;

  if not found or target_instance.event_date is null then
    raise exception 'Ticket occurrence is not available.';
  end if;

  for application_record in
    select *
    from public.meeting_date_applications
    where id = any(p_application_ids)
    order by id
    for update
  loop
    if application_record.meeting_date <> target_instance.event_date then
      raise exception 'Application date does not match ticket occurrence date.';
    end if;

    if application_record.status <> 'waitlisted' then
      raise exception 'Only paid waitlisted applications can be assigned.';
    end if;

    if application_record.ticket_participation_id is not null then
      raise exception 'Application has already been confirmed.';
    end if;

    participation_id := public.set_ticket_participation_status(
      p_ticket_instance_id,
      application_record.user_id,
      'approved'
    );

    update public.meeting_date_applications
    set
      status = 'approved',
      assigned_ticket_instance_id = p_ticket_instance_id,
      ticket_participation_id = participation_id,
      assigned_at = now(),
      confirmed_at = now(),
      updated_at = now()
    where id = application_record.id;

    assigned_count := assigned_count + 1;
  end loop;

  if assigned_count <> requested_count then
    raise exception 'One or more date applications could not be found.';
  end if;

  return assigned_count;
end;
$$;

revoke all on function public.assign_meeting_date_applications_to_ticket(
  bigint[],
  uuid
) from public, anon, authenticated;

grant execute on function public.assign_meeting_date_applications_to_ticket(
  bigint[],
  uuid
) to service_role;
