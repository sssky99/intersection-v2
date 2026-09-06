alter table public.groble_webhook_events
  add column if not exists processing_token uuid,
  add column if not exists processing_lease_until timestamptz;

create or replace function public.claim_groble_webhook_event(
  p_event_id text, p_idempotency_key text, p_token uuid
)
returns table(outcome text, event_key text)
language plpgsql security invoker set search_path = ''
as $$
declare event public.groble_webhook_events%rowtype;
begin
  select * into event from public.groble_webhook_events
  where event_id = p_event_id for update;
  if not found then
    -- A key belonging to another event must never acknowledge this event.
    return query select 'conflict'::text, null::text;
    return;
  end if;
  if exists (select 1 from public.groble_webhook_events
    where idempotency_key = p_idempotency_key and event_id <> p_event_id) then
    return query select 'conflict'::text, null::text;
    return;
  end if;
  if event.processing_status not in ('received', 'failed') then
    return query select 'done'::text, event.idempotency_key;
    return;
  end if;
  if event.processing_lease_until > clock_timestamp() then
    return query select 'busy'::text, event.idempotency_key;
    return;
  end if;
  update public.groble_webhook_events
  set processing_status = 'received', processing_token = p_token,
    processing_lease_until = clock_timestamp() + interval '5 minutes', updated_at = now()
  where id = event.id;
  return query select 'claimed'::text, event.idempotency_key;
end;
$$;
revoke all on function public.claim_groble_webhook_event(text,text,uuid) from public, anon, authenticated;
grant execute on function public.claim_groble_webhook_event(text,text,uuid) to service_role;
