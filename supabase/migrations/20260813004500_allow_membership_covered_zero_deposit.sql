alter table public.meeting_date_applications
drop constraint if exists meeting_date_applications_deposit_amount_check;

alter table public.meeting_date_applications
add constraint meeting_date_applications_deposit_amount_check
check (deposit_amount in (0, 10000, 20000));

comment on constraint meeting_date_applications_deposit_amount_check
on public.meeting_date_applications is
  'Allows zero for participation covered by an active membership and preserves legacy paid amounts.';
