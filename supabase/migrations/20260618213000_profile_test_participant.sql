alter table public.profiles
add column if not exists is_test_participant boolean not null default false;

create index if not exists profiles_is_test_participant_idx
on public.profiles(is_test_participant)
where is_test_participant = true;
