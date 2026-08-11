alter table public.profiles
add column if not exists birth_date date;

comment on column public.profiles.birth_date is
  'Full date of birth collected during preference onboarding.';
