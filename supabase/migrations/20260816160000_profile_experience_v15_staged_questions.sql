alter table public.profiles
add column if not exists post_payment_questions_completed_at timestamptz;

comment on column public.profiles.post_payment_questions_completed_at is
'When the six conversation-profile questions unlocked after confirmed participation were completed.';

alter table public.profiles
drop constraint if exists profiles_profile_experience_version_check;

alter table public.profiles
add constraint profiles_profile_experience_version_check
check (
  profile_experience_version in (
    'legacy-v1',
    'preferences-v2',
    'preferences-v13',
    'preferences-v14',
    'preferences-v15'
  )
);

alter table public.profiles
alter column profile_experience_version set default 'preferences-v15';

update public.profiles profile
set post_payment_questions_completed_at = coalesce(
  profile.post_payment_questions_completed_at,
  completed.completed_at
)
from (
  select
    answer.user_id,
    max(answer.updated_at) as completed_at
  from public.user_answers answer
  where answer.question_order in (13, 14, 28, 29, 30, 31)
  group by answer.user_id
  having count(distinct answer.question_order) = 6
) completed
where profile.user_id = completed.user_id
  and profile.post_payment_questions_completed_at is null;

comment on column public.profiles.profile_experience_version is
'Controls profile compatibility. preferences-v15 uses staged core and post-payment questionnaires.';
