alter table public.meeting_proposals
  add column if not exists pexels_photo_id text,
  add column if not exists pexels_page_url text,
  add column if not exists photographer text,
  add column if not exists photographer_url text,
  add column if not exists image_source text,
  add column if not exists image_selection_method text,
  add column if not exists image_review_model text;

alter table public.ticket_templates
  add column if not exists pexels_photo_id text,
  add column if not exists pexels_page_url text,
  add column if not exists photographer text,
  add column if not exists photographer_url text,
  add column if not exists image_source text,
  add column if not exists image_selection_method text,
  add column if not exists image_review_model text;

alter table public.meeting_proposals
  drop constraint if exists meeting_proposals_image_source_check,
  add constraint meeting_proposals_image_source_check
    check (image_source is null or image_source in ('pexels', 'user_upload')),
  drop constraint if exists meeting_proposals_image_selection_method_check,
  add constraint meeting_proposals_image_selection_method_check
    check (image_selection_method is null or image_selection_method in ('auto', 'manual'));

alter table public.ticket_templates
  drop constraint if exists ticket_templates_image_source_check,
  add constraint ticket_templates_image_source_check
    check (image_source is null or image_source in ('pexels', 'user_upload')),
  drop constraint if exists ticket_templates_image_selection_method_check,
  add constraint ticket_templates_image_selection_method_check
    check (image_selection_method is null or image_selection_method in ('auto', 'manual'));

create index if not exists ticket_templates_pexels_photo_id_idx
on public.ticket_templates (pexels_photo_id)
where pexels_photo_id is not null;
