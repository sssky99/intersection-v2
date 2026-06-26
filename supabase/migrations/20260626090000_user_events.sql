create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  anonymous_session_id text,
  profile_id uuid null references public.profiles(user_id) on delete set null,
  application_id uuid null,
  event_name text not null,
  path text null,
  referrer text null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_events enable row level security;

create index if not exists user_events_created_at_idx
on public.user_events (created_at desc);

create index if not exists user_events_event_name_created_at_idx
on public.user_events (event_name, created_at desc);

create index if not exists user_events_profile_id_idx
on public.user_events (profile_id);

create index if not exists user_events_anonymous_session_id_idx
on public.user_events (anonymous_session_id);

grant select, insert on table public.user_events to service_role;
