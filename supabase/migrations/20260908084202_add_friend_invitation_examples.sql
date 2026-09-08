-- Operator-created, expiring examples; never create a real meeting application.
create table public.friend_invitation_examples (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.meeting_events(id) on delete cascade,
  recipient_phone text not null check (recipient_phone ~ '^010[0-9]{8}$'),
  message_id text unique,
  delivered_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.friend_invitation_examples enable row level security;
revoke all on public.friend_invitation_examples from anon, authenticated;
grant select, insert, update, delete on public.friend_invitation_examples to service_role;
