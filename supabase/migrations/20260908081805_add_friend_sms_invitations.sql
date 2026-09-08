create table public.friend_sms_invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  application_id bigint not null unique references public.meeting_date_applications(id) on delete cascade,
  event_id uuid not null references public.meeting_events(id) on delete cascade,
  friend_phone text not null check (friend_phone ~ '^010[0-9]{8}$'),
  status text not null default 'sending' check (status in ('sending','submitted','sent','failed','unknown')),
  message_id text unique,
  group_id text,
  provider_status text,
  consent_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index friend_sms_invitations_owner_created on public.friend_sms_invitations(inviter_id, created_at);
alter table public.friend_sms_invitations enable row level security;
revoke all on public.friend_sms_invitations from public, anon, authenticated;
grant select, insert, update, delete on public.friend_sms_invitations to service_role;

create function public.reserve_friend_sms_invitation(p_user_id uuid, p_application_id bigint, p_phone text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_application public.meeting_date_applications; v_invitation public.friend_sms_invitations;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 8921));
  select * into v_application from public.meeting_date_applications
    where id=p_application_id and user_id=p_user_id and event_id is not null
    and status in ('payment_pending','waitlisted','on_hold','approved')
    and meeting_date >= (now() at time zone 'Asia/Seoul')::date;
  if not found then raise exception 'invalid-application'; end if;
  select * into v_invitation from public.friend_sms_invitations where application_id=p_application_id;
  if found then
    if v_invitation.friend_phone <> p_phone then raise exception 'friend-already-selected'; end if;
    return jsonb_build_object('created',false,'invitation',to_jsonb(v_invitation));
  end if;
  if (select count(*) from public.friend_sms_invitations where inviter_id=p_user_id and created_at > now()-interval '24 hours') >= 3
    then raise exception 'invite-limit'; end if;
  insert into public.friend_sms_invitations(inviter_id,application_id,event_id,friend_phone)
    values(p_user_id,p_application_id,v_application.event_id,p_phone) returning * into v_invitation;
  return jsonb_build_object('created',true,'invitation',to_jsonb(v_invitation));
end $$;
revoke all on function public.reserve_friend_sms_invitation(uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.reserve_friend_sms_invitation(uuid,bigint,text) to service_role;
