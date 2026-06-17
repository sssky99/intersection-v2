update public.ticket_templates
set visibility = 'public'
where visibility = 'question';

update public.ticket_instances
set visibility = 'public'
where visibility = 'question';
