create table if not exists public.ticket_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  short_description text,
  image_url text,
  mood_tags text[] not null default '{}',
  activity_type text,
  recommendation_copy text,
  default_region text,
  default_time time,
  visibility text not null default 'draft'
    check (visibility in ('draft', 'test_only', 'public', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.ticket_templates(id) on delete cascade,
  title text not null,
  event_date date,
  event_time time,
  region text,
  place_name text,
  address text,
  place_visibility text not null default 'confirmed_only'
    check (place_visibility in ('hidden', 'confirmed_only', 'public')),
  visibility text not null default 'draft'
    check (visibility in ('draft', 'test_only', 'public', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_assignments (
  id uuid primary key default gen_random_uuid(),
  ticket_instance_id uuid not null references public.ticket_instances(id) on delete cascade,
  profile_id uuid not null references public.profiles(user_id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique(ticket_instance_id, profile_id)
);

alter table public.meeting_waitlist
add column if not exists ticket_instance_id uuid
references public.ticket_instances(id) on delete set null;

create index if not exists ticket_instances_template_id_idx
on public.ticket_instances(template_id);

create index if not exists ticket_assignments_instance_id_idx
on public.ticket_assignments(ticket_instance_id);

create index if not exists meeting_waitlist_ticket_instance_id_idx
on public.meeting_waitlist(ticket_instance_id);

alter table public.ticket_templates enable row level security;
alter table public.ticket_instances enable row level security;
alter table public.ticket_assignments enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.ticket_templates to service_role;
grant select, insert, update, delete on table public.ticket_instances to service_role;
grant select, insert, update, delete on table public.ticket_assignments to service_role;
grant select on table public.meeting_waitlist to service_role;

insert into storage.buckets (id, name, public)
values ('ticket-images', 'ticket-images', true)
on conflict (id) do update set public = excluded.public;
