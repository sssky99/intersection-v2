alter table public.profiles
drop constraint if exists profiles_membership_status_check;

alter table public.profiles
add constraint profiles_membership_status_check
check (
  membership_status is null
  or membership_status in ('none', 'active', 'expired', 'pending', 'cancelled')
);
