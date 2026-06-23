alter table public.meeting_proposals
add column if not exists rejection_reason text;
