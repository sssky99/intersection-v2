alter table public.meeting_date_applications
  alter column deposit_amount drop not null,
  alter column deposit_amount drop default,
  alter column deposit_status drop not null,
  alter column deposit_status drop default,
  alter column deposit_requested_at drop not null,
  alter column deposit_requested_at drop default;

comment on column public.meeting_date_applications.deposit_amount is
  'Legacy one-time/deposit payment amount. New membership applications leave this null.';

comment on column public.meeting_date_applications.deposit_status is
  'Legacy one-time/deposit payment status. New membership applications use application and membership status instead.';

comment on column public.meeting_date_applications.deposit_requested_at is
  'Legacy one-time/deposit request timestamp. New membership applications leave this null.';
