alter table public.meeting_date_applications
  alter column deposit_amount set default 10000;

alter table public.meeting_date_applications
  drop constraint if exists meeting_date_applications_deposit_amount_check;

-- Keep legacy 20,000 won applications valid while new applications use 10,000 won.
alter table public.meeting_date_applications
  add constraint meeting_date_applications_deposit_amount_check
  check (deposit_amount in (10000, 20000));
