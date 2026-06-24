alter table public.ticket_templates
add column if not exists minimum_participant_count integer not null default 3;

alter table public.meeting_proposals
add column if not exists minimum_participant_count integer not null default 3,
add column if not exists max_participant_count integer not null default 6;

update public.ticket_templates
set
  minimum_participant_count = 3,
  max_participant_count = 6
where minimum_participant_count is distinct from 3
   or max_participant_count is distinct from 6;

update public.meeting_proposals
set
  minimum_participant_count = 3,
  max_participant_count = 6
where minimum_participant_count is distinct from 3
   or max_participant_count is distinct from 6;

alter table public.ticket_templates
drop constraint if exists ticket_templates_minimum_participant_count_check;

alter table public.ticket_templates
add constraint ticket_templates_minimum_participant_count_check
check (minimum_participant_count between 3 and 6);

alter table public.ticket_templates
drop constraint if exists ticket_templates_max_participant_count_check;

alter table public.ticket_templates
add constraint ticket_templates_max_participant_count_check
check (max_participant_count between 3 and 6);

alter table public.ticket_templates
drop constraint if exists ticket_templates_participant_count_order_check;

alter table public.ticket_templates
add constraint ticket_templates_participant_count_order_check
check (minimum_participant_count <= max_participant_count);

alter table public.meeting_proposals
drop constraint if exists meeting_proposals_minimum_participant_count_check;

alter table public.meeting_proposals
add constraint meeting_proposals_minimum_participant_count_check
check (minimum_participant_count between 3 and 6);

alter table public.meeting_proposals
drop constraint if exists meeting_proposals_max_participant_count_check;

alter table public.meeting_proposals
add constraint meeting_proposals_max_participant_count_check
check (max_participant_count between 3 and 6);

alter table public.meeting_proposals
drop constraint if exists meeting_proposals_participant_count_order_check;

alter table public.meeting_proposals
add constraint meeting_proposals_participant_count_order_check
check (minimum_participant_count <= max_participant_count);

create table if not exists public.meeting_proposal_change_requests (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.meeting_proposals(id) on delete cascade,
  requester_id uuid not null references public.profiles(user_id) on delete cascade,
  request_type text not null
    check (request_type in ('edit', 'cancel')),
  request_body text not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'reviewed', 'approved', 'rejected')),
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meeting_proposal_change_requests_proposal_id_idx
on public.meeting_proposal_change_requests(proposal_id);

create index if not exists meeting_proposal_change_requests_requester_id_idx
on public.meeting_proposal_change_requests(requester_id);

create index if not exists meeting_proposal_change_requests_status_idx
on public.meeting_proposal_change_requests(status);

alter table public.meeting_proposal_change_requests enable row level security;

drop policy if exists "Users can read own proposal change requests"
on public.meeting_proposal_change_requests;

create policy "Users can read own proposal change requests"
on public.meeting_proposal_change_requests
for select
to authenticated
using (auth.uid() = requester_id);

drop policy if exists "Users can insert own proposal change requests"
on public.meeting_proposal_change_requests;

create policy "Users can insert own proposal change requests"
on public.meeting_proposal_change_requests
for insert
to authenticated
with check (auth.uid() = requester_id);

grant select, insert on table public.meeting_proposal_change_requests to authenticated;
grant select, insert, update, delete on table public.meeting_proposal_change_requests to service_role;
