create or replace function public.apply_membership_payment(
  p_user_id uuid, p_intent_id bigint, p_event_id text, p_merchant_uid text,
  p_amount integer, p_paid_at timestamptz, p_buyer_name text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  profile public.profiles%rowtype;
  intent public.membership_payment_intents%rowtype;
  txn public.payment_transactions%rowtype;
  receipt public.membership_payment_effects%rowtype;
  app public.meeting_date_applications%rowtype;
  interaction public.ticket_user_interactions%rowtype;
  linked_id bigint; candidates bigint[]; transaction_ids bigint[];
  kind text; months integer; was_active boolean; start_date date; end_date date; base_date date;
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
    and (provider_event_id=p_event_id or membership_payment_intent_id=p_intent_id
      or (p_merchant_uid is not null and merchant_uid=p_merchant_uid));
  if cardinality(transaction_ids)>1 then raise exception 'Ambiguous membership transaction requires review'; end if;
  if cardinality(transaction_ids)=1 then
    select * into txn from public.payment_transactions where id=transaction_ids[1] for update;
    if txn.user_id is distinct from p_user_id or txn.membership_payment_intent_id is distinct from p_intent_id
       or txn.amount <> p_amount or txn.payment_kind not in ('membership_initial','membership_upgrade','membership_renewal')
       or (txn.merchant_uid is not null and p_merchant_uid is distinct from txn.merchant_uid) then
      raise exception 'Membership payment identity conflict';
    end if;
    if txn.status in ('cancelled','refunded') then
      return jsonb_build_object('outcome','cancelled','payment_kind',txn.payment_kind,'transaction_id',txn.id);
    end if;
    select * into receipt from public.membership_payment_effects where transaction_id=txn.id;
    if found then
      return jsonb_build_object('outcome','already_applied','payment_kind',txn.payment_kind,'transaction_id',txn.id);
    end if;
    -- Do not guess how far a pre-migration delivery progressed. A confirmed old
    -- profile may have been renewed or manually edited since that delivery.
    if intent.status='completed' and profile.membership_updated_at >= txn.occurred_at then
      raise exception 'Legacy membership payment has no application receipt; review required';
    end if;
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

  kind := coalesce(txn.payment_kind, case when intent.credit_amount>0 then 'membership_upgrade'
    when exists(select 1 from public.payment_transactions where user_id=p_user_id and status='completed'
      and payment_kind in ('membership_initial','membership_upgrade','membership_renewal')) then 'membership_renewal'
    else 'membership_initial' end);
  linked_id := intent.meeting_date_application_id;
  if linked_id is null then
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
  paid_date := (p_paid_at at time zone 'Asia/Seoul')::date;
  base_date := case when kind='membership_renewal' and was_active then profile.membership_end_date+1 else coalesce(app.meeting_date,paid_date) end;
  start_date := case when kind='membership_renewal' and was_active then profile.membership_start_date else base_date end;
  -- Postgres clamps the target day to month end, matching calculateMembershipEndDate.
  end_date := (base_date + make_interval(months=>months))::date - 1;
  before_state := jsonb_build_object('status',profile.membership_status,'plan',profile.membership_plan,
    'start_date',profile.membership_start_date,'end_date',profile.membership_end_date,'updated_at',profile.membership_updated_at);
  after_state := jsonb_build_object('status','active','plan',intent.plan,'start_date',start_date,'end_date',end_date,'updated_at',p_paid_at);
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
  update public.profiles set membership_status='active',membership_plan=intent.plan,
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
  insert into public.membership_payment_effects(transaction_id,intent_id,user_id,merchant_uid,before_state,after_state)
    values(txn.id,intent.id,p_user_id,p_merchant_uid,before_state,after_state);
  return jsonb_build_object('outcome','applied','payment_kind',kind,'transaction_id',txn.id);
end;
$$;
revoke all on function public.apply_membership_payment(uuid,bigint,text,text,integer,timestamptz,text) from public,anon,authenticated;
grant execute on function public.apply_membership_payment(uuid,bigint,text,text,integer,timestamptz,text) to service_role;
-- Stored, verified full refund events only. Partial refunds need operator review.
create or replace function public.apply_groble_refund(p_event_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  ev public.groble_webhook_events%rowtype;
  txn public.payment_transactions%rowtype;
  ref jsonb; ids bigint[]; refunded_at timestamptz; cancellation jsonb;
  linked_id bigint; app public.meeting_date_applications%rowtype;
  cancelled_applications bigint[] := '{}';
begin
  select * into ev from public.groble_webhook_events where event_id=p_event_id;
  if not found or ev.event_type not in ('payment.refunded','subscription_payment.refunded') then
    raise exception 'Stored refund event not found';
  end if;
  ref := ev.payload #> '{data,object,refund}';
  if ref is null or ref->>'partialRefund' is distinct from 'false' then
    raise exception 'Partial or unspecified refund requires review';
  end if;
  select array_agg(id) into ids from public.payment_transactions where provider='groble' and merchant_uid=ev.merchant_uid;
  if coalesce(cardinality(ids),0) <> 1 then raise exception 'Refund transaction match requires review'; end if;
  select * into txn from public.payment_transactions where id=ids[1];
  if (ev.event_type='payment.refunded' and txn.payment_kind<>'one_time')
     or (ev.event_type='subscription_payment.refunded' and txn.payment_kind not in ('membership_initial','membership_upgrade','membership_renewal'))
     or (ref->>'amount')::numeric is distinct from txn.amount
     or ref->>'currency' is distinct from txn.currency then
    raise exception 'Refund identity or amount mismatch requires review';
  end if;
  refunded_at := (ref->>'refundedAt')::timestamptz;
  if refunded_at is null or refunded_at < txn.occurred_at then raise exception 'Invalid refund timestamp'; end if;
  if txn.payment_kind='one_time' then
    perform public.cancel_one_time_payment(txn.id,refunded_at);
  else
    cancellation := public.cancel_membership_payment(txn.id,refunded_at);
    select meeting_date_application_id into linked_id from public.membership_payment_intents where id=txn.membership_payment_intent_id;
    -- Only the original, upcoming application paid by this charge. Never a later
    -- independent booking, completed attendance, or a replacement payment.
    if coalesce((cancellation->>'revoked_access')::boolean,false)
      and not exists(select 1 from public.payment_transactions where user_id=txn.user_id
        and id<>txn.id and status='completed' and payment_kind like 'membership_%' and occurred_at>=txn.occurred_at) then
      for app in select * from public.meeting_date_applications where id=linked_id and user_id=txn.user_id
        and groble_merchant_uid=txn.merchant_uid and meeting_date >= (refunded_at at time zone 'Asia/Seoul')::date
        and status in ('payment_pending','waitlisted','on_hold','approved','cancelled')
        and refund_completed_at is null for update
      loop
        perform public.admin_update_meeting_application(app.id,'{"status":"cancelled"}');
        update public.meeting_date_applications set refund_completed_at=refunded_at,
          cancelled_at=coalesce(cancelled_at,refunded_at),updated_at=now() where id=app.id;
        cancelled_applications := array_append(cancelled_applications,app.id);
      end loop;
    end if;
  end if;
  return jsonb_build_object('transaction_id',txn.id,'user_id',txn.user_id,'payment_kind',txn.payment_kind,
    'amount',txn.amount,'cancelled_applications',cancelled_applications,'membership_result',cancellation);
end;
$$;
revoke all on function public.apply_groble_refund(text) from public,anon,authenticated;
grant execute on function public.apply_groble_refund(text) to service_role;
