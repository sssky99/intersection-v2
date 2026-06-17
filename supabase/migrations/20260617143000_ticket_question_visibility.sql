alter table public.ticket_templates
drop constraint if exists ticket_templates_visibility_check;

alter table public.ticket_templates
add constraint ticket_templates_visibility_check
check (visibility in ('draft', 'test_only', 'public', 'question', 'closed', 'archived'));

alter table public.ticket_instances
drop constraint if exists ticket_instances_visibility_check;

alter table public.ticket_instances
add constraint ticket_instances_visibility_check
check (visibility in ('draft', 'test_only', 'public', 'question', 'closed', 'archived'));

alter table public.ticket_templates
add column if not exists question_order integer;

alter table public.ticket_templates
drop constraint if exists ticket_templates_question_order_check;

alter table public.ticket_templates
add constraint ticket_templates_question_order_check
check (question_order is null or question_order between 1 and 5);
