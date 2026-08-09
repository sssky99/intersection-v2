alter table public.profiles
add column if not exists profile_archetype_id text;

alter table public.profiles
add column if not exists profile_archetype_version text;

alter table public.profiles
add column if not exists profile_archetype_assigned_at timestamptz;

alter table public.profiles
drop constraint if exists profiles_profile_archetype_id_check;

alter table public.profiles
add constraint profiles_profile_archetype_id_check
check (
  profile_archetype_id is null
  or profile_archetype_id in (
    'romantic',
    'sentimental',
    'bohemian',
    'adventurer',
    'experientialist',
    'stoic',
    'searcher',
    'idealist',
    'artisan',
    'visionary'
  )
);

comment on column public.profiles.profile_archetype_id is
'The single profile archetype assigned from the current 30-question profile.';
