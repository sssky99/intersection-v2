create table if not exists public.admin_user_view_audit (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(user_id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  expires_at timestamptz not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists admin_user_view_audit_target_started_idx
on public.admin_user_view_audit(target_user_id, started_at desc);

alter table public.admin_user_view_audit enable row level security;

revoke all on table public.admin_user_view_audit from anon, authenticated;
grant select, insert, update, delete on table public.admin_user_view_audit to service_role;

drop policy if exists "Service role manages admin user view audit"
on public.admin_user_view_audit;
create policy "Service role manages admin user view audit"
on public.admin_user_view_audit
for all
to service_role
using (true)
with check (true);
