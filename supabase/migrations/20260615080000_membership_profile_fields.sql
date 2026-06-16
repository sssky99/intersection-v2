alter table public.profiles
add column if not exists membership_status text,
add column if not exists membership_plan text,
add column if not exists membership_start_date date,
add column if not exists membership_end_date date,
add column if not exists membership_purchase_clicked_at timestamptz,
add column if not exists membership_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_membership_status_check'
  ) then
    alter table public.profiles
    add constraint profiles_membership_status_check
    check (
      membership_status is null
      or membership_status in ('active', 'expired', 'pending', 'cancelled')
    );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_membership_plan_check'
  ) then
    alter table public.profiles
    add constraint profiles_membership_plan_check
    check (
      membership_plan is null
      or membership_plan in ('one_month', 'three_months', 'six_months')
    );
  end if;
end
$$;
