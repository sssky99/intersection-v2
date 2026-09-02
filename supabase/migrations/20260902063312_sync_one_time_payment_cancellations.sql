-- Reconcile one-time cancellation requests that arrived before the unified
-- payment row existed. A cancellation request is no longer an active payment,
-- even while Groble is finishing the refund.
update public.payment_transactions as transaction
set
  status = 'cancel_requested',
  cancel_requested_at = application.payment_cancel_requested_at,
  updated_at = now()
from public.meeting_date_applications as application
where transaction.payment_kind = 'one_time'
  and transaction.status = 'completed'
  and transaction.user_id = application.user_id
  and transaction.application_group_id = application.application_group_id
  and application.payment_cancel_requested_at is not null;

-- Groble's one-time sales screen was used as the source of truth on
-- 2026-09-02. Merchant UID and the buyer's normalized phone number must both
-- match before a row is corrected; names are intentionally not used because
-- the payer name can differ from the profile name.
with groble_cancelled(merchant_uid, groble_phone, cancelled_at_kst) as (
  values
    ('2026083117530917937', '01058259511', '2026-09-01 12:20'::timestamp),
    ('2026083117081117931', '01022680118', '2026-09-01 10:41'::timestamp),
    ('2026083116241017923', '01049662899', '2026-09-01 11:28'::timestamp),
    ('2026082816445117138', '01026866578', '2026-08-29 10:44'::timestamp),
    ('2026082723162216993', '01058207235', '2026-09-01 15:31'::timestamp),
    ('2026082608385116575', '01051656960', '2026-08-26 23:48'::timestamp),
    ('2026082514442216382', '01027267670', '2026-08-27 00:28'::timestamp),
    ('2026082512141716352', '01093543632', '2026-08-25 19:49'::timestamp),
    ('2026082501052216243', '01045567629', '2026-08-25 18:43'::timestamp),
    ('2026082212244815697', '01031796216', '2026-08-25 11:28'::timestamp),
    ('2026082200125215593', '01075527641', '2026-08-29 00:57'::timestamp),
    ('2026081903091814954', '01072897796', '2026-08-19 20:06'::timestamp),
    ('2026081900470414947', '01083504153', '2026-08-21 18:15'::timestamp),
    ('2026081822033714909', '01071890358', '2026-08-21 10:37'::timestamp),
    ('2026081820130314889', '01024697404', '2026-08-21 18:45'::timestamp),
    ('2026081820093214888', '01049069885', '2026-08-21 18:45'::timestamp),
    ('2026081719173814670', '01028296784', '2026-08-20 12:03'::timestamp),
    ('2026081717012514639', '01046415411', '2026-08-17 17:23'::timestamp),
    ('2026081716225314633', '01030309926', '2026-08-18 17:24'::timestamp),
    ('2026081618043614438', '01092702818', '2026-08-20 15:33'::timestamp),
    ('2026081212133313513', '01096593310', '2026-08-14 21:54'::timestamp),
    ('2026081211454013511', '01022165074', '2026-08-13 13:58'::timestamp),
    ('2026081201204313455', '01033078044', '2026-08-12 18:19'::timestamp),
    ('2026081201063813449', '01046597281', '2026-08-12 11:42'::timestamp),
    ('2026081119184613381', '01059208221', '2026-08-14 21:49'::timestamp),
    ('2026081108572013278', '01089813420', '2026-08-14 20:52'::timestamp)
), matched as (
  select
    transaction.id,
    transaction.status,
    groble_cancelled.cancelled_at_kst at time zone 'Asia/Seoul' as cancelled_at
  from groble_cancelled
  join public.payment_transactions as transaction
    on transaction.provider = 'groble'
   and transaction.payment_kind = 'one_time'
   and transaction.merchant_uid = groble_cancelled.merchant_uid
  join public.profiles as profile
    on profile.user_id = transaction.user_id
   and regexp_replace(coalesce(profile.phone, ''), '[^0-9]', '', 'g') =
       groble_cancelled.groble_phone
)
update public.payment_transactions as transaction
set
  status = case
    when transaction.status = 'refunded' then 'refunded'
    else 'cancelled'
  end,
  cancel_requested_at = coalesce(transaction.cancel_requested_at, matched.cancelled_at),
  cancelled_at = matched.cancelled_at,
  updated_at = now()
from matched
where transaction.id = matched.id;

with groble_cancelled(merchant_uid, groble_phone, cancelled_at_kst) as (
  values
    ('2026083117530917937', '01058259511', '2026-09-01 12:20'::timestamp),
    ('2026083117081117931', '01022680118', '2026-09-01 10:41'::timestamp),
    ('2026083116241017923', '01049662899', '2026-09-01 11:28'::timestamp),
    ('2026082816445117138', '01026866578', '2026-08-29 10:44'::timestamp),
    ('2026082723162216993', '01058207235', '2026-09-01 15:31'::timestamp),
    ('2026082608385116575', '01051656960', '2026-08-26 23:48'::timestamp),
    ('2026082514442216382', '01027267670', '2026-08-27 00:28'::timestamp),
    ('2026082512141716352', '01093543632', '2026-08-25 19:49'::timestamp),
    ('2026082501052216243', '01045567629', '2026-08-25 18:43'::timestamp),
    ('2026082212244815697', '01031796216', '2026-08-25 11:28'::timestamp),
    ('2026082200125215593', '01075527641', '2026-08-29 00:57'::timestamp),
    ('2026081903091814954', '01072897796', '2026-08-19 20:06'::timestamp),
    ('2026081900470414947', '01083504153', '2026-08-21 18:15'::timestamp),
    ('2026081822033714909', '01071890358', '2026-08-21 10:37'::timestamp),
    ('2026081820130314889', '01024697404', '2026-08-21 18:45'::timestamp),
    ('2026081820093214888', '01049069885', '2026-08-21 18:45'::timestamp),
    ('2026081719173814670', '01028296784', '2026-08-20 12:03'::timestamp),
    ('2026081717012514639', '01046415411', '2026-08-17 17:23'::timestamp),
    ('2026081716225314633', '01030309926', '2026-08-18 17:24'::timestamp),
    ('2026081618043614438', '01092702818', '2026-08-20 15:33'::timestamp),
    ('2026081212133313513', '01096593310', '2026-08-14 21:54'::timestamp),
    ('2026081211454013511', '01022165074', '2026-08-13 13:58'::timestamp),
    ('2026081201204313455', '01033078044', '2026-08-12 18:19'::timestamp),
    ('2026081201063813449', '01046597281', '2026-08-12 11:42'::timestamp),
    ('2026081119184613381', '01059208221', '2026-08-14 21:49'::timestamp),
    ('2026081108572013278', '01089813420', '2026-08-14 20:52'::timestamp)
), matched as (
  select
    transaction.user_id,
    transaction.application_group_id,
    groble_cancelled.cancelled_at_kst at time zone 'Asia/Seoul' as cancelled_at
  from groble_cancelled
  join public.payment_transactions as transaction
    on transaction.provider = 'groble'
   and transaction.payment_kind = 'one_time'
   and transaction.merchant_uid = groble_cancelled.merchant_uid
  join public.profiles as profile
    on profile.user_id = transaction.user_id
   and regexp_replace(coalesce(profile.phone, ''), '[^0-9]', '', 'g') =
       groble_cancelled.groble_phone
  where transaction.application_group_id is not null
)
update public.meeting_date_applications as application
set
  deposit_status = 'refunded',
  payment_cancel_requested_at = coalesce(
    application.payment_cancel_requested_at,
    matched.cancelled_at
  ),
  refund_completed_at = matched.cancelled_at,
  updated_at = now()
from matched
where application.user_id = matched.user_id
  and application.application_group_id = matched.application_group_id;
