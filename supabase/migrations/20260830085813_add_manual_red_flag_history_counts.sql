alter table public.profile_red_flag_reviews
add column if not exists manual_no_show_count smallint not null default 0,
add column if not exists manual_same_day_cancellation_count smallint not null default 0;

alter table public.profile_red_flag_reviews
drop constraint if exists profile_red_flag_reviews_manual_no_show_count_range;

alter table public.profile_red_flag_reviews
add constraint profile_red_flag_reviews_manual_no_show_count_range
check (manual_no_show_count between 0 and 99);

alter table public.profile_red_flag_reviews
drop constraint if exists profile_red_flag_reviews_manual_same_day_cancellation_count_range;

alter table public.profile_red_flag_reviews
add constraint profile_red_flag_reviews_manual_same_day_cancellation_count_range
check (manual_same_day_cancellation_count between 0 and 99);

comment on column public.profile_red_flag_reviews.manual_no_show_count is
  'Administrator-entered additional no-show count not already represented in ticket participation history.';

comment on column public.profile_red_flag_reviews.manual_same_day_cancellation_count is
  'Administrator-entered additional same-day cancellation count not already represented in ticket participation history.';
