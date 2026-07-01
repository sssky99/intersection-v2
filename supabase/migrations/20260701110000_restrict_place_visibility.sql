alter table public.ticket_templates
  alter column place_visibility set default 'confirmed_only';

update public.ticket_templates
set place_visibility = 'confirmed_only'
where place_visibility = 'public';

alter table public.ticket_templates
  drop constraint if exists ticket_templates_place_visibility_check,
  add constraint ticket_templates_place_visibility_check
    check (place_visibility in ('hidden', 'confirmed_only'));

alter table public.ticket_instances
  alter column place_visibility set default 'confirmed_only';

update public.ticket_instances
set place_visibility = 'confirmed_only'
where place_visibility = 'public';

alter table public.ticket_instances
  drop constraint if exists ticket_instances_place_visibility_check,
  add constraint ticket_instances_place_visibility_check
    check (place_visibility in ('hidden', 'confirmed_only'));
