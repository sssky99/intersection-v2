-- Read-only, no RPCs or replay. Run against the intended project only.
begin transaction read only;
select processing_status, last_error, count(*)
from public.groble_webhook_events group by 1,2 order by 3 desc;

-- Processed does not prove a surviving membership effect after account deletion.
select e.id event_row_id, e.event_id, e.merchant_uid, e.occurred_at,
       e.processing_status, t.id transaction_id, t.status transaction_status,
       case when t.status in ('cancelled','refunded') then 'cancelled/refunded'
            when t.id is null then 'no ledger'
            when t.user_id is null or t.membership_payment_intent_id is null then 'identity removed; review'
            when f.transaction_id is null then 'no receipt; review'
            else 'receipt present' end assessment
from public.groble_webhook_events e
left join public.payment_transactions t on t.provider='groble' and t.provider_event_id=e.event_id
left join public.membership_payment_effects f on f.transaction_id=t.id
where e.event_type='subscription_payment.completed'
  and e.occurred_at >= '2026-11-17T00:00:00+09:00'
  and e.occurred_at < '2026-11-25T00:00:00+09:00'
order by e.occurred_at;

select id, provider_event_id, merchant_uid, amount, occurred_at, status
from public.payment_transactions
where provider='groble'
  and payment_kind in ('membership_initial','membership_upgrade','membership_renewal')
  and status in ('completed','cancel_requested')
  and (user_id is null or membership_payment_intent_id is null)
order by occurred_at desc;
rollback;
