create or replace function public.protect_operator_profile_flag()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    if tg_op = 'INSERT' then
      new.is_test_participant := false;
    elsif new.is_test_participant is distinct from old.is_test_participant then
      raise exception 'is_test_participant can only be changed by the service role';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_operator_profile_flag_trigger
on public.profiles;

create trigger protect_operator_profile_flag_trigger
before insert or update on public.profiles
for each row execute function public.protect_operator_profile_flag();
