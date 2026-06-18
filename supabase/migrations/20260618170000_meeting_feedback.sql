alter table public.profiles
add column if not exists score_temperature integer,
add column if not exists score_texture integer,
add column if not exists score_tone integer,
add column if not exists score_rhythm integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_score_temperature_range'
  ) then
    alter table public.profiles
    add constraint profiles_score_temperature_range
    check (score_temperature is null or score_temperature between -100 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_score_texture_range'
  ) then
    alter table public.profiles
    add constraint profiles_score_texture_range
    check (score_texture is null or score_texture between -100 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_score_tone_range'
  ) then
    alter table public.profiles
    add constraint profiles_score_tone_range
    check (score_tone is null or score_tone between -100 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_score_rhythm_range'
  ) then
    alter table public.profiles
    add constraint profiles_score_rhythm_range
    check (score_rhythm is null or score_rhythm between -100 and 100);
  end if;
end $$;

create table if not exists public.meeting_feedback (
  id uuid primary key default gen_random_uuid(),
  waitlist_id bigint not null references public.meeting_waitlist(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_instance_id uuid references public.ticket_instances(id) on delete set null,
  ticket_template_id uuid references public.ticket_templates(id) on delete set null,
  ticket_snapshot jsonb not null default '{}'::jsonb,
  selected_member_ids uuid[] not null default '{}',
  member_feedback jsonb not null default '{}'::jsonb,
  place_feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (waitlist_id)
);

create index if not exists meeting_feedback_user_id_idx
on public.meeting_feedback(user_id);

create index if not exists meeting_feedback_ticket_instance_id_idx
on public.meeting_feedback(ticket_instance_id);

create index if not exists meeting_feedback_ticket_template_id_idx
on public.meeting_feedback(ticket_template_id);

create index if not exists meeting_feedback_created_at_idx
on public.meeting_feedback(created_at desc);

create table if not exists public.ticket_feedback_averages (
  id uuid primary key default gen_random_uuid(),
  ticket_instance_id uuid references public.ticket_instances(id) on delete cascade,
  ticket_template_id uuid references public.ticket_templates(id) on delete set null,
  avg_temperature numeric(4, 2),
  avg_texture numeric(4, 2),
  avg_tone numeric(4, 2),
  avg_rhythm numeric(4, 2),
  avg_alcohol numeric(4, 2),
  avg_romance numeric(4, 2),
  feedback_count integer not null default 0,
  feedback_average_applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticket_instance_id)
);

create index if not exists ticket_feedback_averages_template_id_idx
on public.ticket_feedback_averages(ticket_template_id);

alter table public.meeting_feedback enable row level security;
alter table public.ticket_feedback_averages enable row level security;

drop policy if exists "Users can select own meeting feedback" on public.meeting_feedback;
create policy "Users can select own meeting feedback"
on public.meeting_feedback
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own meeting feedback" on public.meeting_feedback;
create policy "Users can insert own meeting feedback"
on public.meeting_feedback
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own meeting feedback" on public.meeting_feedback;
create policy "Users can update own meeting feedback"
on public.meeting_feedback
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on table public.meeting_feedback to authenticated;
grant select, insert, update, delete on table public.meeting_feedback to service_role;
grant select, insert, update, delete on table public.ticket_feedback_averages to service_role;
grant update on table public.profiles to service_role;
