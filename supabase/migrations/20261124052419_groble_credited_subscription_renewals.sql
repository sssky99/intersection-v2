-- A checkout credit is not a discount on later Groble renewals.
-- Replace functions only; there is no historical replay or data backfill.

create or replace function public.match_groble_renewal_intent(p_event_id text)
returns table(user_id uuid,intent_id bigint,plan text,credit_amount integer)
language plpgsql security invoker set search_path = '' as $$
declare ev public.groble_webhook_events%rowtype; obj jsonb; reference text;
begin
  select * into ev from public.groble_webhook_events where event_id=p_event_id;
  obj := ev.payload #> '{data,object}';
  if ev.event_type is distinct from 'subscription_payment.completed'
    or obj #>> '{subscription,billingReason}' is distinct from 'RENEWAL'
    or coalesce((obj #>> '{subscription,currentRound}')::integer,0)<2
    or obj #>> '{subscription,billingCycleMonths}' is distinct from '1'
    or obj #>> '{pricing,currency}' is distinct from 'KRW' then
    raise exception 'Stored renewal identity requires review';
  end if;
  reference := nullif(obj->>'sellerReference','');
  return query
  select distinct i.user_id,i.id,i.plan,i.credit_amount
  from public.membership_payment_intents i join public.profiles p on p.user_id=i.user_id
  where p.archived_at is null and p.phone_normalized=ev.buyer_phone_normalized
    and i.plan='one_month'
    and i.expected_amount=(obj #>> '{pricing,finalAmount}')::integer
    and (
      (i.credit_amount=0 and reference is not null and i.seller_reference=reference)
      or (i.credit_amount>0 and i.status='completed' and i.seller_reference=reference
        and nullif(btrim(ev.merchant_uid),'') is not null
        and obj->>'merchantUid'=ev.merchant_uid
        and nullif(obj #>> '{content,id}','') is not null
        and exists (
          -- The credit applied to the first charge only. Prove that this is
          -- its renewal using the original applied charge and subscription.
          select 1 from public.payment_transactions t
          join public.membership_payment_effects receipt
            on receipt.transaction_id=t.id and receipt.intent_id=i.id and receipt.user_id=i.user_id
          join public.groble_webhook_events original
            on original.event_id=t.provider_event_id and original.merchant_uid=t.merchant_uid
          where t.provider='groble' and t.user_id=i.user_id and t.membership_payment_intent_id=i.id
            and t.provider_event_id=i.groble_payment_event_id
            and t.merchant_uid<>ev.merchant_uid and t.status='completed'
            and t.payment_kind='membership_upgrade' and receipt.cancelled_at is null
            and original.event_type='subscription_payment.completed'
            and original.buyer_phone_normalized=ev.buyer_phone_normalized
            and original.payload #>> '{data,object,sellerReference}'=reference
            and original.payload #>> '{data,object,subscription,billingReason}'='INITIAL'
            and original.payload #>> '{data,object,subscription,currentRound}'='1'
            and original.payload #>> '{data,object,content,id}'=obj #>> '{content,id}'
            and abs(extract(epoch from ((original.payload #>> '{data,object,subscription,activatedAt}')::timestamptz
              -(obj #>> '{subscription,activatedAt}')::timestamptz))) < 1
        ))
      or (i.credit_amount=0 and reference is null and exists (
        select 1 from public.groble_webhook_events original
        join public.payment_transactions t on t.provider='groble' and t.provider_event_id=original.event_id
        where t.membership_payment_intent_id=i.id and t.user_id=i.user_id
          and t.payment_kind in ('membership_initial','membership_upgrade')
          and original.event_type='subscription_payment.completed'
          and original.buyer_phone_normalized=ev.buyer_phone_normalized
          and original.payload #>> '{data,object,subscription,currentRound}'='1'
          and original.payload #>> '{data,object,content,id}'=obj #>> '{content,id}'
          and abs(extract(epoch from ((original.payload #>> '{data,object,subscription,activatedAt}')::timestamptz
            -(obj #>> '{subscription,activatedAt}')::timestamptz))) < 1
      ))
    ) limit 2;
end;
$$;
revoke all on function public.match_groble_renewal_intent(text) from public,anon,authenticated;
grant execute on function public.match_groble_renewal_intent(text) to service_role;

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

  kind := coalesce(txn.payment_kind, case when intent.credit_amount>0 then 'membership_upgrade'
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
  paid_date := (p_paid_at at time zone 'Asia/Seoul')::date;
  if kind='membership_renewal' then
    if profile.membership_end_date is null or profile.membership_start_date is null then
      raise exception 'Renewal has no existing membership dates; review required';
    end if;
    start_date := profile.membership_start_date;
    end_date := profile.membership_end_date + 30;
  else
    base_date := coalesce(app.meeting_date,paid_date);
    start_date := base_date;
    end_date := (base_date + make_interval(months=>months))::date - 1;
  end if;
  renewal_plan := case when kind='membership_renewal' then coalesce(profile.membership_plan,intent.plan) else intent.plan end;
  before_state := jsonb_build_object('status',profile.membership_status,'plan',profile.membership_plan,
    'start_date',profile.membership_start_date,'end_date',profile.membership_end_date,'updated_at',profile.membership_updated_at);
  after_state := jsonb_build_object('status','active','plan',renewal_plan,'start_date',start_date,'end_date',end_date,'updated_at',p_paid_at);
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

create or replace function public.record_groble_refunded_charge(p_event_id text)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  refund_event public.groble_webhook_events%rowtype;
  completion public.groble_webhook_events%rowtype;
  profile public.profiles%rowtype;
  source_intent public.membership_payment_intents%rowtype;
  obj jsonb; ref jsonb; ids bigint[]; users uuid[];
  paid_at timestamptz; refunded_at timestamptz; amount integer;
  round_number integer; charge_kind text; intent_id bigint; transaction_id bigint;
begin
  select * into refund_event from public.groble_webhook_events where event_id=p_event_id;
  if not found or refund_event.event_type <> 'subscription_payment.refunded'
    or nullif(refund_event.merchant_uid,'') is null then
    raise exception 'Stored subscription refund identity requires review';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('membership:' || refund_event.merchant_uid,0));
  select array_agg(id) into ids from public.payment_transactions
    where provider='groble' and merchant_uid=refund_event.merchant_uid;
  if cardinality(ids)=1 then return ids[1]; end if;
  if cardinality(ids)>1 then raise exception 'Ambiguous refund transaction requires review'; end if;
  select array_agg(id) into ids from public.groble_webhook_events
    where merchant_uid=refund_event.merchant_uid and event_type='subscription_payment.completed';
  if coalesce(cardinality(ids),0)<>1 then raise exception 'Refund completion match requires review'; end if;
  select * into completion from public.groble_webhook_events where id=ids[1];
  obj := completion.payload #> '{data,object}';
  ref := refund_event.payload #> '{data,object,refund}';
  amount := (obj #>> '{pricing,finalAmount}')::integer;
  paid_at := (obj #>> '{payment,purchasedAt}')::timestamptz;
  refunded_at := (ref->>'refundedAt')::timestamptz;
  round_number := (obj #>> '{subscription,currentRound}')::integer;
  if ref->>'partialRefund' is distinct from 'false'
    or amount is null or amount<=0 or (ref->>'amount')::numeric is distinct from amount
    or obj #>> '{pricing,currency}' is distinct from 'KRW'
    or ref->>'currency' is distinct from 'KRW'
    or obj->>'merchantUid' is distinct from refund_event.merchant_uid
    or refund_event.payload #>> '{data,object,merchantUid}' is distinct from refund_event.merchant_uid
    or paid_at is null or refunded_at is null or refunded_at<paid_at
    or abs(extract(epoch from (paid_at-(refund_event.payload #>> '{data,object,payment,purchasedAt}')::timestamptz)))>0.001
    or refund_event.payload #>> '{data,object,payment,purchasedAt}' is null
    or round_number is null or round_number<1
    or (refund_event.payload #>> '{data,object,subscription,refundedRound}')::integer is distinct from round_number
    or obj #>> '{subscription,billingCycleMonths}' is distinct from '1'
    or (round_number=1 and obj #>> '{subscription,billingReason}' is distinct from 'INITIAL')
    or (round_number>1 and obj #>> '{subscription,billingReason}' is distinct from 'RENEWAL')
    or nullif(obj #>> '{content,id}','') is null
    or obj #>> '{content,id}' is distinct from refund_event.payload #>> '{data,object,content,id}'
    or obj #>> '{subscription,activatedAt}' is null
    or refund_event.payload #>> '{data,object,subscription,activatedAt}' is null
    or abs(extract(epoch from ((obj #>> '{subscription,activatedAt}')::timestamptz-(refund_event.payload #>> '{data,object,subscription,activatedAt}')::timestamptz))) >= 1
    or completion.buyer_phone_normalized is null
    or completion.buyer_phone_normalized is distinct from refund_event.buyer_phone_normalized then
    raise exception 'Refund completion identity or amount mismatch requires review';
  end if;
  select array_agg(user_id) into users from public.profiles
    where phone_normalized=completion.buyer_phone_normalized and archived_at is null;
  if coalesce(cardinality(users),0)<>1 then raise exception 'Refund member match requires review'; end if;
  select * into profile from public.profiles where user_id=users[1] for update;
  if (completion.matched_user_id is not null and completion.matched_user_id<>profile.user_id)
    or (refund_event.matched_user_id is not null and refund_event.matched_user_id<>profile.user_id) then
    raise exception 'Refund member identity conflict requires review';
  end if;
  if nullif(obj->>'sellerReference','') is not null then
    select * into source_intent from public.membership_payment_intents where seller_reference=obj->>'sellerReference';
    if not found or source_intent.user_id<>profile.user_id or source_intent.plan<>'one_month'
      or source_intent.expected_amount<>amount then
      raise exception 'Refund reference identity or amount mismatch requires review';
    end if;
    if source_intent.credit_amount>0 and (round_number=1 or not exists (
      select 1 from public.match_groble_renewal_intent(completion.event_id) matched
      where matched.intent_id=source_intent.id and matched.user_id=profile.user_id
    )) then
      raise exception 'Credited refund reference identity or amount mismatch requires review';
    end if;
  end if;
  -- An absent ledger row is not permission to reverse a manual/legacy grant.
  -- Existing rows always use cancel_membership_payment and its verified receipt.
  charge_kind := case when round_number>1 then 'membership_renewal' else 'membership_initial' end;
  insert into public.membership_payment_intents(user_id,plan,expected_amount,credit_amount,status,
    opened_at,expires_at,completed_at,ended_at,groble_payment_event_id,renewal_source_intent_id)
  values(profile.user_id,'one_month',amount,0,'cancelled',paid_at,paid_at+interval '1 day',
    paid_at,refunded_at,completion.event_id,case when round_number>1 then source_intent.id end)
  returning id into intent_id;
  insert into public.payment_transactions(provider,provider_event_id,merchant_uid,user_id,payment_kind,
    product_code,amount,currency,status,occurred_at,cancelled_at,membership_payment_intent_id)
  values('groble',completion.event_id,refund_event.merchant_uid,profile.user_id,charge_kind,
    'membership:one_month',amount,'KRW','cancelled',paid_at,refunded_at,intent_id)
  returning id into transaction_id;
  return transaction_id;
end;
$$;
revoke all on function public.record_groble_refunded_charge(text) from public,anon,authenticated;
grant execute on function public.record_groble_refunded_charge(text) to service_role;
