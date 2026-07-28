alter table public.profiles
add column if not exists profile_experience_version text not null default 'legacy-v1';

alter table public.profiles
drop constraint if exists profiles_profile_experience_version_check;

alter table public.profiles
add constraint profiles_profile_experience_version_check
check (profile_experience_version in ('legacy-v1', 'preferences-v2'));

comment on column public.profiles.profile_experience_version is
'Selects the legacy conversation-type profile or the preferences-based profile experience.';

create or replace function public.protect_profile_experience_version()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated'
    and new.profile_experience_version is distinct from old.profile_experience_version
  then
    raise exception 'profile experience version cannot be changed directly';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_experience_version_trigger
on public.profiles;
create trigger protect_profile_experience_version_trigger
before update on public.profiles
for each row execute function public.protect_profile_experience_version();

revoke all on function public.protect_profile_experience_version()
from public, anon, authenticated;
