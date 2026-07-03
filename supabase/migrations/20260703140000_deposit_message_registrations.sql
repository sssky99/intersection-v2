create table if not exists public.service_counters (
  counter_key text primary key,
  base_count integer not null default 0,
  limit_count integer,
  updated_at timestamptz not null default now()
);

insert into public.service_counters (
  counter_key,
  base_count,
  limit_count,
  updated_at
) values (
  'free_deposit_message_registrations',
  66,
  100,
  now()
)
on conflict (counter_key) do update
set
  base_count = excluded.base_count,
  limit_count = excluded.limit_count,
  updated_at = now();

create table if not exists public.deposit_message_registrations (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  first_ticket_instance_id uuid references public.ticket_instances(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deposit_message_registrations_user_unique unique (user_id)
);

create index if not exists deposit_message_registrations_created_at_idx
on public.deposit_message_registrations (created_at desc);

create index if not exists deposit_message_registrations_ticket_instance_idx
on public.deposit_message_registrations (first_ticket_instance_id);

alter table public.service_counters enable row level security;
alter table public.deposit_message_registrations enable row level security;

grant select, insert, update, delete on table public.service_counters to service_role;
grant select, insert, update, delete on table public.deposit_message_registrations to service_role;
grant usage, select on sequence public.deposit_message_registrations_id_seq to service_role;
