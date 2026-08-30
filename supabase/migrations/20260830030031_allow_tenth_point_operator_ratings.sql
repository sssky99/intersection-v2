alter table public.profile_operator_ratings
drop constraint if exists profile_operator_ratings_range;

alter table public.profile_operator_ratings
add constraint profile_operator_ratings_range
check (
  rating >= 0.1
  and rating <= 5.0
  and rating * 10 = trunc(rating * 10)
);

comment on column public.profile_operator_ratings.rating is
  'Internal operator rating from 0.1 to 5.0 in 0.1 increments.';
