-- Feedback is validated by the server. Browser writes must not bypass it.
revoke insert, update on public.meeting_feedback from public, anon, authenticated;
drop policy if exists "Users can insert own meeting feedback" on public.meeting_feedback;
drop policy if exists "Users can update own meeting feedback" on public.meeting_feedback;

create or replace function public.save_validated_meeting_feedback(
  p_participation_id bigint, p_user_id uuid, p_instance_id uuid,
  p_template_id uuid, p_snapshot jsonb, p_selected_member_ids uuid[],
  p_member_feedback jsonb, p_place_feedback jsonb
)
returns timestamptz
language plpgsql security invoker set search_path = ''
as $$
declare
  participation public.ticket_participations%rowtype;
  completed_at timestamptz := now();
begin
  select * into participation from public.ticket_participations
  where id = p_participation_id and user_id = p_user_id for update;
  if not found then raise exception 'Participation not found'; end if;
  if participation.status = 'feedback_done' and exists (
    select 1 from public.meeting_feedback where waitlist_id = p_participation_id
  ) then
    return participation.feedback_completed_at;
  end if;
  if participation.status <> 'approved' then
    raise exception 'Participation is not approved';
  end if;
  insert into public.meeting_feedback (
    waitlist_id, user_id, ticket_instance_id, ticket_template_id, ticket_snapshot,
    selected_member_ids, member_feedback, place_feedback, updated_at
  ) values (
    p_participation_id, p_user_id, p_instance_id, p_template_id, p_snapshot,
    p_selected_member_ids, p_member_feedback, p_place_feedback, completed_at
  ) on conflict (waitlist_id) do update set
    selected_member_ids = excluded.selected_member_ids,
    member_feedback = excluded.member_feedback,
    place_feedback = excluded.place_feedback,
    updated_at = excluded.updated_at;
  update public.ticket_participations set status = 'feedback_done',
    feedback_completed_at = completed_at, updated_at = completed_at
  where id = p_participation_id;
  return completed_at;
end;
$$;
revoke all on function public.save_validated_meeting_feedback(bigint,uuid,uuid,uuid,jsonb,uuid[],jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_validated_meeting_feedback(bigint,uuid,uuid,uuid,jsonb,uuid[],jsonb,jsonb) to service_role;

-- Lock the specific application and preserve an already confirmed participation.
create or replace function public.ensure_application_participation(
  p_application_id bigint, p_user_id uuid, p_ticket_instance_id uuid, p_snapshot jsonb
)
returns bigint
language plpgsql security invoker set search_path = ''
as $$
declare
  application public.meeting_date_applications%rowtype;
  participation public.ticket_participations%rowtype;
  participation_id bigint;
begin
  select * into application from public.meeting_date_applications
  where id = p_application_id and user_id = p_user_id for update;
  if not found then raise exception 'Application not found'; end if;
  if application.status <> 'waitlisted' then
    return application.ticket_participation_id;
  end if;
  if application.assigned_ticket_instance_id is distinct from p_ticket_instance_id then
    raise exception 'Application ticket mismatch';
  end if;
  -- Same lock order as set_ticket_participation_status.
  perform 1 from public.ticket_instances where id = p_ticket_instance_id for update;
  select * into participation from public.ticket_participations
  where user_id = p_user_id and ticket_instance_id = p_ticket_instance_id for update;
  if found and participation.status not in ('payment_pending', 'cancelled', 'not_selected') then
    participation_id := participation.id;
  else
    participation_id := public.set_ticket_participation_status(
      p_ticket_instance_id, p_user_id, 'waitlisted', p_snapshot, null
    );
  end if;
  update public.meeting_date_applications
  set ticket_participation_id = participation_id, updated_at = now()
  where id = p_application_id;
  return participation_id;
end;
$$;
revoke all on function public.ensure_application_participation(bigint,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.ensure_application_participation(bigint,uuid,uuid,jsonb) to service_role;
