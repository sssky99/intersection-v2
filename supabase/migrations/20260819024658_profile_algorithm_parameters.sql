create table public.profile_algorithm_parameters (
  user_id uuid not null
    references public.profiles(user_id) on delete cascade,
  question_order integer not null
    constraint profile_algorithm_parameters_question_order_check
    check (question_order > 0),
  mode text not null
    constraint profile_algorithm_parameters_mode_check
    check (mode in ('similar', 'different')),
  position smallint not null
    constraint profile_algorithm_parameters_position_check
    check (position between 1 and 3),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_order),
  constraint profile_algorithm_parameters_user_position_key
    unique (user_id, position)
);

comment on table public.profile_algorithm_parameters is
'Stores up to three user-selected matching parameters and their priority order.';

alter table public.profile_algorithm_parameters enable row level security;

grant select, insert, update, delete
on table public.profile_algorithm_parameters
to authenticated;

grant select, insert, update, delete
on table public.profile_algorithm_parameters
to service_role;

create policy "Users can read own algorithm parameters"
on public.profile_algorithm_parameters
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own algorithm parameters"
on public.profile_algorithm_parameters
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own algorithm parameters"
on public.profile_algorithm_parameters
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own algorithm parameters"
on public.profile_algorithm_parameters
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.replace_my_algorithm_parameters(
  new_parameters jsonb
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  target_user_id uuid := (select auth.uid());
  parameter_count integer;
begin
  if target_user_id is null then
    raise exception 'authentication required';
  end if;

  if jsonb_typeof(new_parameters) is distinct from 'array' then
    raise exception 'algorithm parameters must be an array';
  end if;

  parameter_count := jsonb_array_length(new_parameters);
  if parameter_count > 3 then
    raise exception 'at most three algorithm parameters are allowed';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new_parameters) as parameter(value)
    where jsonb_typeof(parameter.value) is distinct from 'object'
      or coalesce(parameter.value ->> 'question_order', '') !~ '^[1-9][0-9]*$'
      or coalesce(parameter.value ->> 'mode', '') not in ('similar', 'different')
  ) then
    raise exception 'algorithm parameter payload is invalid';
  end if;

  if (
    select count(distinct (parameter.value ->> 'question_order')::integer)
    from jsonb_array_elements(new_parameters) as parameter(value)
  ) <> parameter_count then
    raise exception 'algorithm parameter questions must be unique';
  end if;

  delete from public.profile_algorithm_parameters
  where user_id = target_user_id;

  insert into public.profile_algorithm_parameters (
    user_id,
    question_order,
    mode,
    position,
    updated_at
  )
  select
    target_user_id,
    (parameter.value ->> 'question_order')::integer,
    parameter.value ->> 'mode',
    parameter.ordinality::smallint,
    now()
  from jsonb_array_elements(new_parameters) with ordinality
    as parameter(value, ordinality);
end;
$$;

revoke all on function public.replace_my_algorithm_parameters(jsonb)
from public, anon;

grant execute on function public.replace_my_algorithm_parameters(jsonb)
to authenticated, service_role;
