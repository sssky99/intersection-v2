create table if not exists public.kakao_channel_links (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(user_id) on delete cascade,
  kakao_bot_user_key text not null,
  kakao_plusfriend_user_key text,
  kakao_user_type text not null default 'botUserKey',
  display_name text not null,
  phone_last4 text not null,
  status text not null default 'active',
  verified_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kakao_channel_links_profile_unique unique (profile_id),
  constraint kakao_channel_links_bot_user_unique unique (kakao_bot_user_key),
  constraint kakao_channel_links_phone_last4_check
    check (phone_last4 ~ '^[0-9]{4}$'),
  constraint kakao_channel_links_status_check
    check (status in ('active', 'blocked', 'disconnected'))
);

create unique index if not exists kakao_channel_links_plusfriend_user_unique
on public.kakao_channel_links (kakao_plusfriend_user_key)
where kakao_plusfriend_user_key is not null;

create index if not exists kakao_channel_links_status_idx
on public.kakao_channel_links (status, last_seen_at desc);

create table if not exists public.kakao_channel_link_attempts (
  id bigint generated always as identity primary key,
  kakao_bot_user_key text not null,
  kakao_plusfriend_user_key text,
  submitted_name text not null,
  phone_last4 text not null,
  result text not null,
  matched_profile_id uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  constraint kakao_channel_link_attempts_phone_last4_check
    check (phone_last4 ~ '^[0-9]{4}$'),
  constraint kakao_channel_link_attempts_result_check
    check (
      result in (
        'matched',
        'already_linked',
        'not_found',
        'ambiguous',
        'conflict'
      )
    )
);

create index if not exists kakao_channel_link_attempts_review_idx
on public.kakao_channel_link_attempts (result, created_at desc);

alter table public.kakao_channel_links enable row level security;
alter table public.kakao_channel_link_attempts enable row level security;

revoke all on table public.kakao_channel_links from anon, authenticated;
revoke all on table public.kakao_channel_link_attempts from anon, authenticated;

grant select, insert, update, delete
on table public.kakao_channel_links to service_role;

grant select, insert, update, delete
on table public.kakao_channel_link_attempts to service_role;

grant usage, select
on sequence public.kakao_channel_links_id_seq to service_role;

grant usage, select
on sequence public.kakao_channel_link_attempts_id_seq to service_role;
