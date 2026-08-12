alter table public.membership_payment_intents
add column if not exists experiment_id text,
add column if not exists landing_variant text;

alter table public.membership_payment_intents
drop constraint if exists membership_payment_intents_landing_variant_check;

alter table public.membership_payment_intents
add constraint membership_payment_intents_landing_variant_check
check (landing_variant is null or landing_variant in ('a', 'b'));

create index if not exists membership_payment_intents_experiment_variant_idx
on public.membership_payment_intents(experiment_id, landing_variant)
where experiment_id is not null and landing_variant is not null;

comment on column public.membership_payment_intents.experiment_id is
  'Experiment assignment captured when the membership checkout intent is opened.';

comment on column public.membership_payment_intents.landing_variant is
  'Landing A/B variant captured from the signed-in browser session at checkout.';
