create or replace function public.activate_meeting_date_payment_intent(
  p_user_id uuid,
  p_application_id bigint
)
returns table (
  intent_id bigint,
  application_group_id uuid,
  opened_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  application_record public.meeting_date_applications%rowtype;
  intent_record public.meeting_date_payment_intents%rowtype;
  switched_at timestamptz := clock_timestamp();
begin
  select application.*
  into application_record
  from public.meeting_date_applications as application
  where application.id = p_application_id
    and application.user_id = p_user_id
    and application.deposit_status = 'payment_pending'
    and application.status in ('payment_pending', 'waitlisted', 'on_hold', 'approved')
  for update;

  if not found then
    raise exception 'Eligible meeting date application was not found.';
  end if;

  update public.meeting_date_payment_intents as intent
  set
    status = case
      when intent.expires_at <= switched_at then 'expired'
      else 'superseded'
    end,
    ended_at = least(switched_at, intent.expires_at),
    updated_at = switched_at
  where intent.user_id = p_user_id
    and intent.status = 'active'
    and intent.ended_at is null;

  insert into public.meeting_date_payment_intents (
    user_id,
    application_id,
    application_group_id,
    meeting_date,
    status,
    opened_at,
    expires_at,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    application_record.id,
    application_record.application_group_id,
    application_record.meeting_date,
    'active',
    switched_at,
    switched_at + interval '60 minutes',
    switched_at,
    switched_at
  )
  returning * into intent_record;

  return query
  select
    intent_record.id,
    intent_record.application_group_id,
    intent_record.opened_at,
    intent_record.expires_at;
end;
$$;

revoke all on function public.activate_meeting_date_payment_intent(uuid, bigint)
from public, anon, authenticated;
grant execute on function public.activate_meeting_date_payment_intent(uuid, bigint)
to service_role;
