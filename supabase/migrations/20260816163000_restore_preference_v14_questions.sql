update public.profiles
set profile_experience_version = 'preferences-v14'
where profile_experience_version = 'preferences-v15';

alter table public.profiles
alter column profile_experience_version set default 'preferences-v14';

comment on column public.profiles.profile_experience_version is
'Controls profile compatibility. preferences-v14 is the current questionnaire.';
