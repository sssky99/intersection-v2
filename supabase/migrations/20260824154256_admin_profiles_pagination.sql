create extension if not exists pg_trgm with schema extensions;

create index if not exists profiles_created_at_user_id_idx
  on public.profiles (created_at desc, user_id);

create index if not exists profiles_gender_created_at_user_id_idx
  on public.profiles (gender, created_at desc, user_id);

create index if not exists profiles_name_search_trgm_idx
  on public.profiles using gin (lower(coalesce(name, '')) extensions.gin_trgm_ops);

create index if not exists profiles_phone_search_trgm_idx
  on public.profiles using gin (coalesce(phone, '') extensions.gin_trgm_ops);

create index if not exists payment_transactions_completed_user_idx
  on public.payment_transactions (user_id)
  where status = 'completed';

create index if not exists payment_transactions_one_time_completed_user_idx
  on public.payment_transactions (user_id)
  where status = 'completed' and payment_kind = 'one_time';

create or replace function public.admin_list_profiles(
  p_page integer default 1,
  p_limit integer default 50,
  p_search text default null,
  p_gender text default null,
  p_membership text default null,
  p_payment text default null,
  p_completion text default null,
  p_birth_sort text default null
)
returns table (
  user_id uuid,
  name text,
  phone text,
  gender text,
  birth_year text,
  profile_completed boolean,
  questions_completed boolean,
  membership_status text,
  membership_plan text,
  membership_start_date date,
  membership_end_date date,
  created_at timestamptz,
  has_payment boolean,
  one_time_paid boolean,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
set statement_timeout = '10s'
as $function$
  with filtered as (
    select
      p.user_id,
      p.name,
      p.phone,
      p.gender,
      p.birth_year,
      p.profile_completed,
      p.questions_completed,
      p.membership_status,
      p.membership_plan,
      p.membership_start_date,
      p.membership_end_date,
      p.created_at,
      exists (
        select 1
        from public.payment_transactions pt
        where pt.user_id = p.user_id
          and pt.status = 'completed'
      ) as has_payment,
      exists (
        select 1
        from public.payment_transactions pt
        where pt.user_id = p.user_id
          and pt.status = 'completed'
          and pt.payment_kind = 'one_time'
      ) as one_time_paid
    from public.profiles p
    where
      (
        nullif(trim(p_search), '') is null
        or lower(coalesce(p.name, '')) like '%' || lower(trim(p_search)) || '%'
        or coalesce(p.phone, '') like '%' || trim(p_search) || '%'
      )
      and (p_gender is null or p.gender = p_gender)
      and (
        p_membership is null
        or (
          p_membership = 'active'
          and p.membership_status = 'active'
          and (p.membership_end_date is null or p.membership_end_date >= current_date)
        )
        or (
          p_membership = 'inactive'
          and not (
            p.membership_status = 'active'
            and (p.membership_end_date is null or p.membership_end_date >= current_date)
          )
        )
      )
      and (
        p_completion is null
        or (p_completion = 'complete' and coalesce(p.profile_completed, false) and coalesce(p.questions_completed, false))
        or (p_completion = 'incomplete' and not (coalesce(p.profile_completed, false) and coalesce(p.questions_completed, false)))
      )
      and (
        p_payment is null
        or (
          p_payment = 'paid'
          and exists (
            select 1 from public.payment_transactions pt
            where pt.user_id = p.user_id and pt.status = 'completed'
          )
        )
        or (
          p_payment = 'unpaid'
          and not exists (
            select 1 from public.payment_transactions pt
            where pt.user_id = p.user_id and pt.status = 'completed'
          )
        )
      )
  )
  select
    f.user_id,
    f.name,
    f.phone,
    f.gender,
    f.birth_year,
    f.profile_completed,
    f.questions_completed,
    f.membership_status,
    f.membership_plan,
    f.membership_start_date,
    f.membership_end_date,
    f.created_at,
    f.has_payment,
    f.one_time_paid,
    count(*) over () as total_count
  from filtered f
  order by
    case when p_birth_sort = 'birth-asc' then nullif(f.birth_year, '')::integer end asc nulls last,
    case when p_birth_sort = 'birth-desc' then nullif(f.birth_year, '')::integer end desc nulls last,
    f.created_at desc nulls last,
    f.user_id
  limit greatest(1, least(coalesce(p_limit, 50), 50))
  offset (greatest(coalesce(p_page, 1), 1) - 1) * greatest(1, least(coalesce(p_limit, 50), 50));
$function$;

revoke all on function public.admin_list_profiles(integer, integer, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_list_profiles(integer, integer, text, text, text, text, text, text)
  to service_role;
