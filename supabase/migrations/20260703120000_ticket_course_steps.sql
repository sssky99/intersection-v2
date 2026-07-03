alter table public.ticket_templates
  add column if not exists course_steps jsonb not null default '[]'::jsonb;

update public.ticket_templates
set course_steps = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'id', 'step-1',
      'order', 1,
      'activityType', activity_type,
      'imageUrl', image_url,
      'isMainActivity', true
    )
  ),
  jsonb_build_object(
    'id', 'step-2',
    'order', 2,
    'isMainActivity', false
  )
)
where course_steps = '[]'::jsonb;

alter table public.ticket_templates
  drop constraint if exists ticket_templates_course_steps_array_check,
  add constraint ticket_templates_course_steps_array_check
    check (jsonb_typeof(course_steps) = 'array');
