alter table public.membership_payment_intents
  add column if not exists meeting_date_application_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'membership_payment_intents_date_application_fkey'
      and conrelid = 'public.membership_payment_intents'::regclass
  ) then
    alter table public.membership_payment_intents
      add constraint membership_payment_intents_date_application_fkey
      foreign key (meeting_date_application_id)
      references public.meeting_date_applications(id)
      on delete set null;
  end if;
end
$$;

create index if not exists membership_payment_intents_date_application_idx
on public.membership_payment_intents(meeting_date_application_id)
where meeting_date_application_id is not null;
