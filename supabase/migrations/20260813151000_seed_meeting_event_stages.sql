insert into public.meeting_event_stages (
  event_id,
  title,
  stage_type,
  sequence,
  starts_at,
  location_mode
)
select event.id, '저녁 식사', 'meal', 1, event.starts_at, 'group_specific'
from public.meeting_events event
where not exists (
  select 1 from public.meeting_event_stages stage
  where stage.event_id = event.id and stage.sequence = 1
)
on conflict (event_id, sequence) do nothing;

insert into public.meeting_event_stages (
  event_id,
  title,
  stage_type,
  sequence,
  starts_at,
  location_mode
)
select
  event.id,
  '공통 활동',
  'activity',
  2,
  (event.starts_at + interval '90 minutes')::time,
  'shared'
from public.meeting_events event
where not exists (
  select 1 from public.meeting_event_stages stage
  where stage.event_id = event.id and stage.sequence = 2
)
on conflict (event_id, sequence) do nothing;

insert into public.meeting_event_stages (
  event_id,
  title,
  stage_type,
  sequence,
  starts_at,
  location_mode
)
select
  event.id,
  '피드백',
  'feedback',
  3,
  (event.starts_at + interval '180 minutes')::time,
  'hidden'
from public.meeting_events event
where not exists (
  select 1 from public.meeting_event_stages stage
  where stage.event_id = event.id and stage.sequence = 3
)
on conflict (event_id, sequence) do nothing;

insert into public.meeting_group_stage_locations (
  group_id,
  stage_id,
  place_name,
  address,
  place_payload
)
select
  meeting_group.id,
  stage.id,
  instance.place_name,
  instance.address,
  instance.place_payload
from public.meeting_groups meeting_group
join public.ticket_instances instance
  on instance.id = meeting_group.legacy_ticket_instance_id
join public.meeting_event_stages stage
  on stage.event_id = meeting_group.event_id
 and stage.stage_type = 'meal'
where instance.place_name is not null or instance.address is not null
on conflict (group_id, stage_id) do update set
  place_name = excluded.place_name,
  address = excluded.address,
  place_payload = excluded.place_payload,
  updated_at = now();
