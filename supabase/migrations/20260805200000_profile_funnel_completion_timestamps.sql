alter table public.profiles
add column if not exists questions_completed_at timestamptz,
add column if not exists basic_info_completed_at timestamptz,
add column if not exists profile_completed_at timestamptz;

update public.profiles
set questions_completed_at = coalesce(questions_completed_at, created_at)
where questions_completed = true
  and questions_completed_at is null;

update public.profiles
set basic_info_completed_at = coalesce(basic_info_completed_at, created_at)
where profile_completed = true
  and basic_info_completed_at is null;

update public.profiles
set profile_completed_at = coalesce(profile_completed_at, created_at)
where profile_completed = true
  and questions_completed = true
  and profile_completed_at is null;

create index if not exists profiles_questions_completed_at_idx
on public.profiles(questions_completed_at desc)
where questions_completed_at is not null;

create index if not exists profiles_basic_info_completed_at_idx
on public.profiles(basic_info_completed_at desc)
where basic_info_completed_at is not null;

create index if not exists profiles_profile_completed_at_idx
on public.profiles(profile_completed_at desc)
where profile_completed_at is not null;
