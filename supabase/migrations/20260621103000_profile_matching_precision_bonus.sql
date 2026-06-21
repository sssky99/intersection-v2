alter table public.profiles
add column if not exists matching_precision_bonus integer not null default 0;

alter table public.profiles
drop constraint if exists profiles_matching_precision_bonus_range;

alter table public.profiles
add constraint profiles_matching_precision_bonus_range
check (matching_precision_bonus >= 0 and matching_precision_bonus <= 5);
