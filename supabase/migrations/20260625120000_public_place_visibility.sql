alter table public.ticket_templates
  alter column place_visibility set default 'public';

alter table public.ticket_instances
  alter column place_visibility set default 'public';

update public.ticket_templates
set place_visibility = 'public',
    updated_at = now()
where place_visibility = 'confirmed_only';

update public.ticket_instances
set place_visibility = 'public',
    updated_at = now()
where place_visibility = 'confirmed_only';
