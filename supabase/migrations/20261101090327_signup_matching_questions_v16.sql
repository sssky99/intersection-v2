-- Only new profiles use this questionnaire. Existing answers and versions stay intact.
alter table public.profiles drop constraint if exists profiles_profile_experience_version_check;
alter table public.profiles add constraint profiles_profile_experience_version_check
check (profile_experience_version in (
  'legacy-v1', 'preferences-v2', 'preferences-v13', 'preferences-v14',
  'preferences-v15', 'preferences-v16'
));
alter table public.profiles alter column profile_experience_version set default 'preferences-v16';
