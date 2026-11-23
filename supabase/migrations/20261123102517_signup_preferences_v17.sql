alter table public.profiles drop constraint profiles_profile_experience_version_check;
alter table public.profiles add constraint profiles_profile_experience_version_check
  check (profile_experience_version in ('legacy-v1','preferences-v2','preferences-v13',
    'preferences-v14','preferences-v15','preferences-v16','preferences-v17'));

-- The authenticated server endpoint supplies validated answers. Updating first locks
-- the profile and makes concurrent submissions safe; both writes commit together.
create function public.complete_signup_v17(p_user_id uuid, p_phone text, p_name text,
  p_gender text, p_birth_date date, p_type text, p_answers jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.profiles set name = p_name, phone_normalized = p_phone,
    phone = substr(p_phone,1,3)||'-'||substr(p_phone,4,4)||'-'||substr(p_phone,8,4),
    gender = p_gender, birth_date = p_birth_date, birth_year = extract(year from p_birth_date)::int::text,
    questions_completed = true, profile_completed = true, questions_completed_at = now(),
    basic_info_completed_at = now(), profile_completed_at = now(),
    profile_experience_version = 'preferences-v17', profile_archetype_id = p_type,
    profile_archetype_version = 'signup-v17-provisional', profile_archetype_assigned_at = now()
  where user_id = p_user_id and profile_completed is not true;
  if not found then
    if exists(select 1 from public.profiles where user_id = p_user_id) then return false; end if;
    raise exception 'Missing signup profile';
  end if;
  insert into public.user_answers (user_id, question_order, category, question_type, answer_value, answer_values, answer_text)
    select p_user_id, a.question_order, a.category, a.question_type, a.answer_value, a.answer_values, a.answer_text
    from jsonb_populate_recordset(null::public.user_answers, p_answers) a
    on conflict (user_id, question_order) do update set answer_value = excluded.answer_value,
      answer_values = excluded.answer_values, answer_text = excluded.answer_text, updated_at = now();
  return true;
end;
$$;
revoke all on function public.complete_signup_v17(uuid,text,text,text,date,text,jsonb) from public, anon, authenticated;
grant execute on function public.complete_signup_v17(uuid,text,text,text,date,text,jsonb) to service_role;
