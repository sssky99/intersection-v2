alter table public.blind_date_offers
add column if not exists reservation_name text;

create table if not exists public.blind_date_participations (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.blind_date_offers(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  arrival_status text
    check (arrival_status in ('on_time', 'late_10', 'late_20', 'late_30_plus')),
  arrival_status_updated_at timestamptz,
  counterpart_rating smallint check (counterpart_rating between 1 and 5),
  counterpart_comment text check (char_length(counterpart_comment) <= 500),
  place_rating smallint check (place_rating between 1 and 5),
  place_comment text check (char_length(place_comment) <= 500),
  feedback_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offer_id, user_id)
);

create index if not exists blind_date_participations_user_id_idx
on public.blind_date_participations(user_id);

create index if not exists blind_date_participations_offer_id_idx
on public.blind_date_participations(offer_id);

alter table public.blind_date_participations enable row level security;

revoke all on table public.blind_date_participations from anon, authenticated;
grant select, insert, update, delete on table public.blind_date_participations to service_role;

drop policy if exists "Service role manages blind date participations"
on public.blind_date_participations;
create policy "Service role manages blind date participations"
on public.blind_date_participations
for all
to service_role
using (true)
with check (true);
