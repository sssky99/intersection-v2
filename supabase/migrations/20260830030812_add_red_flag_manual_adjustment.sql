alter table public.profile_red_flag_reviews
add column if not exists manual_adjustment numeric(3, 1) not null default 0;

alter table public.profile_red_flag_reviews
drop constraint if exists profile_red_flag_reviews_manual_adjustment_range;

alter table public.profile_red_flag_reviews
add constraint profile_red_flag_reviews_manual_adjustment_range
check (
  manual_adjustment >= -5
  and manual_adjustment <= 5
  and manual_adjustment * 2 = trunc(manual_adjustment * 2)
);

comment on column public.profile_red_flag_reviews.manual_adjustment is
  'Administrator adjustment from -5.0 to 5.0 in 0.5 increments, added after automatic and manual-rule scores.';
