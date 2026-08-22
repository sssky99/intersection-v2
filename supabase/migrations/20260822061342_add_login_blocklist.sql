create table if not exists public.login_blocklist (
  phone_normalized text primary key
    check (phone_normalized ~ '^010[0-9]{8}$'),
  display_name text,
  user_id uuid references public.profiles(user_id) on delete set null,
  reason text,
  blocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists login_blocklist_user_id_uidx
on public.login_blocklist(user_id)
where user_id is not null;

alter table public.login_blocklist enable row level security;

revoke all on table public.login_blocklist from public, anon, authenticated;
grant select, insert, update, delete on table public.login_blocklist to service_role;

comment on table public.login_blocklist is
  'Server-managed phone login denylist. Never exposed to browser roles.';
