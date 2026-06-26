alter table public.meeting_waitlist
drop constraint if exists meeting_waitlist_ticket_instance_id_fkey;

alter table public.meeting_waitlist
add constraint meeting_waitlist_ticket_instance_id_fkey
foreign key (ticket_instance_id)
references public.ticket_instances(id)
on delete cascade;

alter table public.meeting_waitlist
drop constraint if exists meeting_waitlist_ticket_template_id_fkey;

alter table public.meeting_waitlist
add constraint meeting_waitlist_ticket_template_id_fkey
foreign key (ticket_template_id)
references public.ticket_templates(id)
on delete cascade;
