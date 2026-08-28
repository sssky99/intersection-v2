create or replace function public.inherit_ticket_reservation_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  inherited_reservation_snapshot jsonb;
begin
  if new.ticket_instance_id is null then
    return new;
  end if;

  if nullif(btrim(new.ticket_snapshot ->> 'reservationName'), '') is not null
    or exists (
      select 1
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(new.ticket_snapshot -> 'reservationNames') = 'array'
            then new.ticket_snapshot -> 'reservationNames'
          else '[]'::jsonb
        end
      ) as reservation_name(value)
      where nullif(btrim(reservation_name.value), '') is not null
    )
  then
    return new;
  end if;

  select jsonb_strip_nulls(
    jsonb_build_object(
      'reservationName', participation.ticket_snapshot -> 'reservationName',
      'reservationNames', participation.ticket_snapshot -> 'reservationNames'
    )
  )
  into inherited_reservation_snapshot
  from public.ticket_participations participation
  where participation.ticket_instance_id = new.ticket_instance_id
    and participation.user_id <> new.user_id
    and (
      nullif(btrim(participation.ticket_snapshot ->> 'reservationName'), '') is not null
      or exists (
        select 1
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(participation.ticket_snapshot -> 'reservationNames') = 'array'
              then participation.ticket_snapshot -> 'reservationNames'
            else '[]'::jsonb
          end
        ) as reservation_name(value)
        where nullif(btrim(reservation_name.value), '') is not null
      )
    )
  order by
    case
      when participation.status in ('approved', 'feedback_done', 'completed') then 0
      else 1
    end,
    participation.updated_at desc nulls last,
    participation.id desc
  limit 1;

  if inherited_reservation_snapshot is not null
    and inherited_reservation_snapshot <> '{}'::jsonb
  then
    new.ticket_snapshot := inherited_reservation_snapshot
      || (
        coalesce(new.ticket_snapshot, '{}'::jsonb)
        - 'reservationName'
        - 'reservationNames'
      );
  end if;

  return new;
end;
$$;

drop trigger if exists inherit_ticket_reservation_snapshot
on public.ticket_participations;

create trigger inherit_ticket_reservation_snapshot
before insert or update on public.ticket_participations
for each row
execute function public.inherit_ticket_reservation_snapshot();

revoke all on function public.inherit_ticket_reservation_snapshot() from public;

with reservation_source as (
  select distinct on (participation.ticket_instance_id)
    participation.ticket_instance_id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'reservationName', participation.ticket_snapshot -> 'reservationName',
        'reservationNames', participation.ticket_snapshot -> 'reservationNames'
      )
    ) as reservation_snapshot
  from public.ticket_participations participation
  where participation.ticket_instance_id is not null
    and (
      nullif(btrim(participation.ticket_snapshot ->> 'reservationName'), '') is not null
      or exists (
        select 1
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(participation.ticket_snapshot -> 'reservationNames') = 'array'
              then participation.ticket_snapshot -> 'reservationNames'
            else '[]'::jsonb
          end
        ) as reservation_name(value)
        where nullif(btrim(reservation_name.value), '') is not null
      )
    )
  order by
    participation.ticket_instance_id,
    case
      when participation.status in ('approved', 'feedback_done', 'completed') then 0
      else 1
    end,
    participation.updated_at desc nulls last,
    participation.id desc
)
update public.ticket_participations target
set ticket_snapshot = source.reservation_snapshot
  || (
    coalesce(target.ticket_snapshot, '{}'::jsonb)
    - 'reservationName'
    - 'reservationNames'
  )
from reservation_source source
where target.ticket_instance_id = source.ticket_instance_id
  and target.status in ('approved', 'feedback_done', 'completed')
  and nullif(btrim(target.ticket_snapshot ->> 'reservationName'), '') is null
  and not exists (
    select 1
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(target.ticket_snapshot -> 'reservationNames') = 'array'
          then target.ticket_snapshot -> 'reservationNames'
        else '[]'::jsonb
      end
    ) as reservation_name(value)
    where nullif(btrim(reservation_name.value), '') is not null
  );
