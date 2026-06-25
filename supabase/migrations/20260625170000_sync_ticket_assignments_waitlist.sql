create or replace function public.sync_ticket_assignment_waitlist()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  instance_record public.ticket_instances%rowtype;
begin
  if tg_op = 'DELETE' then
    update public.meeting_waitlist
    set
      status = 'not_selected',
      updated_at = now()
    where user_id = old.profile_id
      and (
        ticket_instance_id = old.ticket_instance_id
        or ticket_id = old.ticket_instance_id::text
      )
      and status not in ('completed', 'feedback_done');

    return old;
  end if;

  select *
  into instance_record
  from public.ticket_instances
  where id = new.ticket_instance_id;

  if not found or instance_record.event_date is null then
    return new;
  end if;

  update public.meeting_waitlist
  set
    status = case
      when status in ('completed', 'feedback_done') then status
      else 'approved'
    end,
    ticket_id = new.ticket_instance_id::text,
    ticket_instance_id = new.ticket_instance_id,
    ticket_template_id = instance_record.template_id,
    meeting_date = instance_record.event_date,
    updated_at = now()
  where user_id = new.profile_id
    and (
      ticket_instance_id = new.ticket_instance_id
      or ticket_id = new.ticket_instance_id::text
    );

  if not found then
    insert into public.meeting_waitlist (
      user_id,
      ticket_id,
      ticket_instance_id,
      ticket_template_id,
      meeting_date,
      status,
      updated_at
    )
    values (
      new.profile_id,
      new.ticket_instance_id::text,
      new.ticket_instance_id,
      instance_record.template_id,
      instance_record.event_date,
      'approved',
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sync_ticket_assignment_waitlist_insert_trigger
on public.ticket_assignments;

create trigger sync_ticket_assignment_waitlist_insert_trigger
after insert on public.ticket_assignments
for each row execute function public.sync_ticket_assignment_waitlist();

drop trigger if exists sync_ticket_assignment_waitlist_delete_trigger
on public.ticket_assignments;

create trigger sync_ticket_assignment_waitlist_delete_trigger
after delete on public.ticket_assignments
for each row execute function public.sync_ticket_assignment_waitlist();

insert into public.meeting_waitlist (
  user_id,
  ticket_id,
  ticket_instance_id,
  ticket_template_id,
  meeting_date,
  status,
  updated_at
)
select
  assignment.profile_id,
  assignment.ticket_instance_id::text,
  assignment.ticket_instance_id,
  instance.template_id,
  instance.event_date,
  'approved',
  now()
from public.ticket_assignments assignment
join public.ticket_instances instance
  on instance.id = assignment.ticket_instance_id
where instance.event_date is not null
  and not exists (
    select 1
    from public.meeting_waitlist waitlist
    where waitlist.user_id = assignment.profile_id
      and (
        waitlist.ticket_instance_id = assignment.ticket_instance_id
        or waitlist.ticket_id = assignment.ticket_instance_id::text
      )
  );
