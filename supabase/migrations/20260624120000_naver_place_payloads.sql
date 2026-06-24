alter table public.meeting_proposals
  add column if not exists place_payload jsonb;

alter table public.ticket_templates
  add column if not exists place_payload jsonb;

alter table public.ticket_instances
  add column if not exists place_payload jsonb;
