alter table public.ticket_participations
drop constraint if exists meeting_waitlist_arrival_status_check;

alter table public.ticket_participations
add constraint meeting_waitlist_arrival_status_check
check (
  arrival_status is null
  or arrival_status in (
    'on_time',
    'late_10',
    'late_20',
    'late_30_plus',
    'no_show'
  )
);
