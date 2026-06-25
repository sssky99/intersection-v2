create table if not exists public.meeting_chat_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_instance_id uuid not null
    references public.ticket_instances(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint meeting_chat_messages_body_length_check
    check (char_length(btrim(body)) between 1 and 100)
);

create index if not exists meeting_chat_messages_instance_created_idx
on public.meeting_chat_messages(ticket_instance_id, created_at);

create table if not exists public.meeting_chat_reads (
  ticket_instance_id uuid not null
    references public.ticket_instances(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (ticket_instance_id, user_id)
);

create index if not exists meeting_chat_reads_user_id_idx
on public.meeting_chat_reads(user_id);

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
  select
    exists (
      select 1
      from public.ticket_assignments assignment
      where assignment.ticket_instance_id = p_ticket_instance_id
        and assignment.profile_id = p_user_id
    )
    and exists (
      select 1
      from public.meeting_waitlist waitlist
      where waitlist.user_id = p_user_id
        and (
          waitlist.ticket_instance_id = p_ticket_instance_id
          or waitlist.ticket_id = p_ticket_instance_id::text
        )
        and waitlist.status in ('approved', 'completed', 'feedback_done')
    );
$$;

create or replace function public.meeting_chat_is_open(
  p_ticket_instance_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.ticket_instances instance
    where instance.id = p_ticket_instance_id
      and instance.event_date is not null
      and instance.event_time is not null
      and now() >= (
        (
          instance.event_date + instance.event_time
        ) at time zone 'Asia/Seoul'
      ) - interval '3 hours'
      and now() < (
        (
          instance.event_date + instance.event_time
        ) at time zone 'Asia/Seoul'
      ) + interval '27 hours'
  );
$$;

create or replace function public.meeting_chat_can_access(
  p_ticket_instance_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and public.meeting_chat_is_member(p_ticket_instance_id, auth.uid())
    and public.meeting_chat_is_open(p_ticket_instance_id);
$$;

create or replace function public.protect_meeting_chat_message()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.ticket_instance_id is distinct from old.ticket_instance_id
    or new.sender_id is distinct from old.sender_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Meeting chat messages cannot be edited.';
  end if;

  if old.deleted_at is not null then
    if new.deleted_at is distinct from old.deleted_at
      or new.body is distinct from old.body
    then
      raise exception 'Deleted meeting chat messages cannot be restored.';
    end if;
    return new;
  end if;

  if new.deleted_at is not null then
    if new.body is distinct from old.body then
      raise exception 'Meeting chat messages cannot be edited.';
    end if;
    new.deleted_at = now();
    new.body = '삭제된 메시지입니다.';
  elsif new.body is distinct from old.body then
    raise exception 'Meeting chat messages cannot be edited.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_meeting_chat_message_trigger
on public.meeting_chat_messages;

create trigger protect_meeting_chat_message_trigger
before update on public.meeting_chat_messages
for each row execute function public.protect_meeting_chat_message();

create or replace function public.mark_meeting_chat_read(
  p_ticket_instance_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  read_at timestamptz := now();
begin
  if current_user_id is null
    or not public.meeting_chat_can_access(p_ticket_instance_id)
  then
    raise exception 'Meeting chat access denied.';
  end if;

  insert into public.meeting_chat_reads (
    ticket_instance_id,
    user_id,
    last_read_at
  )
  values (
    p_ticket_instance_id,
    current_user_id,
    read_at
  )
  on conflict (ticket_instance_id, user_id)
  do update set last_read_at = greatest(
    public.meeting_chat_reads.last_read_at,
    excluded.last_read_at
  );

  return read_at;
end;
$$;

alter table public.meeting_chat_messages enable row level security;
alter table public.meeting_chat_reads enable row level security;

drop policy if exists "Meeting members can read open chat messages"
on public.meeting_chat_messages;
create policy "Meeting members can read open chat messages"
on public.meeting_chat_messages
for select
to authenticated
using (
  public.meeting_chat_can_access(ticket_instance_id)
);

drop policy if exists "Meeting members can send open chat messages"
on public.meeting_chat_messages;
create policy "Meeting members can send open chat messages"
on public.meeting_chat_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.meeting_chat_can_access(ticket_instance_id)
);

drop policy if exists "Meeting members can delete own open chat messages"
on public.meeting_chat_messages;
create policy "Meeting members can delete own open chat messages"
on public.meeting_chat_messages
for update
to authenticated
using (
  sender_id = auth.uid()
  and public.meeting_chat_can_access(ticket_instance_id)
)
with check (
  sender_id = auth.uid()
  and public.meeting_chat_can_access(ticket_instance_id)
);

drop policy if exists "Meeting members can read open chat receipts"
on public.meeting_chat_reads;
create policy "Meeting members can read open chat receipts"
on public.meeting_chat_reads
for select
to authenticated
using (
  public.meeting_chat_can_access(ticket_instance_id)
);

drop policy if exists "Users can read own ticket assignments"
on public.ticket_assignments;
create policy "Users can read own ticket assignments"
on public.ticket_assignments
for select
to authenticated
using (profile_id = auth.uid());

grant select, insert, update
on table public.meeting_chat_messages
to authenticated;

grant select
on table public.meeting_chat_reads
to authenticated;

grant select
on table public.ticket_assignments
to authenticated;

grant select, insert, update, delete
on table public.meeting_chat_messages
to service_role;

grant select, insert, update, delete
on table public.meeting_chat_reads
to service_role;

revoke all on function public.meeting_chat_is_member(uuid, uuid) from public;
revoke all on function public.meeting_chat_is_open(uuid) from public;
revoke all on function public.meeting_chat_can_access(uuid) from public;
revoke all on function public.mark_meeting_chat_read(uuid) from public;

grant execute on function public.meeting_chat_can_access(uuid)
to authenticated, service_role;
grant execute on function public.mark_meeting_chat_read(uuid)
to authenticated;

alter table public.meeting_chat_messages replica identity full;
alter table public.meeting_chat_reads replica identity full;
alter table public.ticket_assignments replica identity full;
alter table public.meeting_waitlist replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'meeting_chat_messages'
  ) then
    alter publication supabase_realtime
    add table public.meeting_chat_messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'meeting_chat_reads'
  ) then
    alter publication supabase_realtime
    add table public.meeting_chat_reads;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ticket_assignments'
  ) then
    alter publication supabase_realtime
    add table public.ticket_assignments;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'meeting_waitlist'
  ) then
    alter publication supabase_realtime
    add table public.meeting_waitlist;
  end if;
end
$$;
