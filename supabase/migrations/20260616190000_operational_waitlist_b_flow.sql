alter table public.meeting_waitlist
add column if not exists ticket_template_id uuid
references public.ticket_templates(id) on delete set null,
add column if not exists admin_note text;

update public.meeting_waitlist
set status = 'not_selected'
where status = 'declined';

update public.meeting_waitlist
set status = 'waitlisted'
where status not in (
  'waitlisted',
  'approved',
  'on_hold',
  'not_selected',
  'cancelled',
  'payment_pending'
);

alter table public.meeting_waitlist
drop constraint if exists meeting_waitlist_status_check;

alter table public.meeting_waitlist
add constraint meeting_waitlist_status_check
check (
  status in (
    'waitlisted',
    'approved',
    'on_hold',
    'not_selected',
    'cancelled',
    'payment_pending'
  )
);

update public.meeting_waitlist waitlist
set ticket_template_id = instance.template_id
from public.ticket_instances instance
where waitlist.ticket_instance_id = instance.id
  and waitlist.ticket_template_id is null;

create index if not exists meeting_waitlist_ticket_template_id_idx
on public.meeting_waitlist(ticket_template_id);

create unique index if not exists meeting_waitlist_user_instance_unique_idx
on public.meeting_waitlist(user_id, ticket_instance_id)
where ticket_instance_id is not null;

drop policy if exists "Users can join own meeting waitlist"
on public.meeting_waitlist;

create policy "Users can join own meeting waitlist"
on public.meeting_waitlist
for insert
to authenticated
with check (
  auth.uid() = user_id
  and status in ('waitlisted', 'payment_pending')
);

grant select, insert on table public.meeting_waitlist to authenticated;
grant select, insert, update, delete on table public.meeting_waitlist to service_role;
