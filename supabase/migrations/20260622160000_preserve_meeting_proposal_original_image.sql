alter table public.meeting_proposals
  add column if not exists original_image_url text;

-- Keep the proposer-supplied image available after an operator replaces the
-- invitation image. Existing proposals use their current image as the source.
update public.meeting_proposals
set original_image_url = image_url
where original_image_url is null;
