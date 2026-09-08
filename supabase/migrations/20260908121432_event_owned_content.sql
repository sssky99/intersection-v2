-- Each event owns its compatibility template. Public waiting tickets use the
-- event snapshot; assigned tickets continue using their existing instance IDs.
create function public.copy_event_content(p_source uuid, p_title text, p_snapshot jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare t public.ticket_templates%rowtype; target uuid;
begin
  select * into t from public.ticket_templates where id = p_source;
  if found then
    t.id := gen_random_uuid(); t.title := p_title;
    t.visibility := 'draft'; t.template_kind := 'experience';
    t.created_at := now(); t.updated_at := now();
    insert into public.ticket_templates select t.* returning id into target;
  else
    insert into public.ticket_templates(title,template_kind,visibility)
    values(p_title,'experience','draft') returning id into target;
  end if;
  update public.ticket_templates set
    course_steps = coalesce(p_snapshot->'courseSteps',course_steps),
    stage_copy = coalesce(p_snapshot->'stageCopy',stage_copy)
  where id = target;
  return target;
end;
$$;
revoke all on function public.copy_event_content(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.copy_event_content(uuid,text,jsonb) to service_role;

do $$
declare e record; target uuid; snapshot jsonb;
begin
  for e in select ev.*,t.course_steps,t.stage_copy from public.meeting_events ev
    join public.ticket_templates t on t.id=ev.program_id order by ev.id loop
    snapshot := jsonb_build_object('courseSteps',e.course_steps,'stageCopy',e.stage_copy) || coalesce(e.detail_snapshot,'{}'::jsonb);
    -- Missing stage copy must be preserved for already-issued tickets.
    if snapshot->'stageCopy' is null or snapshot->'stageCopy' = 'null'::jsonb then
      snapshot := jsonb_set(snapshot,'{stageCopy}',e.stage_copy);
    end if;
    target := public.copy_event_content(e.program_id,e.title,snapshot);
    update public.meeting_events set program_id=target,detail_snapshot=snapshot where id=e.id;
    update public.ticket_instances i set template_id=target
      from public.meeting_groups g where g.event_id=e.id and g.legacy_ticket_instance_id=i.id;
    update public.ticket_participations p set ticket_template_id=target
      from public.meeting_groups g where g.event_id=e.id and g.legacy_ticket_instance_id=p.ticket_instance_id;
  end loop;
end;
$$;

create function public.sync_event_owned_content()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.program_id := public.copy_event_content(new.program_id,new.title,new.detail_snapshot);
  else
    update public.ticket_templates set title=new.title,short_description=new.short_description,
      course_steps=coalesce(new.detail_snapshot->'courseSteps',course_steps),
      stage_copy=coalesce(new.detail_snapshot->'stageCopy',stage_copy),updated_at=now()
    where id=new.program_id;
    if new.detail_snapshot->'stageCopy' is distinct from old.detail_snapshot->'stageCopy' then
      update public.ticket_participations set ticket_snapshot=jsonb_set(ticket_snapshot,'{stageCopy}',coalesce(new.detail_snapshot->'stageCopy','{}'::jsonb))
      where ticket_template_id=new.program_id and ticket_snapshot is not null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_event_owned_content() from public,anon,authenticated;
grant execute on function public.sync_event_owned_content() to service_role;
create trigger event_owned_content before insert or update of title,short_description,detail_snapshot
on public.meeting_events for each row execute function public.sync_event_owned_content();

-- Create content, event and stages atomically, including compatibility data.
create function public.create_standalone_meeting_event(p_title text,p_date date,p_time time,p_region text,p_snapshot jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare event_id uuid; step jsonb; n integer := 0;
begin
  if nullif(btrim(p_title),'') is null or p_date is null or p_time is null
    or jsonb_typeof(p_snapshot->'courseSteps') is distinct from 'array'
    or jsonb_array_length(p_snapshot->'courseSteps') not between 2 and 3 then
    raise exception '행사 제목, 날짜, 시간과 기본 여정을 확인해주세요.';
  end if;
  insert into public.meeting_events(title,event_date,starts_at,region,visibility,detail_snapshot)
    values(p_title,p_date,p_time,coalesce(nullif(p_region,''),'서울'),'draft',p_snapshot) returning id into event_id;
  for step in select value from jsonb_array_elements(p_snapshot->'courseSteps') loop
    n := n+1;
    insert into public.meeting_event_stages(event_id,title,stage_type,sequence,starts_at,location_mode)
      values(event_id,step->>'title',case when n=1 then 'meal' else 'activity' end,n,
        p_time + make_interval(mins=>coalesce((step->>'openOffsetMinutes')::int,(n-1)*90)),
        case when n=1 then 'group_specific' else 'shared' end);
  end loop;
  insert into public.meeting_event_stages(event_id,title,stage_type,sequence,starts_at,location_mode)
    values(event_id,'피드백','feedback',n+1,p_time+interval '180 minutes','hidden');
  return event_id;
end;
$$;
revoke all on function public.create_standalone_meeting_event(text,date,time,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_standalone_meeting_event(text,date,time,text,jsonb) to service_role;

create function public.update_event_stage_copy(p_event_id uuid,p_copy jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.meeting_events set detail_snapshot=jsonb_set(coalesce(detail_snapshot,'{}'::jsonb),'{stageCopy}',p_copy),updated_at=now()
  where id=p_event_id;
  if not found then raise exception '행사를 찾을 수 없습니다.'; end if;
end;
$$;
revoke all on function public.update_event_stage_copy(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.update_event_stage_copy(uuid,jsonb) to service_role;
