update public.profiles
set details_seen_at = browse_seen_at
where details_seen_at is null
  and browse_seen_at is not null;
