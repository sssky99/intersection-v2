create table if not exists public.ticket_rejections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  ticket_instance_id uuid not null
    references public.ticket_instances(id) on delete cascade,
  ticket_template_id uuid references public.ticket_templates(id) on delete set null,
  reason text not null
    check (
      reason in (
        'time_mismatch',
        'region_too_far',
        'alcohol_burden',
        'activity_not_interested',
        'want_other_activity',
        'not_sure'
      )
    ),
  replacement_ticket_instance_id uuid
    references public.ticket_instances(id) on delete set null,
  replacement_ticket_template_id uuid
    references public.ticket_templates(id) on delete set null,
  ticket_snapshot jsonb not null default '{}'::jsonb,
  replacement_ticket_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ticket_rejections_user_created_idx
on public.ticket_rejections(user_id, created_at desc);

create index if not exists ticket_rejections_reason_created_idx
on public.ticket_rejections(reason, created_at desc);

create index if not exists ticket_rejections_ticket_idx
on public.ticket_rejections(ticket_instance_id, created_at desc);

alter table public.ticket_rejections enable row level security;

drop policy if exists "Users can read own ticket rejections"
on public.ticket_rejections;

create policy "Users can read own ticket rejections"
on public.ticket_rejections
for select
to authenticated
using (auth.uid() = user_id);

grant select on table public.ticket_rejections to authenticated;
grant select, insert, update, delete on table public.ticket_rejections to service_role;
