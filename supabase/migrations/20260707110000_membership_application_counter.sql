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
on conflict (counter_key) do nothing;

create or replace function public.increment_service_counter(
  p_counter_key text,
  p_amount integer default 1,
  p_default_base_count integer default 0,
  p_default_limit_count integer default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_count integer;
begin
  insert into public.service_counters (
    counter_key,
    base_count,
    limit_count,
    updated_at
  )
  values (
    p_counter_key,
    greatest(0, p_default_base_count) + p_amount,
    p_default_limit_count,
    now()
  )
  on conflict (counter_key)
  do update set
    base_count = public.service_counters.base_count + p_amount,
    updated_at = now()
  returning base_count into next_count;

  return next_count;
end;
$$;

alter table public.service_counters enable row level security;

grant select, insert, update, delete on table public.service_counters to service_role;
grant execute on function public.increment_service_counter(text, integer, integer, integer)
to service_role;
