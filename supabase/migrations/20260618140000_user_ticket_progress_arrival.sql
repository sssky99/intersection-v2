alter table public.meeting_waitlist
add column if not exists arrival_status text,
add column if not exists arrival_status_updated_at timestamptz,
add column if not exists feedback_completed_at timestamptz;

update public.meeting_waitlist
set status = 'waitlisted'
where status not in (
  'waitlisted',
  'approved',
  'on_hold',
  'not_selected',
  'cancelled',
  'payment_pending',
  'feedback_done',
  'completed'
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
    'payment_pending',
    'feedback_done',
    'completed'
  )
);

alter table public.meeting_waitlist
drop constraint if exists meeting_waitlist_arrival_status_check;

alter table public.meeting_waitlist
add constraint meeting_waitlist_arrival_status_check
check (
  arrival_status is null
  or arrival_status in (
    'on_time',
    'late_10',
    'late_20',
    'late_30_plus'
  )
);

create index if not exists meeting_waitlist_arrival_status_idx
on public.meeting_waitlist(arrival_status);
