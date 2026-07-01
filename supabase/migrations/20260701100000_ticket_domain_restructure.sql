-- Separate reusable invitation content from scheduled occurrences, introduce
-- persisted invitations, and make participation the single source of truth.

alter table public.ticket_templates
  add column if not exists template_kind text not null default 'experience',
  add column if not exists lifecycle_status text not null default 'active';

update public.ticket_templates
set template_kind = case
  when visibility = 'question' then 'question_sample'
  else 'experience'
end;

update public.ticket_templates
set lifecycle_status = case
  when visibility = 'archived' then 'archived'
  else 'active'
end;

alter table public.ticket_templates
  drop constraint if exists ticket_templates_template_kind_check,
  add constraint ticket_templates_template_kind_check
    check (template_kind in ('experience', 'question_sample')),
  drop constraint if exists ticket_templates_lifecycle_status_check,
  add constraint ticket_templates_lifecycle_status_check
    check (lifecycle_status in ('active', 'archived'));

alter table public.ticket_instances
  add column if not exists minimum_participant_count integer not null default 3,
  add column if not exists max_participant_count integer not null default 6;

update public.ticket_instances instance
set
  minimum_participant_count = coalesce(template.minimum_participant_count, 3),
  max_participant_count = coalesce(template.max_participant_count, 6)
from public.ticket_templates template
where template.id = instance.template_id;

alter table public.ticket_instances
  drop constraint if exists ticket_instances_minimum_participant_count_check,
  add constraint ticket_instances_minimum_participant_count_check
    check (minimum_participant_count between 2 and 100),
  drop constraint if exists ticket_instances_max_participant_count_check,
  add constraint ticket_instances_max_participant_count_check
    check (max_participant_count between 2 and 100),
  drop constraint if exists ticket_instances_participant_count_order_check,
  add constraint ticket_instances_participant_count_order_check
    check (minimum_participant_count <= max_participant_count);

alter table public.ticket_templates
  drop constraint if exists ticket_templates_visibility_check;

alter table public.ticket_templates
  add constraint ticket_templates_visibility_check
  check (
    visibility in (
      'draft',
      'test_only',
      'public',
      'invite_only',
      'question',
      'closed',
      'archived'
    )
  );

alter table public.ticket_instances
  drop constraint if exists ticket_instances_visibility_check;

update public.ticket_instances
set visibility = 'draft'
where visibility = 'question';

alter table public.ticket_instances
  add constraint ticket_instances_visibility_check
  check (
    visibility in (
      'draft',
      'test_only',
      'public',
      'invite_only',
      'closed',
      'archived'
    )
  );

create table if not exists public.ticket_invitations (
  id uuid primary key default gen_random_uuid(),
  ticket_instance_id uuid not null
    references public.ticket_instances(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  source_type text not null default 'service'
    check (source_type in ('service', 'admin', 'friend')),
  inviter_id uuid references public.profiles(user_id) on delete set null,
  status text not null default 'sent'
    check (
      status in (
        'sent',
        'viewed',
        'accepted',
        'declined',
        'expired',
        'cancelled'
      )
    ),
  expires_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticket_instance_id, user_id),
  check (
    (source_type = 'friend' and inviter_id is not null)
    or source_type <> 'friend'
  )
);

create index if not exists ticket_invitations_user_status_idx
on public.ticket_invitations(user_id, status, created_at desc);

create index if not exists ticket_invitations_instance_status_idx
on public.ticket_invitations(ticket_instance_id, status, created_at desc);

alter table public.ticket_invitations enable row level security;

drop policy if exists "Users can read own ticket invitations"
on public.ticket_invitations;

create policy "Users can read own ticket invitations"
on public.ticket_invitations
for select
to authenticated
using (auth.uid() = user_id);

grant select on table public.ticket_invitations to authenticated;
grant select, insert, update, delete on table public.ticket_invitations to service_role;

alter table public.meeting_waitlist
  add column if not exists invitation_id uuid
    references public.ticket_invitations(id) on delete set null,
  add column if not exists applied_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz;

-- Draft occurrences created before this migration can have no date. Keep any
-- existing assignment when it is folded into participation instead of losing it.
alter table public.meeting_waitlist
  alter column meeting_date drop not null;

update public.meeting_waitlist
set applied_at = coalesce(applied_at, created_at);

update public.meeting_waitlist participation
set
  status = case
    when participation.status in ('completed', 'feedback_done')
      then participation.status
    else 'approved'
  end,
  confirmed_at = coalesce(
    participation.confirmed_at,
    assignment.assigned_at,
    participation.updated_at
  ),
  updated_at = greatest(participation.updated_at, assignment.assigned_at)
from public.ticket_assignments assignment
where assignment.profile_id = participation.user_id
  and assignment.ticket_instance_id = participation.ticket_instance_id;

insert into public.meeting_waitlist (
  user_id,
  ticket_id,
  ticket_template_id,
  ticket_instance_id,
  meeting_date,
  status,
  ticket_snapshot,
  applied_at,
  confirmed_at,
  created_at,
  updated_at
)
select
  assignment.profile_id,
  assignment.ticket_instance_id::text,
  instance.template_id,
  assignment.ticket_instance_id,
  instance.event_date,
  'approved',
  '{}'::jsonb,
  assignment.assigned_at,
  assignment.assigned_at,
  assignment.assigned_at,
  assignment.assigned_at
from public.ticket_assignments assignment
join public.ticket_instances instance
  on instance.id = assignment.ticket_instance_id
where not exists (
    select 1
    from public.meeting_waitlist participation
    where participation.user_id = assignment.profile_id
      and participation.ticket_instance_id = assignment.ticket_instance_id
  );

drop trigger if exists sync_ticket_assignment_waitlist_insert_trigger
on public.ticket_assignments;

drop trigger if exists sync_ticket_assignment_waitlist_delete_trigger
on public.ticket_assignments;

drop function if exists public.sync_ticket_assignment_waitlist();

alter table public.meeting_waitlist
rename to ticket_participations;

alter table public.ticket_participations
  drop constraint if exists meeting_waitlist_status_check,
  drop constraint if exists ticket_participations_status_check;

alter table public.ticket_participations
  add constraint ticket_participations_status_check
  check (
    status in (
      'payment_pending',
      'waitlisted',
      'on_hold',
      'approved',
      'not_selected',
      'cancelled',
      'feedback_done',
      'completed'
    )
  );

create index if not exists ticket_participations_instance_status_idx
on public.ticket_participations(ticket_instance_id, status, created_at desc);

create index if not exists ticket_participations_user_status_idx
on public.ticket_participations(user_id, status, created_at desc);

drop policy if exists "Users can read own meeting waitlist"
on public.ticket_participations;

drop policy if exists "Users can join own meeting waitlist"
on public.ticket_participations;

drop policy if exists "Users can read own ticket participations"
on public.ticket_participations;

create policy "Users can read own ticket participations"
on public.ticket_participations
for select
to authenticated
using (auth.uid() = user_id);

grant select on table public.ticket_participations to authenticated;
grant select, insert, update, delete on table public.ticket_participations to service_role;

create or replace function public.set_ticket_participation_status(
  p_ticket_instance_id uuid,
  p_user_id uuid,
  p_status text,
  p_ticket_snapshot jsonb default null,
  p_invitation_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  instance_record public.ticket_instances%rowtype;
  participation_id bigint;
  confirmed_count integer;
begin
  if p_status not in (
    'payment_pending',
    'waitlisted',
    'on_hold',
    'approved',
    'not_selected',
    'cancelled',
    'feedback_done',
    'completed'
  ) then
    raise exception 'Unsupported participation status: %', p_status;
  end if;

  select *
  into instance_record
  from public.ticket_instances
  where id = p_ticket_instance_id
  for update;

  if not found or instance_record.event_date is null then
    raise exception 'Ticket occurrence is not available.';
  end if;

  if p_status = 'approved' then
    select count(*)
    into confirmed_count
    from public.ticket_participations participation
    where participation.ticket_instance_id = p_ticket_instance_id
      and participation.user_id <> p_user_id
      and participation.status in ('approved', 'feedback_done', 'completed');

    if confirmed_count >= instance_record.max_participant_count then
      raise exception 'Ticket occurrence capacity has been reached.';
    end if;
  end if;

  select id
  into participation_id
  from public.ticket_participations
  where user_id = p_user_id
    and ticket_instance_id = p_ticket_instance_id
  for update;

  if participation_id is null then
    insert into public.ticket_participations (
      user_id,
      ticket_id,
      ticket_template_id,
      ticket_instance_id,
      meeting_date,
      status,
      ticket_snapshot,
      invitation_id,
      applied_at,
      confirmed_at,
      cancelled_at,
      updated_at
    ) values (
      p_user_id,
      p_ticket_instance_id::text,
      instance_record.template_id,
      p_ticket_instance_id,
      instance_record.event_date,
      p_status,
      coalesce(p_ticket_snapshot, '{}'::jsonb),
      p_invitation_id,
      case
        when p_status in ('payment_pending', 'waitlisted', 'on_hold', 'approved')
          then now()
        else null
      end,
      case when p_status = 'approved' then now() else null end,
      case when p_status = 'cancelled' then now() else null end,
      now()
    )
    returning id into participation_id;
  else
    update public.ticket_participations
    set
      ticket_id = p_ticket_instance_id::text,
      ticket_template_id = instance_record.template_id,
      meeting_date = instance_record.event_date,
      status = p_status,
      ticket_snapshot = coalesce(
        p_ticket_snapshot,
        ticket_participations.ticket_snapshot
      ),
      invitation_id = coalesce(
        p_invitation_id,
        ticket_participations.invitation_id
      ),
      applied_at = case
        when p_status in ('payment_pending', 'waitlisted', 'on_hold', 'approved')
          then coalesce(ticket_participations.applied_at, now())
        else ticket_participations.applied_at
      end,
      confirmed_at = case
        when p_status = 'approved'
          then coalesce(ticket_participations.confirmed_at, now())
        else ticket_participations.confirmed_at
      end,
      cancelled_at = case
        when p_status = 'cancelled' then now()
        else ticket_participations.cancelled_at
      end,
      updated_at = now()
    where id = participation_id;
  end if;

  return participation_id;
end;
$$;

revoke all on function public.set_ticket_participation_status(
  uuid,
  uuid,
  text,
  jsonb,
  uuid
) from public, anon, authenticated;

grant execute on function public.set_ticket_participation_status(
  uuid,
  uuid,
  text,
  jsonb,
  uuid
) to service_role;

create or replace function public.meeting_chat_is_member(
  p_ticket_instance_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.ticket_participations participation
    where participation.ticket_instance_id = p_ticket_instance_id
      and participation.user_id = p_user_id
      and participation.status in ('approved', 'completed', 'feedback_done')
  );
$$;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ticket_assignments'
  ) then
    alter publication supabase_realtime
      drop table public.ticket_assignments;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ticket_participations'
  ) then
    alter publication supabase_realtime
      add table public.ticket_participations;
  end if;
end
$$;

drop table if exists public.ticket_assignments;

alter table public.ticket_participations replica identity full;
