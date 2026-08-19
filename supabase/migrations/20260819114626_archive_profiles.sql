alter table public.profiles
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

comment on column public.profiles.archived_at is
  'When set, this historical profile is excluded from active identity lookups.';

comment on column public.profiles.archived_reason is
  'Operator-facing reason the profile was archived.';

create index if not exists profiles_active_phone_normalized_idx
  on public.profiles (phone_normalized)
  where archived_at is null and phone_normalized is not null;
