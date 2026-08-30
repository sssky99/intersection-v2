create table if not exists public.profile_red_flag_reviews (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  manual_flags jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint profile_red_flag_reviews_manual_flags_object
    check (jsonb_typeof(manual_flags) = 'object')
);

comment on table public.profile_red_flag_reviews is
  'Administrator-only manual red-flag review signals. Automatic signals are calculated from answers and participation history.';
comment on column public.profile_red_flag_reviews.manual_flags is
  'Boolean manual review flags keyed by the supported red-flag rule identifiers.';

alter table public.profile_red_flag_reviews enable row level security;

revoke all on table public.profile_red_flag_reviews from anon, authenticated;
grant select, insert, update, delete
on table public.profile_red_flag_reviews
to service_role;
