-- Read-only validation query for the payment section of the 09:30 funnel report.
-- Join this result to the existing visitor/application funnel by reference_day.
with
runtime as (
  select
    current_timestamp as now_utc,
    current_timestamp at time zone 'Asia/Seoul' as now_kst
),
anchor as (
  select
    case
      when now_kst::time >= time '09:30'
        then now_kst::date
      else now_kst::date - 1
    end as completed_day
  from runtime
),
days as (
  select generate_series(
    completed_day - 6,
    completed_day,
    interval '1 day'
  )::date as reference_day
  from anchor
),
bounds as (
  select
    reference_day,
    ((reference_day - 1) + time '09:30') at time zone 'Asia/Seoul'
      as starts_at,
    (reference_day + time '09:30') at time zone 'Asia/Seoul'
      as ends_at
  from days
),
payment_rollup as (
  select
    bounds.reference_day,
    count(distinct payment.user_id)
      filter (where payment.payment_kind = 'one_time')
      as one_time_payers,
    count(distinct payment.user_id)
      filter (where payment.payment_kind = 'membership_initial')
      as direct_subscription_payers,
    count(distinct payment.user_id)
      filter (where payment.payment_kind = 'membership_upgrade')
      as subscription_upgrade_payers,
    count(distinct payment.user_id)
      filter (where payment.payment_kind = 'membership_renewal')
      as subscription_renewal_payers,
    count(distinct payment.user_id)
      filter (
        where payment.payment_kind in (
          'membership_initial',
          'membership_upgrade'
        )
      ) as new_subscription_payers,
    count(distinct payment.user_id)
      filter (
        where payment.payment_kind in (
          'one_time',
          'membership_initial',
          'membership_upgrade'
        )
      ) as total_acquisition_payers,
    count(distinct payment.user_id)
      filter (
        where payment.payment_kind in (
          'one_time',
          'membership_initial',
          'membership_upgrade'
        )
          and payment.status <> 'completed'
      ) as cancelled_acquisition_payers,
    count(distinct payment.user_id)
      filter (
        where payment.payment_kind in (
          'one_time',
          'membership_initial',
          'membership_upgrade'
        )
          and payment.status = 'completed'
      ) as net_acquisition_payers,
    coalesce(sum(payment.amount)
      filter (
        where payment.payment_kind in (
          'one_time',
          'membership_initial',
          'membership_upgrade'
        )
      ), 0) as gross_acquisition_revenue,
    coalesce(sum(payment.amount)
      filter (
        where payment.payment_kind in (
          'one_time',
          'membership_initial',
          'membership_upgrade'
        )
          and payment.status = 'completed'
      ), 0) as net_acquisition_revenue,
    coalesce(sum(payment.amount)
      filter (
        where payment.payment_kind = 'membership_renewal'
          and payment.status = 'completed'
      ), 0) as renewal_revenue
  from bounds
  left join public.payment_transactions as payment
    on bounds.starts_at <= payment.occurred_at
   and payment.occurred_at < bounds.ends_at
  group by bounds.reference_day
),
webhook_quality as (
  select
    bounds.reference_day,
    count(*) filter (
      where webhook.event_type = 'payment.completed'
        and webhook.processing_status = 'unmatched'
    ) as unmatched_payments,
    count(*) filter (
      where webhook.event_type = 'payment.completed'
        and webhook.processing_status = 'ambiguous'
    ) as ambiguous_payments,
    count(*) filter (
      where webhook.event_type = 'payment.completed'
        and webhook.processing_status = 'failed'
    ) as failed_payments,
    count(*) filter (
      where webhook.event_type = 'payment.completed'
        and webhook.processing_status = 'processed'
        and webhook.payment_kind is null
    ) as legacy_unclassified_payments
  from bounds
  left join public.groble_webhook_events as webhook
    on bounds.starts_at <= coalesce(webhook.occurred_at, webhook.received_at)
   and coalesce(webhook.occurred_at, webhook.received_at) < bounds.ends_at
  group by bounds.reference_day
)
select
  payment.reference_day,
  payment.one_time_payers,
  payment.direct_subscription_payers,
  payment.subscription_upgrade_payers,
  payment.subscription_renewal_payers,
  payment.new_subscription_payers,
  payment.total_acquisition_payers,
  payment.cancelled_acquisition_payers,
  payment.net_acquisition_payers,
  payment.gross_acquisition_revenue,
  payment.net_acquisition_revenue,
  payment.renewal_revenue,
  quality.unmatched_payments,
  quality.ambiguous_payments,
  quality.failed_payments,
  quality.legacy_unclassified_payments
from payment_rollup as payment
join webhook_quality as quality using (reference_day)
order by payment.reference_day;

