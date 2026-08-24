create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to service_role;

create table public.funnel_sessions (
  session_id uuid primary key,
  profile_id uuid references public.profiles(user_id) on delete set null,
  source_type text not null default 'direct'
    check (source_type in ('direct', 'utm', 'referral')),
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  referrer_host text not null default '',
  landing_path text not null default '',
  landing_variant text not null default '',
  gender text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(utm_source) <= 160),
  check (char_length(utm_medium) <= 160),
  check (char_length(utm_campaign) <= 160),
  check (char_length(referrer_host) <= 160),
  check (char_length(landing_path) <= 240),
  check (char_length(landing_variant) <= 32)
);

create index funnel_sessions_profile_last_seen_idx
  on public.funnel_sessions(profile_id, last_seen_at desc)
  where profile_id is not null;
create index funnel_sessions_first_seen_idx
  on public.funnel_sessions(first_seen_at desc);

create table public.funnel_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.funnel_sessions(session_id) on delete cascade,
  profile_id uuid references public.profiles(user_id) on delete set null,
  event_name text not null check (
    event_name in (
      'landing_view',
      'onboarding_start',
      'questions_complete',
      'otp_verified',
      'ticket_detail_view',
      'application_created'
    )
  ),
  event_key text not null default '',
  path text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (char_length(event_key) <= 160),
  check (char_length(path) <= 240),
  check (jsonb_typeof(metadata) = 'object'),
  check (pg_column_size(metadata) <= 2048),
  unique (session_id, event_name, event_key)
);

create index funnel_events_created_at_idx
  on public.funnel_events(created_at desc);
create index funnel_events_profile_created_idx
  on public.funnel_events(profile_id, created_at desc)
  where profile_id is not null;

create table public.funnel_session_facts (
  session_id uuid primary key references public.funnel_sessions(session_id) on delete cascade,
  profile_id uuid references public.profiles(user_id) on delete set null,
  source_type text not null default 'direct',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  referrer_host text not null default '',
  landing_path text not null default '',
  landing_variant text not null default '',
  gender text,
  first_seen_at timestamptz not null,
  landing_view_at timestamptz,
  onboarding_start_at timestamptz,
  questions_complete_at timestamptz,
  otp_verified_at timestamptz,
  ticket_detail_view_at timestamptz,
  application_created_at timestamptz,
  payment_completed_at timestamptz,
  payment_amount bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index funnel_session_facts_first_seen_idx
  on public.funnel_session_facts(first_seen_at desc);
create index funnel_session_facts_profile_idx
  on public.funnel_session_facts(profile_id, first_seen_at desc)
  where profile_id is not null;

create table public.funnel_hourly_metrics (
  bucket_at timestamptz not null,
  source_kind text not null,
  landing_variant text not null default '',
  gender text not null default '',
  landing_users integer not null default 0,
  onboarding_users integer not null default 0,
  questions_complete_users integer not null default 0,
  otp_verified_users integer not null default 0,
  ticket_detail_users integer not null default 0,
  application_users integer not null default 0,
  payment_users integer not null default 0,
  payment_revenue bigint not null default 0,
  refreshed_at timestamptz not null default now(),
  primary key (bucket_at, source_kind, landing_variant, gender)
);

alter table public.funnel_sessions enable row level security;
alter table public.funnel_events enable row level security;
alter table public.funnel_session_facts enable row level security;
alter table public.funnel_hourly_metrics enable row level security;

revoke all on table public.funnel_sessions from anon, authenticated;
revoke all on table public.funnel_events from anon, authenticated;
revoke all on sequence public.funnel_events_id_seq from anon, authenticated;
revoke all on table public.funnel_session_facts from anon, authenticated;
revoke all on table public.funnel_hourly_metrics from anon, authenticated;
grant all on table public.funnel_sessions to service_role;
grant all on table public.funnel_events to service_role;
grant all on sequence public.funnel_events_id_seq to service_role;
grant all on table public.funnel_session_facts to service_role;
grant all on table public.funnel_hourly_metrics to service_role;

create or replace function private.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

create or replace function private.funnel_source_kind(
  p_source_type text,
  p_utm_source text,
  p_utm_medium text,
  p_referrer_host text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(coalesce(p_utm_source, '')) ~ '(instagram|facebook|meta)'
      or lower(coalesce(p_referrer_host, '')) like '%instagram.%'
      then 'instagram'
    when lower(coalesce(p_utm_medium, '')) in ('organic', 'search')
      or lower(coalesce(p_referrer_host, '')) ~ '(google\.|naver\.|daum\.)'
      then 'organic'
    when coalesce(p_source_type, 'direct') = 'direct' then 'direct'
    else 'other'
  end;
$$;

create or replace function private.sync_funnel_fact_from_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.funnel_sessions%rowtype;
begin
  select * into session_row
  from public.funnel_sessions
  where session_id = new.session_id;

  insert into public.funnel_session_facts (
    session_id, profile_id, source_type, utm_source, utm_medium,
    utm_campaign, referrer_host, landing_path, landing_variant, gender,
    first_seen_at, landing_view_at, onboarding_start_at,
    questions_complete_at, otp_verified_at, ticket_detail_view_at,
    application_created_at, updated_at
  ) values (
    new.session_id,
    coalesce(new.profile_id, session_row.profile_id),
    session_row.source_type,
    session_row.utm_source,
    session_row.utm_medium,
    session_row.utm_campaign,
    session_row.referrer_host,
    session_row.landing_path,
    session_row.landing_variant,
    session_row.gender,
    session_row.first_seen_at,
    case when new.event_name = 'landing_view' then new.created_at end,
    case when new.event_name = 'onboarding_start' then new.created_at end,
    case when new.event_name = 'questions_complete' then new.created_at end,
    case when new.event_name = 'otp_verified' then new.created_at end,
    case when new.event_name = 'ticket_detail_view' then new.created_at end,
    case when new.event_name = 'application_created' then new.created_at end,
    now()
  )
  on conflict (session_id) do update set
    profile_id = coalesce(excluded.profile_id, public.funnel_session_facts.profile_id),
    source_type = excluded.source_type,
    utm_source = excluded.utm_source,
    utm_medium = excluded.utm_medium,
    utm_campaign = excluded.utm_campaign,
    referrer_host = excluded.referrer_host,
    landing_path = excluded.landing_path,
    landing_variant = excluded.landing_variant,
    gender = coalesce(excluded.gender, public.funnel_session_facts.gender),
    landing_view_at = coalesce(public.funnel_session_facts.landing_view_at, excluded.landing_view_at),
    onboarding_start_at = coalesce(public.funnel_session_facts.onboarding_start_at, excluded.onboarding_start_at),
    questions_complete_at = coalesce(public.funnel_session_facts.questions_complete_at, excluded.questions_complete_at),
    otp_verified_at = coalesce(public.funnel_session_facts.otp_verified_at, excluded.otp_verified_at),
    ticket_detail_view_at = coalesce(public.funnel_session_facts.ticket_detail_view_at, excluded.ticket_detail_view_at),
    application_created_at = coalesce(public.funnel_session_facts.application_created_at, excluded.application_created_at),
    updated_at = now();

  return new;
end;
$$;

create trigger funnel_events_sync_fact
after insert on public.funnel_events
for each row execute function private.sync_funnel_fact_from_event();

create or replace function private.ingest_funnel_events_draft(
  p_session_id uuid,
  p_events jsonb,
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  caller_id uuid := auth.uid();
  event_name_value text;
  event_key_value text;
  path_value text;
  metadata_value jsonb;
  context_source text;
begin
  if p_session_id is null
    or jsonb_typeof(p_events) <> 'array'
    or jsonb_array_length(p_events) < 1
    or jsonb_array_length(p_events) > 5
    or pg_column_size(p_events) > 12288
    or jsonb_typeof(coalesce(p_context, '{}'::jsonb)) <> 'object'
    or pg_column_size(coalesce(p_context, '{}'::jsonb)) > 4096
  then
    raise exception 'invalid funnel event batch' using errcode = '22023';
  end if;

  context_source := case
    when p_context->>'source_type' in ('direct', 'utm', 'referral')
      then p_context->>'source_type'
    else 'direct'
  end;

  insert into public.funnel_sessions (
    session_id, profile_id, source_type, utm_source, utm_medium,
    utm_campaign, referrer_host, landing_path, landing_variant,
    first_seen_at, last_seen_at
  ) values (
    p_session_id,
    caller_id,
    context_source,
    left(coalesce(p_context->>'utm_source', ''), 160),
    left(coalesce(p_context->>'utm_medium', ''), 160),
    left(coalesce(p_context->>'utm_campaign', ''), 160),
    left(coalesce(p_context->>'referrer_host', ''), 160),
    left(coalesce(p_context->>'landing_path', ''), 240),
    left(coalesce(p_context->>'landing_variant', ''), 32),
    now(),
    now()
  )
  on conflict (session_id) do update set
    profile_id = coalesce(public.funnel_sessions.profile_id, caller_id),
    source_type = case when public.funnel_sessions.source_type = 'direct' then excluded.source_type else public.funnel_sessions.source_type end,
    utm_source = case when public.funnel_sessions.utm_source = '' then excluded.utm_source else public.funnel_sessions.utm_source end,
    utm_medium = case when public.funnel_sessions.utm_medium = '' then excluded.utm_medium else public.funnel_sessions.utm_medium end,
    utm_campaign = case when public.funnel_sessions.utm_campaign = '' then excluded.utm_campaign else public.funnel_sessions.utm_campaign end,
    referrer_host = case when public.funnel_sessions.referrer_host = '' then excluded.referrer_host else public.funnel_sessions.referrer_host end,
    landing_path = case when public.funnel_sessions.landing_path = '' then excluded.landing_path else public.funnel_sessions.landing_path end,
    landing_variant = case when public.funnel_sessions.landing_variant = '' then excluded.landing_variant else public.funnel_sessions.landing_variant end,
    last_seen_at = now(),
    updated_at = now();

  for item in select value from jsonb_array_elements(p_events)
  loop
    event_name_value := item->>'eventName';
    if event_name_value not in ('landing_view', 'onboarding_start', 'ticket_detail_view') then
      raise exception 'browser event is not allowed' using errcode = '22023';
    end if;
    event_key_value := left(coalesce(item->>'eventKey', ''), 160);
    path_value := left(coalesce(item->>'path', ''), 240);
    metadata_value := coalesce(item->'metadata', '{}'::jsonb);
    if jsonb_typeof(metadata_value) <> 'object' or pg_column_size(metadata_value) > 2048 then
      raise exception 'invalid funnel event metadata' using errcode = '22023';
    end if;

    insert into public.funnel_events (
      session_id, profile_id, event_name, event_key, path, metadata, created_at
    ) values (
      p_session_id,
      caller_id,
      event_name_value,
      event_key_value,
      path_value,
      metadata_value,
      now()
    )
    on conflict (session_id, event_name, event_key) do nothing;
  end loop;
end;
$$;

drop function private.ingest_funnel_events_draft(uuid, jsonb, jsonb);

create or replace function public.ingest_funnel_events(
  p_session_id uuid,
  p_events jsonb,
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  caller_id uuid := auth.uid();
  event_name_value text;
  event_key_value text;
  path_value text;
  metadata_value jsonb;
  context_source text;
begin
  if p_session_id is null
    or jsonb_typeof(p_events) <> 'array'
    or jsonb_array_length(p_events) < 1
    or jsonb_array_length(p_events) > 5
    or pg_column_size(p_events) > 12288
    or jsonb_typeof(coalesce(p_context, '{}'::jsonb)) <> 'object'
    or pg_column_size(coalesce(p_context, '{}'::jsonb)) > 4096
  then
    raise exception 'invalid funnel event batch' using errcode = '22023';
  end if;

  context_source := case
    when p_context->>'source_type' in ('direct', 'utm', 'referral') then p_context->>'source_type'
    else 'direct'
  end;

  insert into public.funnel_sessions (
    session_id, profile_id, source_type, utm_source, utm_medium,
    utm_campaign, referrer_host, landing_path, landing_variant,
    first_seen_at, last_seen_at
  ) values (
    p_session_id, caller_id, context_source,
    left(coalesce(p_context->>'utm_source', ''), 160),
    left(coalesce(p_context->>'utm_medium', ''), 160),
    left(coalesce(p_context->>'utm_campaign', ''), 160),
    left(coalesce(p_context->>'referrer_host', ''), 160),
    left(coalesce(p_context->>'landing_path', ''), 240),
    left(coalesce(p_context->>'landing_variant', ''), 32),
    now(), now()
  )
  on conflict (session_id) do update set
    profile_id = coalesce(public.funnel_sessions.profile_id, caller_id),
    source_type = case when public.funnel_sessions.source_type = 'direct' then excluded.source_type else public.funnel_sessions.source_type end,
    utm_source = case when public.funnel_sessions.utm_source = '' then excluded.utm_source else public.funnel_sessions.utm_source end,
    utm_medium = case when public.funnel_sessions.utm_medium = '' then excluded.utm_medium else public.funnel_sessions.utm_medium end,
    utm_campaign = case when public.funnel_sessions.utm_campaign = '' then excluded.utm_campaign else public.funnel_sessions.utm_campaign end,
    referrer_host = case when public.funnel_sessions.referrer_host = '' then excluded.referrer_host else public.funnel_sessions.referrer_host end,
    landing_path = case when public.funnel_sessions.landing_path = '' then excluded.landing_path else public.funnel_sessions.landing_path end,
    landing_variant = case when public.funnel_sessions.landing_variant = '' then excluded.landing_variant else public.funnel_sessions.landing_variant end,
    last_seen_at = now(), updated_at = now();

  for item in select value from jsonb_array_elements(p_events)
  loop
    event_name_value := item->>'eventName';
    if event_name_value not in ('landing_view', 'onboarding_start', 'ticket_detail_view') then
      raise exception 'browser event is not allowed' using errcode = '22023';
    end if;
    event_key_value := left(coalesce(item->>'eventKey', ''), 160);
    path_value := left(coalesce(item->>'path', ''), 240);
    metadata_value := coalesce(item->'metadata', '{}'::jsonb);
    if jsonb_typeof(metadata_value) <> 'object' or pg_column_size(metadata_value) > 2048 then
      raise exception 'invalid funnel event metadata' using errcode = '22023';
    end if;
    insert into public.funnel_events (
      session_id, profile_id, event_name, event_key, path, metadata
    ) values (
      p_session_id, caller_id, event_name_value, event_key_value, path_value, metadata_value
    ) on conflict (session_id, event_name, event_key) do nothing;
  end loop;
end;
$$;

create or replace function public.link_funnel_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_gender text;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select gender into caller_gender from public.profiles where user_id = caller_id;
  update public.funnel_sessions
  set profile_id = caller_id, gender = caller_gender, last_seen_at = now(), updated_at = now()
  where session_id = p_session_id and (profile_id is null or profile_id = caller_id);
  update public.funnel_events set profile_id = caller_id
  where session_id = p_session_id and profile_id is null;
  update public.funnel_session_facts
  set profile_id = caller_id, gender = caller_gender, updated_at = now()
  where session_id = p_session_id and (profile_id is null or profile_id = caller_id);
end;
$$;

create or replace function public.record_funnel_event(
  p_session_id uuid,
  p_profile_id uuid,
  p_event_name text,
  p_event_key text default '',
  p_path text default '',
  p_metadata jsonb default '{}'::jsonb,
  p_created_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_session_id uuid := p_session_id;
  profile_gender text;
begin
  if p_profile_id is null
    or p_event_name not in ('questions_complete', 'otp_verified', 'application_created')
    or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object'
    or pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 2048
  then
    raise exception 'invalid server funnel event' using errcode = '22023';
  end if;

  if resolved_session_id is null then
    select session_id into resolved_session_id
    from public.funnel_sessions
    where profile_id = p_profile_id
    order by last_seen_at desc
    limit 1;
  end if;
  resolved_session_id := coalesce(resolved_session_id, gen_random_uuid());
  select gender into profile_gender from public.profiles where user_id = p_profile_id;

  insert into public.funnel_sessions(session_id, profile_id, gender, first_seen_at, last_seen_at)
  values (resolved_session_id, p_profile_id, profile_gender, p_created_at, p_created_at)
  on conflict (session_id) do update set
    profile_id = coalesce(public.funnel_sessions.profile_id, excluded.profile_id),
    gender = coalesce(public.funnel_sessions.gender, excluded.gender),
    last_seen_at = greatest(public.funnel_sessions.last_seen_at, excluded.last_seen_at),
    updated_at = now();

  insert into public.funnel_events(session_id, profile_id, event_name, event_key, path, metadata, created_at)
  values (
    resolved_session_id, p_profile_id, p_event_name,
    left(coalesce(p_event_key, ''), 160), left(coalesce(p_path, ''), 240),
    coalesce(p_metadata, '{}'::jsonb), p_created_at
  ) on conflict (session_id, event_name, event_key) do nothing;

  return resolved_session_id;
end;
$$;

create or replace function private.sync_payment_to_funnel_fact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_session_id uuid;
  context_json jsonb;
begin
  if new.status <> 'completed' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'completed' then
    return new;
  end if;

  if new.membership_payment_intent_id is not null then
    select acquisition_context into context_json
    from public.membership_payment_intents
    where id = new.membership_payment_intent_id;
  elsif new.application_group_id is not null then
    select acquisition_context into context_json
    from public.meeting_date_payment_intents
    where application_group_id = new.application_group_id
    order by created_at desc
    limit 1;
  end if;
  resolved_session_id := private.try_uuid(context_json->>'analytics_session_id');
  if resolved_session_id is null and new.user_id is not null then
    select session_id into resolved_session_id
    from public.funnel_sessions
    where profile_id = new.user_id and first_seen_at <= new.occurred_at
    order by last_seen_at desc
    limit 1;
  end if;
  if resolved_session_id is null then
    return new;
  end if;

  insert into public.funnel_session_facts (
    session_id, profile_id, source_type, utm_source, utm_medium,
    utm_campaign, referrer_host, landing_path, landing_variant, gender,
    first_seen_at, payment_completed_at, payment_amount, updated_at
  )
  select
    session.session_id, coalesce(new.user_id, session.profile_id),
    session.source_type, session.utm_source, session.utm_medium,
    session.utm_campaign, session.referrer_host, session.landing_path,
    session.landing_variant, session.gender, session.first_seen_at,
    new.occurred_at, new.amount, now()
  from public.funnel_sessions as session
  where session.session_id = resolved_session_id
  on conflict (session_id) do update set
    profile_id = coalesce(excluded.profile_id, public.funnel_session_facts.profile_id),
    payment_completed_at = coalesce(public.funnel_session_facts.payment_completed_at, excluded.payment_completed_at),
    payment_amount = public.funnel_session_facts.payment_amount + excluded.payment_amount,
    updated_at = now();
  return new;
end;
$$;

create trigger payment_transactions_sync_funnel_fact
after insert or update of status on public.payment_transactions
for each row execute function private.sync_payment_to_funnel_fact();

create or replace function private.refresh_funnel_hourly_metrics()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.funnel_hourly_metrics
  where bucket_at >= date_trunc('hour', now() - interval '90 days');

  insert into public.funnel_hourly_metrics (
    bucket_at, source_kind, landing_variant, gender,
    landing_users, onboarding_users, questions_complete_users,
    otp_verified_users, ticket_detail_users, application_users,
    payment_users, payment_revenue, refreshed_at
  )
  select
    date_trunc('hour', first_seen_at),
    private.funnel_source_kind(source_type, utm_source, utm_medium, referrer_host),
    coalesce(landing_variant, ''),
    coalesce(gender, ''),
    count(*) filter (where landing_view_at is not null),
    count(*) filter (where onboarding_start_at is not null),
    count(*) filter (where questions_complete_at is not null),
    count(*) filter (where otp_verified_at is not null),
    count(*) filter (where ticket_detail_view_at is not null),
    count(*) filter (where application_created_at is not null),
    count(*) filter (where payment_completed_at is not null),
    coalesce(sum(payment_amount), 0),
    now()
  from public.funnel_session_facts
  where first_seen_at >= date_trunc('hour', now() - interval '90 days')
  group by 1, 2, 3, 4;
end;
$$;

create or replace function private.prune_funnel_event_raw_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.funnel_events where created_at < now() - interval '90 days';
$$;

create or replace function public.admin_funnel_summary(
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_basis text default 'acquisition',
  p_source text default 'all'
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with source_rows as (
    select facts.*,
      private.funnel_source_kind(source_type, utm_source, utm_medium, referrer_host) as source_kind
    from public.funnel_session_facts facts
    where p_source = 'all'
      or private.funnel_source_kind(source_type, utm_source, utm_medium, referrer_host) = p_source
  ), scoped as (
    select * from source_rows
    where (
      p_basis = 'acquisition'
      and first_seen_at >= p_started_at and first_seen_at < p_ended_at
    ) or (
      p_basis = 'event' and (
        landing_view_at >= p_started_at and landing_view_at < p_ended_at
        or onboarding_start_at >= p_started_at and onboarding_start_at < p_ended_at
        or questions_complete_at >= p_started_at and questions_complete_at < p_ended_at
        or otp_verified_at >= p_started_at and otp_verified_at < p_ended_at
        or ticket_detail_view_at >= p_started_at and ticket_detail_view_at < p_ended_at
        or application_created_at >= p_started_at and application_created_at < p_ended_at
        or payment_completed_at >= p_started_at and payment_completed_at < p_ended_at
      )
    )
  ), stages(stage_key, stage_order, stage_at_column) as (
    values
      ('landing_view', 1, 'landing_view_at'),
      ('onboarding_start', 2, 'onboarding_start_at'),
      ('questions_complete', 3, 'questions_complete_at'),
      ('otp_verified', 4, 'otp_verified_at'),
      ('ticket_detail_view', 5, 'ticket_detail_view_at'),
      ('application_created', 6, 'application_created_at'),
      ('payment_completed', 7, 'payment_completed_at')
  ), stage_counts as (
    select stage_key, stage_order,
      case stage_key
        when 'landing_view' then count(*) filter (where landing_view_at is not null and (p_basis = 'acquisition' or landing_view_at >= p_started_at and landing_view_at < p_ended_at))
        when 'onboarding_start' then count(*) filter (where onboarding_start_at is not null and (p_basis = 'acquisition' or onboarding_start_at >= p_started_at and onboarding_start_at < p_ended_at))
        when 'questions_complete' then count(*) filter (where questions_complete_at is not null and (p_basis = 'acquisition' or questions_complete_at >= p_started_at and questions_complete_at < p_ended_at))
        when 'otp_verified' then count(*) filter (where otp_verified_at is not null and (p_basis = 'acquisition' or otp_verified_at >= p_started_at and otp_verified_at < p_ended_at))
        when 'ticket_detail_view' then count(*) filter (where ticket_detail_view_at is not null and (p_basis = 'acquisition' or ticket_detail_view_at >= p_started_at and ticket_detail_view_at < p_ended_at))
        when 'application_created' then count(*) filter (where application_created_at is not null and (p_basis = 'acquisition' or application_created_at >= p_started_at and application_created_at < p_ended_at))
        when 'payment_completed' then count(*) filter (where payment_completed_at is not null and (p_basis = 'acquisition' or payment_completed_at >= p_started_at and payment_completed_at < p_ended_at))
      end::integer as user_count
    from stages cross join scoped
    group by stage_key, stage_order
  ), daily_events as (
    select
      case when p_basis = 'acquisition' then (first_seen_at at time zone 'Asia/Seoul')::date
        else (event_at at time zone 'Asia/Seoul')::date end as event_date,
      stage_key,
      count(distinct session_id)::integer as user_count
    from scoped
    cross join lateral (values
      ('landing_view', landing_view_at),
      ('onboarding_start', onboarding_start_at),
      ('questions_complete', questions_complete_at),
      ('otp_verified', otp_verified_at),
      ('ticket_detail_view', ticket_detail_view_at),
      ('application_created', application_created_at),
      ('payment_completed', payment_completed_at)
    ) as event_rows(stage_key, event_at)
    where event_at is not null
      and (p_basis = 'acquisition' or (event_at >= p_started_at and event_at < p_ended_at))
    group by 1, 2
  ), daily as (
    select event_date,
      jsonb_object_agg(stage_key, user_count order by stage_key) as stages
    from daily_events group by event_date
  )
  select jsonb_build_object(
    'rowsScanned', (select count(*) from scoped),
    'stageCounts', coalesce((select jsonb_agg(jsonb_build_object(
      'stage_key', stage_key, 'stage_order', stage_order, 'user_count', user_count
    ) order by stage_order) from stage_counts), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
      'date', event_date, 'stages', stages
    ) order by event_date) from daily), '[]'::jsonb)
  );
$$;

revoke all on function public.ingest_funnel_events(uuid, jsonb, jsonb) from public;
revoke all on function public.link_funnel_session(uuid) from public;
revoke all on function public.record_funnel_event(uuid, uuid, text, text, text, jsonb, timestamptz) from public;
revoke all on function public.admin_funnel_summary(timestamptz, timestamptz, text, text) from public;
grant execute on function public.ingest_funnel_events(uuid, jsonb, jsonb) to anon, authenticated;
grant execute on function public.link_funnel_session(uuid) to authenticated;
grant execute on function public.record_funnel_event(uuid, uuid, text, text, text, jsonb, timestamptz) to service_role;
grant execute on function public.admin_funnel_summary(timestamptz, timestamptz, text, text) to service_role;

create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname = 'refresh-funnel-hourly-metrics';
select cron.unschedule(jobid) from cron.job where jobname = 'prune-funnel-event-raw-data';
select cron.schedule(
  'refresh-funnel-hourly-metrics',
  '*/5 * * * *',
  'select private.refresh_funnel_hourly_metrics()'
);
select cron.schedule(
  'prune-funnel-event-raw-data',
  '17 3 * * *',
  'select private.prune_funnel_event_raw_data()'
);

select private.refresh_funnel_hourly_metrics();
