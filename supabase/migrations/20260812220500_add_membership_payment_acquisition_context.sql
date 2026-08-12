alter table public.membership_payment_intents
add column if not exists acquisition_context jsonb;

alter table public.membership_payment_intents
drop constraint if exists membership_payment_intents_acquisition_context_check;

alter table public.membership_payment_intents
add constraint membership_payment_intents_acquisition_context_check
check (
  acquisition_context is null
  or jsonb_typeof(acquisition_context) = 'object'
);

comment on column public.membership_payment_intents.acquisition_context is
  'Sanitized acquisition channel fields captured at checkout; excludes full URLs and click identifiers.';
