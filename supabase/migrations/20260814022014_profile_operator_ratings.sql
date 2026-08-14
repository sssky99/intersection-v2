create table if not exists public.profile_operator_ratings (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  rating numeric(2, 1) not null,
  updated_at timestamptz not null default now(),
  constraint profile_operator_ratings_range
    check (rating >= 0.5 and rating <= 5 and mod(rating * 2, 1) = 0)
);

comment on table public.profile_operator_ratings is
  'Administrator-only internal ratings. Never exposed through user-facing profile queries.';
comment on column public.profile_operator_ratings.rating is
  'Internal operator rating from 0.5 to 5.0 in 0.5 increments.';

alter table public.profile_operator_ratings enable row level security;
revoke all on table public.profile_operator_ratings from anon, authenticated;

insert into public.profile_operator_ratings (user_id, rating, updated_at)
select user_id, operator_rating, coalesce(operator_rating_updated_at, now())
from public.profiles
where operator_rating is not null
on conflict (user_id) do update
set rating = excluded.rating,
    updated_at = excluded.updated_at;

drop trigger if exists protect_profile_operator_rating_trigger on public.profiles;
drop function if exists public.protect_profile_operator_rating();

alter table public.profiles
  drop column if exists operator_rating,
  drop column if exists operator_rating_updated_at;
