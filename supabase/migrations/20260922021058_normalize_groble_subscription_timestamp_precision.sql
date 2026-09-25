-- Groble initial callbacks include fractional seconds; renewal/refund callbacks round activation to seconds.
-- A verified completion and full refund can arrive before a charge is linked.
-- Record their net-zero financial effect without granting/revoking membership.
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
    and i.plan='one_month' and i.credit_amount=0
    and i.expected_amount=(obj #>> '{pricing,finalAmount}')::integer
    and (
      (reference is not null and i.seller_reference=reference)
      or (reference is null and exists (
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
      or source_intent.expected_amount<>amount or source_intent.credit_amount<>0 then
      raise exception 'Refund reference identity or amount mismatch requires review';
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


