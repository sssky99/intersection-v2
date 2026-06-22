create table if not exists public.meeting_proposals (
  id uuid primary key default gen_random_uuid(),
  proposer_id uuid not null references public.profiles(user_id) on delete cascade,
  proposer_membership_status text,
  proposer_public_display_name text not null,
  proposer_public_intro text,
  proposer_public_emoji text,
  image_url text,
  title text not null,
  activity_description text not null,
  event_date date not null,
  event_time time not null,
  region text not null,
  specific_place text,
  hashtags text[] not null default '{}',
  short_description text not null,
  activities jsonb not null default '[]'::jsonb,
  vibe jsonb not null default '{}'::jsonb,
  flow jsonb not null default '[]'::jsonb,
  proposer_role_agreed boolean not null default false,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'converted_to_ticket', 'rejected')),
  admin_note text,
  converted_template_id uuid references public.ticket_templates(id) on delete set null,
  converted_instance_id uuid references public.ticket_instances(id) on delete set null,
  converted_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meeting_proposals
  alter column image_url drop not null;

alter table public.ticket_templates
  add column if not exists detail_flow jsonb,
  add column if not exists proposal_id uuid references public.meeting_proposals(id) on delete set null,
  add column if not exists proposer_user_id uuid references public.profiles(user_id) on delete set null,
  add column if not exists proposer_display_name text,
  add column if not exists proposer_public_intro text,
  add column if not exists proposer_public_emoji text;

create index if not exists meeting_proposals_proposer_id_idx
on public.meeting_proposals(proposer_id);

create index if not exists meeting_proposals_status_idx
on public.meeting_proposals(status);

create index if not exists ticket_templates_proposal_id_idx
on public.ticket_templates(proposal_id);

alter table public.meeting_proposals enable row level security;

drop policy if exists "Users can read own meeting proposals"
on public.meeting_proposals;

create policy "Users can read own meeting proposals"
on public.meeting_proposals
for select
to authenticated
using (auth.uid() = proposer_id);

grant select on table public.meeting_proposals to authenticated;
grant select, insert, update, delete on table public.meeting_proposals to service_role;
