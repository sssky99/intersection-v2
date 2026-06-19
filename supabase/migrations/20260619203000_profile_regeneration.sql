alter table public.profiles
add column if not exists last_profile_regenerated_at timestamptz,
add column if not exists profile_regeneration_started_at timestamptz,
add column if not exists profile_regeneration_questions_completed_at timestamptz;

create table if not exists public.profile_regeneration_answers (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_order integer not null,
  category text not null,
  question_type text not null,
  answer_value text,
  answer_values text[],
  answer_text text,
  other_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_order)
);

create table if not exists public.profile_regeneration_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(user_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  regenerated_at timestamptz not null default now(),
  previous_answers_snapshot jsonb not null default '[]'::jsonb,
  previous_basic_info_snapshot jsonb not null default '{}'::jsonb,
  previous_scores_snapshot jsonb not null default '{}'::jsonb,
  previous_public_intro text,
  new_answers_snapshot jsonb not null default '[]'::jsonb,
  new_basic_info_snapshot jsonb not null default '{}'::jsonb,
  new_scores_snapshot jsonb not null default '{}'::jsonb,
  new_public_intro text
);

create index if not exists profile_regeneration_logs_profile_id_idx
on public.profile_regeneration_logs(profile_id, regenerated_at desc);

alter table public.profile_regeneration_answers enable row level security;
alter table public.profile_regeneration_logs enable row level security;

drop policy if exists "Users can manage own profile regeneration answers"
on public.profile_regeneration_answers;
create policy "Users can manage own profile regeneration answers"
on public.profile_regeneration_answers
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete
on table public.profile_regeneration_answers
to authenticated;
grant select, insert, update, delete
on table public.profile_regeneration_answers
to service_role;
grant select, insert, update, delete
on table public.profile_regeneration_logs
to service_role;

create or replace function public.complete_profile_regeneration(
  p_user_id uuid,
  p_basic_info jsonb,
  p_public_intro text,
  p_public_emoji text,
  p_public_intro_model text,
  p_public_intro_generated_at timestamptz,
  p_scores jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_previous_answers jsonb;
  v_new_answers jsonb;
  v_regenerated_at timestamptz := now();
begin
  select *
  into v_profile
  from public.profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  select coalesce(jsonb_agg(to_jsonb(answer) order by answer.question_order), '[]'::jsonb)
  into v_previous_answers
  from public.user_answers answer
  where answer.user_id = p_user_id;

  select coalesce(jsonb_agg(to_jsonb(answer) order by answer.question_order), '[]'::jsonb)
  into v_new_answers
  from public.profile_regeneration_answers answer
  where answer.user_id = p_user_id;

  if v_new_answers = '[]'::jsonb then
    raise exception 'draft_answers_not_found';
  end if;

  insert into public.profile_regeneration_logs (
    profile_id,
    user_id,
    regenerated_at,
    previous_answers_snapshot,
    previous_basic_info_snapshot,
    previous_scores_snapshot,
    previous_public_intro,
    new_answers_snapshot,
    new_basic_info_snapshot,
    new_scores_snapshot,
    new_public_intro
  )
  values (
    p_user_id,
    p_user_id,
    v_regenerated_at,
    v_previous_answers,
    jsonb_build_object(
      'name', v_profile.name,
      'nickname', v_profile.nickname,
      'phone', v_profile.phone,
      'phone_normalized', v_profile.phone_normalized,
      'gender', v_profile.gender,
      'birth_year', v_profile.birth_year,
      'mbti', v_profile.mbti,
      'photo_url', v_profile.photo_url
    ),
    jsonb_build_object(
      'score_temperature', v_profile.score_temperature,
      'score_texture', v_profile.score_texture,
      'score_tone', v_profile.score_tone,
      'score_rhythm', v_profile.score_rhythm
    ),
    v_profile.public_intro,
    v_new_answers,
    p_basic_info,
    p_scores,
    p_public_intro
  );

  delete from public.user_answers
  where user_id = p_user_id;

  insert into public.user_answers (
    user_id,
    question_order,
    category,
    question_type,
    answer_value,
    answer_values,
    answer_text,
    other_text,
    created_at,
    updated_at
  )
  select
    user_id,
    question_order,
    category,
    question_type,
    answer_value,
    answer_values,
    answer_text,
    other_text,
    created_at,
    updated_at
  from public.profile_regeneration_answers
  where user_id = p_user_id
  order by question_order;

  update public.profiles
  set
    name = nullif(trim(p_basic_info->>'name'), ''),
    nickname = nullif(trim(p_basic_info->>'nickname'), ''),
    phone = nullif(trim(p_basic_info->>'phone'), ''),
    phone_normalized = nullif(trim(p_basic_info->>'phone_normalized'), ''),
    gender = nullif(trim(p_basic_info->>'gender'), ''),
    birth_year = nullif(trim(p_basic_info->>'birth_year'), ''),
    mbti = nullif(trim(p_basic_info->>'mbti'), ''),
    photo_url = nullif(trim(p_basic_info->>'photo_url'), ''),
    questions_completed = true,
    profile_completed = true,
    public_intro = p_public_intro,
    public_emoji = nullif(trim(coalesce(p_public_emoji, '')), ''),
    public_intro_generated_at = p_public_intro_generated_at,
    public_intro_revealed_generated_at = null,
    public_intro_model = p_public_intro_model,
    score_temperature = nullif(p_scores->>'score_temperature', '')::integer,
    score_texture = nullif(p_scores->>'score_texture', '')::integer,
    score_tone = nullif(p_scores->>'score_tone', '')::integer,
    score_rhythm = nullif(p_scores->>'score_rhythm', '')::integer,
    last_profile_regenerated_at = v_regenerated_at,
    profile_regeneration_started_at = null,
    profile_regeneration_questions_completed_at = null
  where user_id = p_user_id;

  delete from public.profile_regeneration_answers
  where user_id = p_user_id;
end;
$$;

grant execute on function public.complete_profile_regeneration(
  uuid,
  jsonb,
  text,
  text,
  text,
  timestamptz,
  jsonb
)
to service_role;
