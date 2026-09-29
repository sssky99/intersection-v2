-- Operational group tickets remain draft even after a public event is confirmed.
create or replace function public.friend_candidates(p_user_id uuid, p_recent boolean default true)
returns table(user_id uuid, name text, photo_url text, last_met_date date)
language sql stable security invoker set search_path = '' as $$
  with valid as (
    select p.user_id, p.ticket_instance_id, i.event_date
    from public.ticket_participations p
    join public.ticket_instances i on i.id=p.ticket_instance_id
    where p.status in ('approved','completed','feedback_done')
      and p.arrival_status is distinct from 'no_show'
      and (exists (select 1 from public.meeting_groups g join public.meeting_events e on e.id=g.event_id where g.legacy_ticket_instance_id=i.id and g.status='confirmed' and e.visibility in ('public','closed'))
        or (i.visibility in ('public','closed') and not exists(select 1 from public.meeting_groups g where g.legacy_ticket_instance_id=i.id)))
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
