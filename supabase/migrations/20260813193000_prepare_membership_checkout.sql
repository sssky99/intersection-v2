create or replace function public.prepare_membership_checkout(
  p_user_id uuid,
  p_application_id bigint,
  p_plan text,
  p_expected_amount integer,
  p_credit_amount integer,
  p_seller_reference text,
  p_experiment_id text default null,
  p_landing_variant text default null,
  p_acquisition_context jsonb default null
)
returns table (
  intent_id bigint,
  opened_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  prepared_intent record;
  prepared_at timestamptz := clock_timestamp();
begin
  if not exists (
    select 1
    from public.meeting_date_applications as application
    where application.id = p_application_id
      and application.user_id = p_user_id
  ) then
    raise exception 'Meeting date application was not found.';
  end if;

  select *
  into prepared_intent
  from public.activate_membership_payment_intent(
    p_user_id,
    p_plan,
    p_expected_amount,
    p_credit_amount
  );

  update public.membership_payment_intents as intent
  set
    meeting_date_application_id = p_application_id,
    seller_reference = p_seller_reference,
    experiment_id = p_experiment_id,
    landing_variant = p_landing_variant,
    acquisition_context = p_acquisition_context,
    updated_at = prepared_at
  where intent.id = prepared_intent.intent_id
    and intent.user_id = p_user_id;

  update public.profiles as profile
  set
    membership_status = 'pending',
    membership_plan = p_plan,
    membership_purchase_clicked_at = prepared_at,
    membership_updated_at = prepared_at
  where profile.user_id = p_user_id;

  return query
  select
    prepared_intent.intent_id::bigint,
    prepared_intent.opened_at::timestamptz,
    prepared_intent.expires_at::timestamptz;
end;
$$;

revoke all on function public.prepare_membership_checkout(
  uuid,
  bigint,
  text,
  integer,
  integer,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.prepare_membership_checkout(
  uuid,
  bigint,
  text,
  integer,
  integer,
  text,
  text,
  text,
  jsonb
) to service_role;
