alter table public.ticket_templates
add column if not exists stage_copy jsonb not null default '{}'::jsonb;

update public.ticket_templates
set stage_copy = coalesce(stage_copy, '{}'::jsonb)
where stage_copy is null;
