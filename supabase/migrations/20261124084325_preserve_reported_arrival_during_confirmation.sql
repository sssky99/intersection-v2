-- An admin can confirm a member-reported arrival without replacing its detail.

create or replace function public.record_admin_meeting_arrival(
  p_participation_id bigint, p_room_id uuid, p_arrival_status text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  participant public.ticket_participations%rowtype;
  member_id uuid;
  meeting_day date;
  meeting_start timestamptz;
  profile public.profiles%rowtype;
  current_effect public.membership_payment_effects%rowtype;
  initial_effect public.membership_payment_effects%rowtype;
  recorded_at timestamptz := now();
  result jsonb;
  first_attendance jsonb;
  additional_days integer;
  new_end date;
begin
  if p_arrival_status not in ('on_time','late_10','no_show') then
    raise exception 'Unsupported arrival status';
  end if;

  select participation.user_id, room.event_date,
    (room.event_date + room.event_time) at time zone 'Asia/Seoul'
  into member_id, meeting_day, meeting_start
  from public.ticket_participations participation
  join public.ticket_instances room on room.id=participation.ticket_instance_id
  where participation.id=p_participation_id and room.id=p_room_id;
  if not found then return null; end if;

  -- Payments and refunds serialize membership changes on this same profile row.
  if p_arrival_status in ('on_time','late_10') and meeting_start <= recorded_at then
    select * into profile from public.profiles
    where user_id=member_id and archived_at is null for update;
  end if;
  update public.ticket_participations
  set arrival_status=case
        when p_arrival_status='late_10' and arrival_status in ('late_20','late_30_plus') then arrival_status
        else p_arrival_status end,
      arrival_status_updated_at=case
        when p_arrival_status is null then null
        when arrival_status=p_arrival_status
          or (p_arrival_status='late_10' and arrival_status in ('late_20','late_30_plus'))
          then coalesce(arrival_status_updated_at,recorded_at)
        else recorded_at end,
      updated_at=recorded_at
  where id=p_participation_id and ticket_instance_id=p_room_id and user_id=member_id
  returning * into participant;
  if not found then return null; end if;

  result := jsonb_build_object('participationId', participant.id::text,
    'arrivalStatus', participant.arrival_status,
    'arrivalStatusUpdatedAt', participant.arrival_status_updated_at);
  if profile.user_id is null or profile.membership_status is distinct from 'active'
    or profile.membership_plan is distinct from 'one_month'
    or participant.status not in ('approved','completed','feedback_done')
    or not coalesce(meeting_day between profile.membership_start_date and profile.membership_end_date, false) then
    return result;
  end if;

  select e.* into current_effect
  from public.membership_payment_effects e
  join public.payment_transactions t on t.id=e.transaction_id and t.user_id=e.user_id
  where e.user_id=member_id and e.is_current and e.cancelled_at is null
    and t.provider='groble' and t.status='completed'
    and (e.after_state->>'start_date')::date=profile.membership_start_date
    and (e.after_state->>'end_date')::date=profile.membership_end_date
    and (e.after_state->>'updated_at')::timestamptz=profile.membership_updated_at
    and e.after_state->>'status'=profile.membership_status
    and e.after_state->>'plan'=profile.membership_plan;
  if not found then return result; end if;

  select e.* into initial_effect
  from public.membership_payment_effects e
  join public.payment_transactions t on t.id=e.transaction_id and t.user_id=e.user_id
  where e.user_id=member_id and e.cancelled_at is null
    and t.provider='groble' and t.status='completed' and t.product_code='membership:one_month'
    and t.payment_kind in ('membership_initial','membership_upgrade')
    and e.after_state ? 'first_attendance'
    and (e.after_state->>'start_date')::date=profile.membership_start_date
    and t.occurred_at <= profile.membership_updated_at
  order by t.occurred_at desc, t.id desc limit 1;
  if not found then return result; end if;
  if exists (
    select 1 from public.groble_webhook_events w
    where w.merchant_uid in (initial_effect.merchant_uid, current_effect.merchant_uid)
      and w.event_type in ('subscription_payment.cancelled','subscription_payment.refunded')
  ) then return result; end if;
  if initial_effect.after_state #>> '{first_attendance,pending}' is distinct from 'true' then
    if initial_effect.after_state #>> '{first_attendance,participation_id}' = participant.id::text then
      return result || jsonb_build_object('membershipEndsOn', profile.membership_end_date);
    end if;
    return result;
  end if;

  -- Move the initial month's end by the difference in calendar dates. Preserve
  -- the days already added by any separate renewal of the same paid period.
  additional_days := greatest(0,
    (meeting_day + interval '1 month')::date - 1 - (initial_effect.after_state->>'end_date')::date);
  new_end := profile.membership_end_date + additional_days;
  first_attendance := jsonb_build_object('participation_id', participant.id::text,
    'date', meeting_day, 'confirmed_at', recorded_at, 'added_days', additional_days);

  update public.membership_payment_effects
  set after_state=jsonb_set(after_state, '{first_attendance}', first_attendance, false)
  where transaction_id=initial_effect.transaction_id;
  if additional_days > 0 then
    update public.profiles set membership_end_date=new_end where user_id=member_id;
    update public.membership_payment_effects
    set after_state=jsonb_set(after_state, '{end_date}', to_jsonb(new_end), false)
    where transaction_id=current_effect.transaction_id;
  end if;
  return result || jsonb_build_object('membershipEndsOn', new_end);
end;
$$;
revoke all on function public.record_admin_meeting_arrival(bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.record_admin_meeting_arrival(bigint,uuid,text) to service_role;
