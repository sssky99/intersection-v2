-- Enroll new monthly membership periods in the once-only first meeting benefit.

create or replace function public.apply_membership_payment(
  p_user_id uuid, p_intent_id bigint, p_event_id text, p_merchant_uid text,
  p_amount integer, p_paid_at timestamptz, p_buyer_name text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  profile public.profiles%rowtype;
  intent public.membership_payment_intents%rowtype;
  txn public.payment_transactions%rowtype;
  source_intent_id bigint;
  renewal_plan text;
  receipt public.membership_payment_effects%rowtype;
  app public.meeting_date_applications%rowtype;
  interaction public.ticket_user_interactions%rowtype;
  linked_id bigint; candidates bigint[]; transaction_ids bigint[];
  kind text; months integer; was_active boolean; start_date date; end_date date;
  paid_date date; today date := (now() at time zone 'Asia/Seoul')::date;
  before_state jsonb; after_state jsonb;
begin
  if p_user_id is null or p_intent_id is null or nullif(btrim(p_event_id),'') is null
     or p_amount is null or p_amount < 0 or p_paid_at is null then
    raise exception 'Invalid membership payment';
  end if;
  -- Same lock order for completion and cancellation; covers distinct events for one charge.
  perform pg_advisory_xact_lock(hashtextextended('membership:' || coalesce(p_merchant_uid,p_event_id),0));
  select * into profile from public.profiles where user_id=p_user_id for update;
  if not found then raise exception 'Membership profile not found'; end if;
  select * into intent from public.membership_payment_intents where id=p_intent_id and user_id=p_user_id for update;
  if not found then raise exception 'Membership intent not found'; end if;
  if intent.expected_amount <> p_amount and not (intent.credit_amount>0 and intent.expected_amount-intent.credit_amount=p_amount) then raise exception 'Membership amount does not match intent'; end if;
  months := case intent.plan when 'one_month' then 1 when 'three_months' then 3 when 'six_months' then 6 end;
  if months is null then raise exception 'Invalid membership plan'; end if;

  select array_agg(id) into transaction_ids from public.payment_transactions where provider='groble'
    and (provider_event_id=p_event_id
      or (p_merchant_uid is not null and merchant_uid=p_merchant_uid));
  if cardinality(transaction_ids)>1 then raise exception 'Ambiguous membership transaction requires review'; end if;
  if cardinality(transaction_ids)=1 then
    select * into txn from public.payment_transactions where id=transaction_ids[1] for update;
    if txn.user_id is distinct from p_user_id or (txn.membership_payment_intent_id is distinct from p_intent_id and not exists(
         select 1 from public.membership_payment_intents i where i.id=txn.membership_payment_intent_id
           and i.user_id=p_user_id and i.renewal_source_intent_id=p_intent_id))
       or txn.amount <> p_amount or txn.payment_kind not in ('membership_initial','membership_upgrade','membership_renewal')
       or (txn.merchant_uid is not null and p_merchant_uid is distinct from txn.merchant_uid) then
      raise exception 'Membership payment identity conflict';
    end if;
    if txn.status in ('cancelled','refunded') then
      return jsonb_build_object('outcome','cancelled','payment_kind',txn.payment_kind,'transaction_id',txn.id,'intent_id',txn.membership_payment_intent_id);
    end if;
    select * into receipt from public.membership_payment_effects where transaction_id=txn.id;
    if found then
      return jsonb_build_object('outcome','already_applied','payment_kind',txn.payment_kind,'transaction_id',txn.id,'intent_id',txn.membership_payment_intent_id);
    end if;
    -- Do not guess how far a pre-migration delivery progressed. A confirmed old
    -- profile may have been renewed or manually edited since that delivery.
    if intent.status='completed' and profile.membership_updated_at >= txn.occurred_at then
      raise exception 'Legacy membership payment has no application receipt; review required';
    end if;
  end if;
  -- Reused subscription reference, distinct charge. Charge the full renewal price
  -- even if the first checkout used a credit.
  if txn.id is null and exists(select 1 from public.payment_transactions where membership_payment_intent_id=p_intent_id) then
    if nullif(btrim(p_merchant_uid),'') is null or intent.status <> 'completed'
       or intent.plan <> 'one_month' then
      raise exception 'Membership payment identity conflict; recurring charge requires review';
    end if;
    if intent.credit_amount>0 and (p_amount<>intent.expected_amount or not exists (
      select 1 from public.groble_webhook_events ev
      where ev.event_id=p_event_id and ev.merchant_uid=p_merchant_uid
        and (ev.payload #>> '{data,object,payment,purchasedAt}')::timestamptz=p_paid_at
        and exists (
          select 1 from public.match_groble_renewal_intent(ev.event_id) matched
          where matched.intent_id=intent.id and matched.user_id=p_user_id
        )
    )) then
      raise exception 'Membership payment identity conflict; credited renewal requires review';
    end if;
    source_intent_id := intent.id;
    insert into public.membership_payment_intents(user_id,plan,expected_amount,credit_amount,
      status,opened_at,expires_at,renewal_source_intent_id)
    values(p_user_id,intent.plan,intent.expected_amount,0,'superseded',p_paid_at,
      p_paid_at+interval '1 day',source_intent_id) returning * into intent;
    p_intent_id := intent.id;
  end if;
  if intent.status='cancelled' or (txn.id is not null and txn.status='cancel_requested') then
    raise exception 'Cancelled or cancellation-pending membership requires review';
  end if;
  if exists(select 1 from public.groble_webhook_events where merchant_uid=p_merchant_uid
    and event_type in ('subscription_payment.cancelled','subscription_payment.refunded')) then
    raise exception 'Membership cancellation arrived before completion; review required';
  end if;
  if profile.membership_updated_at > p_paid_at then
    raise exception 'Older membership payment arrived after a newer change; review required';
  end if;

  paid_date := (p_paid_at at time zone 'Asia/Seoul')::date;
  kind := coalesce(txn.payment_kind, case when intent.credit_amount>0 then 'membership_upgrade'
    -- A verified new checkout after expiry starts its own month. An automatic
    -- renewal still extends the existing period, even when received late.
    when source_intent_id is null and intent.plan='one_month'
      and not coalesce(profile.membership_status='active'
        and paid_date between profile.membership_start_date and profile.membership_end_date, false)
      and exists (
        select 1 from public.groble_webhook_events ev
        where ev.event_id=p_event_id and ev.merchant_uid=p_merchant_uid
          and ev.event_type='subscription_payment.completed'
          and ev.payload #>> '{data,object,subscription,billingReason}'='INITIAL'
          and ev.payload #>> '{data,object,subscription,currentRound}'='1'
      ) then 'membership_initial'
    when exists(select 1 from public.payment_transactions where user_id=p_user_id and status='completed'
      and payment_kind in ('membership_initial','membership_upgrade','membership_renewal')) then 'membership_renewal'
    else 'membership_initial' end);
  linked_id := case when source_intent_id is null then intent.meeting_date_application_id end;
  if linked_id is null and source_intent_id is null then
    select array_agg(id) into candidates from (select id from public.meeting_date_applications
      where user_id=p_user_id and status='payment_pending' and deposit_status='payment_pending'
        and created_at between intent.opened_at - interval '15 minutes' and intent.opened_at
      order by created_at desc limit 2) matches;
    if cardinality(candidates)=1 then linked_id := candidates[1]; end if;
  end if;
  if linked_id is not null then
    select * into app from public.meeting_date_applications where id=linked_id and user_id=p_user_id for update;
    if not found then raise exception 'Linked meeting application not found'; end if;
  end if;
  was_active := coalesce(profile.membership_status='active' and profile.membership_start_date<=today and profile.membership_end_date>=today,false);
  if kind='membership_renewal' then
    if profile.membership_end_date is null or profile.membership_start_date is null then
      raise exception 'Renewal has no existing membership dates; review required';
    end if;
    start_date := profile.membership_start_date;
    end_date := profile.membership_end_date + 30;
  else
    start_date := paid_date;
    end_date := (paid_date + make_interval(months=>months))::date - 1;
  end if;
  renewal_plan := case when kind='membership_renewal' then coalesce(profile.membership_plan,intent.plan) else intent.plan end;
  before_state := jsonb_build_object('status',profile.membership_status,'plan',profile.membership_plan,
    'start_date',profile.membership_start_date,'end_date',profile.membership_end_date,'updated_at',profile.membership_updated_at);
  after_state := jsonb_build_object('status','active','plan',renewal_plan,'start_date',start_date,'end_date',end_date,'updated_at',p_paid_at);
  if kind in ('membership_initial','membership_upgrade') and intent.plan='one_month' then
    after_state := after_state || jsonb_build_object('first_attendance', jsonb_build_object('pending', true));
  end if;
  if txn.id is null then
    insert into public.payment_transactions(provider,provider_event_id,merchant_uid,user_id,payment_kind,product_code,amount,status,occurred_at,membership_payment_intent_id)
    values('groble',p_event_id,p_merchant_uid,p_user_id,kind,'membership:'||intent.plan,p_amount,'completed',p_paid_at,p_intent_id)
    returning * into txn;
  end if;
  update public.membership_payment_intents set status='completed',ended_at=p_paid_at,completed_at=p_paid_at,
    groble_payment_event_id=txn.provider_event_id,meeting_date_application_id=linked_id,updated_at=now() where id=intent.id;
  if linked_id is not null then
    perform public.advance_paid_meeting_applications(p_user_id,null,linked_id,p_merchant_uid,txn.provider_event_id,p_paid_at,false);
  end if;
  update public.profiles set membership_status='active',membership_plan=renewal_plan,
    membership_start_date=start_date,membership_end_date=end_date,membership_updated_at=p_paid_at,
    name=coalesce(nullif(btrim(p_buyer_name),''),name),
    nickname=case when nullif(btrim(p_buyer_name),'') is not null and name is distinct from btrim(p_buyer_name)
      then coalesce(nullif(btrim(nickname),''),nullif(btrim(name),'')) else nickname end
    where user_id=p_user_id;
  if not was_active then
    insert into public.deposit_message_registrations(user_id,first_ticket_instance_id) values(p_user_id,null)
    on conflict(user_id) do nothing;
  end if;
  -- Only the linked interaction, or a still-pending compatibility interaction.
  select * into interaction from public.ticket_user_interactions where user_id=p_user_id
    and ((app.assigned_ticket_instance_id is not null and ticket_instance_id=app.assigned_ticket_instance_id)
      or (app.assigned_ticket_instance_id is null and status='payment_pending'))
    order by updated_at desc limit 1 for update;
  if found and interaction.status in ('payment_pending','payment_confirmed') then
    update public.ticket_user_interactions set status='payment_confirmed',
      opened_at=coalesce(opened_at,p_paid_at),responded_at=coalesce(responded_at,p_paid_at),
      payment_started_at=coalesce(payment_started_at,p_paid_at),payment_confirmed_at=p_paid_at,updated_at=now()
      where user_id=p_user_id and ticket_instance_id=interaction.ticket_instance_id;
  end if;
  update public.membership_payment_effects set is_current=false where user_id=p_user_id and is_current;
  insert into public.membership_payment_effects(transaction_id,intent_id,user_id,merchant_uid,before_state,after_state,extension_days)
    values(txn.id,intent.id,p_user_id,p_merchant_uid,before_state,after_state,case when kind='membership_renewal' then 30 end);
  return jsonb_build_object('outcome','applied','payment_kind',kind,'transaction_id',txn.id,'intent_id',txn.membership_payment_intent_id);
end;
$$;
revoke all on function public.apply_membership_payment(uuid,bigint,text,text,integer,timestamptz,text) from public,anon,authenticated;
grant execute on function public.apply_membership_payment(uuid,bigint,text,text,integer,timestamptz,text) to service_role;

-- Only the admin's attendance confirmation can rebase the first paid month.
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
  set arrival_status=p_arrival_status,
      arrival_status_updated_at=case when p_arrival_status is not null then recorded_at end,
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
