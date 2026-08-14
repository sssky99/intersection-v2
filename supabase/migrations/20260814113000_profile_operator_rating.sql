alter table public.profiles
add column if not exists operator_rating numeric(2, 1),
add column if not exists operator_rating_updated_at timestamptz;

alter table public.profiles
drop constraint if exists profiles_operator_rating_range;

alter table public.profiles
add constraint profiles_operator_rating_range
check (
  operator_rating is null
  or (
    operator_rating >= 0.5
    and operator_rating <= 5.0
    and operator_rating * 2 = trunc(operator_rating * 2)
  )
);

comment on column public.profiles.operator_rating is
'Admin-only participant rating from 0.5 to 5.0 in 0.5 increments.';

comment on column public.profiles.operator_rating_updated_at is
'Last time an admin changed operator_rating.';

create or replace function public.protect_profile_operator_rating()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.operator_rating := null;
    new.operator_rating_updated_at := null;
    return new;
  end if;

  if new.operator_rating is distinct from old.operator_rating
    or new.operator_rating_updated_at is distinct from old.operator_rating_updated_at
  then
    raise exception 'server-managed profile fields cannot be changed directly';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_operator_rating_trigger on public.profiles;
create trigger protect_profile_operator_rating_trigger
before insert or update on public.profiles
for each row execute function public.protect_profile_operator_rating();

revoke all on function public.protect_profile_operator_rating()
from public, anon, authenticated;
