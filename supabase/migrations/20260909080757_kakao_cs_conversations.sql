create table public.kakao_cs_conversations (
  session_key text primary key,
  messages jsonb not null default '[]'::jsonb,
  paused boolean not null default false,
  lease_token uuid,
  lease_until timestamptz,
  request_keys jsonb not null default '[]'::jsonb,
  request_day date not null default current_date,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(messages) = 'array' and jsonb_array_length(messages) <= 12)
);
alter table public.kakao_cs_conversations enable row level security;
revoke all on public.kakao_cs_conversations from public, anon, authenticated;
grant select, insert, update, delete on public.kakao_cs_conversations to service_role;

create function public.claim_kakao_cs_conversation(p_session text, p_request text, p_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v public.kakao_cs_conversations; d date := (now() at time zone 'Asia/Seoul')::date;
begin
  insert into public.kakao_cs_conversations(session_key) values (p_session) on conflict do nothing;
  select * into v from public.kakao_cs_conversations where session_key = p_session for update;
  if v.paused then return jsonb_build_object('status','paused'); end if;
  if v.request_keys ? p_request then return jsonb_build_object('status','duplicate'); end if;
  if v.lease_until > now() then return jsonb_build_object('status','busy'); end if;
  if v.request_day = d and v.request_count >= 30 then return jsonb_build_object('status','limited'); end if;
  -- Short memory only; do not re-use a conversation older than a day.
  if v.updated_at < now() - interval '1 day' then v.messages := '[]'::jsonb; end if;
  update public.kakao_cs_conversations set
    messages = v.messages, lease_token = p_token, lease_until = now() + interval '90 seconds',
    request_day = d, request_count = case when v.request_day = d then v.request_count + 1 else 1 end,
    request_keys = case when v.request_day = d then v.request_keys else '[]'::jsonb end || jsonb_build_array(p_request),
    updated_at = now()
  where session_key = p_session;
  return jsonb_build_object('status','claimed','messages',v.messages);
end;
$$;
revoke all on function public.claim_kakao_cs_conversation(text,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_kakao_cs_conversation(text,text,uuid) to service_role;
