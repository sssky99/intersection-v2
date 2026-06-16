alter table public.profiles
add column if not exists details_seen_at timestamptz,
add column if not exists browse_seen_at timestamptz;
