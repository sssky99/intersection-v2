alter table public.blind_date_templates
add column if not exists actual_place_name text,
add column if not exists actual_place_address text,
add column if not exists stage_copy jsonb not null default '{}'::jsonb,
add column if not exists deleted_at timestamptz;

alter table public.blind_date_offers
add column if not exists actual_place_name text,
add column if not exists actual_place_address text;

create index if not exists blind_date_templates_deleted_at_idx
on public.blind_date_templates(deleted_at);

update public.blind_date_templates
set stage_copy = coalesce(stage_copy, '{}'::jsonb)
where stage_copy is null;
