-- Private board state. No member can inspect somebody else's additions/removals.
create table public.friend_boards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slots jsonb not null default '[null,null,null,null,null,null,null,null,null]'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(slots) = 'array' and jsonb_array_length(slots) = 9)
);

-- Explicit historical seating, including second-stage reshuffles. These rows
-- must come from confirmed operational assignments, never from a client claim.
create table public.meeting_friend_encounters (
  event_id uuid not null references public.meeting_events(id) on delete cascade,
  stage_sequence integer not null check (stage_sequence in (1,2)),
  group_key text not null check (length(group_key) between 1 and 80),
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (event_id,stage_sequence,user_id)
);
create index meeting_friend_encounters_user on public.meeting_friend_encounters(user_id,event_id);
create index meeting_friend_encounters_group on public.meeting_friend_encounters(event_id,stage_sequence,group_key);
alter table public.friend_boards enable row level security;
alter table public.meeting_friend_encounters enable row level security;
revoke all on public.friend_boards, public.meeting_friend_encounters from public,anon,authenticated;
grant select,insert,update,delete on public.friend_boards, public.meeting_friend_encounters to service_role;

-- p_recent=false is used only to retain previously saved friends, not to allow
-- adding expired candidates. Calendar months and midnight use Korean time.
create function public.friend_candidates(p_user_id uuid, p_recent boolean default true)
returns table(user_id uuid, name text, photo_url text, last_met_date date)
language sql stable security invoker set search_path = '' as $$
  with valid as (
    select p.user_id, p.ticket_instance_id, i.event_date
    from public.ticket_participations p
    join public.ticket_instances i on i.id=p.ticket_instance_id
    where p.status in ('approved','completed','feedback_done')
      and p.arrival_status is distinct from 'no_show'
      and i.visibility in ('public','closed')
      and i.event_date < (now() at time zone 'Asia/Seoul')::date
      and (not p_recent or i.event_date >= ((now() at time zone 'Asia/Seoul')::date - interval '2 months')::date)
  ), together as (
    select other.user_id, own.event_date
    from valid own join valid other on own.ticket_instance_id=other.ticket_instance_id
    where own.user_id=p_user_id
    union all
    select other.user_id,e.event_date
    from public.meeting_friend_encounters own
    join public.meeting_friend_encounters other on other.event_id=own.event_id
      and other.stage_sequence=own.stage_sequence and other.group_key=own.group_key
    join public.meeting_events e on e.id=own.event_id
    where own.user_id=p_user_id and e.visibility in ('public','closed')
      and e.event_date < (now() at time zone 'Asia/Seoul')::date
      and (not p_recent or e.event_date >= ((now() at time zone 'Asia/Seoul')::date - interval '2 months')::date)
      and exists (select 1 from valid v join public.meeting_groups g on g.legacy_ticket_instance_id=v.ticket_instance_id where g.event_id=e.id and v.user_id=own.user_id)
      and exists (select 1 from valid v join public.meeting_groups g on g.legacy_ticket_instance_id=v.ticket_instance_id where g.event_id=e.id and v.user_id=other.user_id)
  )
  select p.user_id,p.name,p.photo_url,max(t.event_date)
  from together t join public.profiles p on p.user_id=t.user_id
  join public.profiles self on self.user_id=p_user_id
  where p.user_id<>p_user_id and p.archived_at is null and self.archived_at is null
    and p.gender=self.gender and self.gender in ('남성','여성','male','female')
  group by p.user_id,p.name,p.photo_url
  order by max(t.event_date) desc,p.name,p.user_id;
$$;
revoke all on function public.friend_candidates(uuid,boolean) from public,anon,authenticated;
grant execute on function public.friend_candidates(uuid,boolean) to service_role;

create function public.save_friend_board(p_user_id uuid, p_slots jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare old_slots jsonb; item jsonb; ids uuid[] := '{}'; friend_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,8922));
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots)<>9 then raise exception 'invalid-board'; end if;
  select slots into old_slots from public.friend_boards where user_id=p_user_id;
  for item in select value from jsonb_array_elements(p_slots) loop
    if item='null'::jsonb then continue; end if;
    if jsonb_typeof(item)<>'object' or item->>'id' is null
      or jsonb_typeof(item->'x') is distinct from 'number' or jsonb_typeof(item->'y') is distinct from 'number'
      or (item->>'x')::numeric not between 0 and 100 or (item->>'y')::numeric not between 0 and 100
      then raise exception 'invalid-slot'; end if;
    friend_id := (item->>'id')::uuid;
    if friend_id=any(ids) then raise exception 'duplicate-friend'; end if;
    ids := array_append(ids,friend_id);
    if not exists(select 1 from public.friend_candidates(p_user_id,true) c where c.user_id=friend_id)
      and not (exists(select 1 from jsonb_array_elements(coalesce(old_slots,'[]')) s where s->>'id'=friend_id::text)
        and exists(select 1 from public.friend_candidates(p_user_id,false) c where c.user_id=friend_id))
      then raise exception 'ineligible-friend'; end if;
  end loop;
  insert into public.friend_boards(user_id,slots) values(p_user_id,p_slots)
  on conflict(user_id) do update set slots=excluded.slots,updated_at=now();
end $$;
revoke all on function public.save_friend_board(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_friend_board(uuid,jsonb) to service_role;

create function public.save_second_stage_groups(p_event_id uuid,p_members jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare item jsonb; ids uuid[] := '{}'; member_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text,8923));
  if not exists(select 1 from public.meeting_events where id=p_event_id) then raise exception 'invalid-event'; end if;
  if jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members)>500 then raise exception 'invalid-members'; end if;
  for item in select value from jsonb_array_elements(p_members) loop
    member_id := (item->>'userId')::uuid;
    if member_id is null or member_id=any(ids) or coalesce(length(trim(item->>'group')),0) not between 1 and 80
      then raise exception 'invalid-member'; end if;
    ids := array_append(ids,member_id);
    if not exists(select 1 from public.ticket_participations p join public.meeting_groups g on g.legacy_ticket_instance_id=p.ticket_instance_id
      where g.event_id=p_event_id and p.user_id=member_id and p.status in ('approved','completed','feedback_done') and p.arrival_status is distinct from 'no_show')
      then raise exception 'not-event-participant'; end if;
  end loop;
  delete from public.meeting_friend_encounters where event_id=p_event_id and stage_sequence=2;
  insert into public.meeting_friend_encounters(event_id,stage_sequence,group_key,user_id)
    select p_event_id,2,trim(value->>'group'),(value->>'userId')::uuid from jsonb_array_elements(p_members);
end $$;
revoke all on function public.save_second_stage_groups(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_second_stage_groups(uuid,jsonb) to service_role;
