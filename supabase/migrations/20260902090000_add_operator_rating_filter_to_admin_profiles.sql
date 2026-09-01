create index if not exists profile_operator_ratings_rating_user_id_idx
  on public.profile_operator_ratings (rating, user_id);

create or replace function public.admin_list_profiles_v2(
  p_page integer default 1,
  p_limit integer default 50,
  p_search text default null,
  p_gender text default null,
  p_membership text default null,
  p_payment text default null,
  p_completion text default null,
  p_birth_sort text default null,
  p_operator_rating text default null
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
  operator_rating numeric,
  operator_rating_updated_at timestamptz,
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
      ) as one_time_paid,
      r.rating as operator_rating,
      r.updated_at as operator_rating_updated_at
    from public.profiles p
    left join public.profile_operator_ratings r on r.user_id = p.user_id
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
      and (
        p_operator_rating is null
        or (p_operator_rating = '0-0.9' and r.rating >= 0 and r.rating < 1)
        or (p_operator_rating = '1-1.9' and r.rating >= 1 and r.rating < 2)
        or (p_operator_rating = '2-2.4' and r.rating >= 2 and r.rating < 2.5)
        or (p_operator_rating = '2.5-2.9' and r.rating >= 2.5 and r.rating < 3)
        or (p_operator_rating = '3-3.4' and r.rating >= 3 and r.rating < 3.5)
        or (p_operator_rating = '3.5-3.9' and r.rating >= 3.5 and r.rating < 4)
        or (p_operator_rating = '4-plus' and r.rating >= 4)
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
    f.operator_rating,
    f.operator_rating_updated_at,
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

revoke all on function public.admin_list_profiles_v2(
  integer,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
  from public, anon, authenticated;

grant execute on function public.admin_list_profiles_v2(
  integer,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
  to service_role;
