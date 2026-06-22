alter table public.ticket_templates
  add column if not exists detail_flow jsonb,
  add column if not exists event_date date,
  add column if not exists event_time time,
  add column if not exists region text,
  add column if not exists place_name text,
  add column if not exists address text,
  add column if not exists place_visibility text not null default 'confirmed_only'
    check (place_visibility in ('hidden', 'confirmed_only', 'public')),
  add column if not exists operation_code text,
  add column if not exists operation_note text,
  add column if not exists remaining_seat_label_count integer not null default 0,
  add column if not exists max_participant_count integer not null default 6,
  add column if not exists proposal_id uuid references public.meeting_proposals(id) on delete set null,
  add column if not exists proposer_user_id uuid references public.profiles(user_id) on delete set null,
  add column if not exists proposer_display_name text,
  add column if not exists proposer_public_intro text,
  add column if not exists proposer_public_emoji text;

alter table public.ticket_templates
drop constraint if exists ticket_templates_remaining_seat_label_count_check;

alter table public.ticket_templates
add constraint ticket_templates_remaining_seat_label_count_check
check (remaining_seat_label_count between 0 and 6);

alter table public.ticket_templates
drop constraint if exists ticket_templates_max_participant_count_check;

alter table public.ticket_templates
add constraint ticket_templates_max_participant_count_check
check (max_participant_count = 6);

with first_instances as (
  select distinct on (template_id)
    template_id,
    title,
    event_date,
    event_time,
    region,
    place_name,
    address,
    place_visibility,
    operation_code,
    operation_note,
    visibility,
    remaining_seat_label_count
  from public.ticket_instances
  order by template_id, event_date nulls last, event_time nulls last, created_at
)
update public.ticket_templates template
set
  event_date = coalesce(template.event_date, first_instances.event_date),
  event_time = coalesce(template.event_time, first_instances.event_time, template.default_time),
  region = coalesce(template.region, first_instances.region, template.default_region),
  place_name = coalesce(template.place_name, first_instances.place_name),
  address = coalesce(template.address, first_instances.address),
  place_visibility = coalesce(first_instances.place_visibility, template.place_visibility, 'confirmed_only'),
  operation_code = coalesce(template.operation_code, first_instances.operation_code),
  operation_note = coalesce(template.operation_note, first_instances.operation_note),
  visibility = case
    when template.visibility = 'draft' and first_instances.visibility is not null
      then first_instances.visibility
    else template.visibility
  end,
  remaining_seat_label_count = coalesce(first_instances.remaining_seat_label_count, template.remaining_seat_label_count, 0),
  updated_at = now()
from first_instances
where template.id = first_instances.template_id;

create index if not exists ticket_templates_event_date_idx
on public.ticket_templates(event_date);

create index if not exists ticket_templates_proposer_user_id_idx
on public.ticket_templates(proposer_user_id);
