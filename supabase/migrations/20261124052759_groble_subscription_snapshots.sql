-- Seller-list snapshots are for reconciliation only. They never grant access.
create table public.groble_subscription_snapshots (
  captured_at timestamptz not null,
  product_code text not null,
  total_count integer not null check (total_count >= 0),
  subscriptions jsonb not null,
  primary key (product_code, captured_at),
  check (
    jsonb_typeof(subscriptions) = 'array'
    and jsonb_array_length(subscriptions) <= total_count
  )
);

alter table public.groble_subscription_snapshots enable row level security;
revoke all on public.groble_subscription_snapshots from public, anon, authenticated, service_role;
grant select, insert on public.groble_subscription_snapshots to service_role;
