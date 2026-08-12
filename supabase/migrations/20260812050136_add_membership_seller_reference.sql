alter table public.membership_payment_intents
add column if not exists seller_reference text;

create unique index if not exists membership_payment_intents_seller_reference_idx
on public.membership_payment_intents(seller_reference)
where seller_reference is not null;

alter table public.membership_payment_intents
drop constraint if exists membership_payment_intents_seller_reference_check;

alter table public.membership_payment_intents
add constraint membership_payment_intents_seller_reference_check
check (
  seller_reference is null
  or seller_reference ~ '^[A-Za-z0-9_.:=-]{1,128}$'
);
