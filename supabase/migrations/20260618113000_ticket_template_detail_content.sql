alter table public.ticket_templates
  add column if not exists detail_summary text,
  add column if not exists detail_activities jsonb,
  add column if not exists detail_good_for jsonb,
  add column if not exists detail_notice text;
