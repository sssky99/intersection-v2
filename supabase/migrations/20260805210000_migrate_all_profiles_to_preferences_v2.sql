create table if not exists public.profile_experience_migration_logs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  previous_version text not null,
  previous_core_answers jsonb not null default '[]'::jsonb,
  previous_draft_answers jsonb not null default '[]'::jsonb,
  migrated_at timestamptz not null default now()
);

alter table public.profile_experience_migration_logs enable row level security;

revoke all on table public.profile_experience_migration_logs
from public, anon, authenticated;

grant select, insert, update, delete
on table public.profile_experience_migration_logs
to service_role;

insert into public.profile_experience_migration_logs (
  user_id,
  previous_version,
  previous_core_answers,
  previous_draft_answers
)
select
  profile.user_id,
  profile.profile_experience_version,
  (
    select coalesce(
      jsonb_agg(to_jsonb(answer) order by answer.question_order),
      '[]'::jsonb
    )
    from public.user_answers answer
    where answer.user_id = profile.user_id
      and answer.question_order between 1 and 5
  ),
  (
    select coalesce(
      jsonb_agg(to_jsonb(answer) order by answer.question_order),
      '[]'::jsonb
    )
    from public.profile_regeneration_answers answer
    where answer.user_id = profile.user_id
  )
from public.profiles profile
where profile.profile_experience_version = 'legacy-v1'
on conflict (user_id) do nothing;

delete from public.user_answers answer
using public.profiles profile
where answer.user_id = profile.user_id
  and answer.question_order between 1 and 5
  and profile.profile_experience_version = 'legacy-v1';

delete from public.profile_regeneration_answers answer
using public.profiles profile
where answer.user_id = profile.user_id
  and profile.profile_experience_version = 'legacy-v1';

update public.profiles
set
  profile_experience_version = 'preferences-v2',
  profile_regeneration_started_at = null,
  profile_regeneration_questions_completed_at = null
where profile_experience_version = 'legacy-v1';

alter table public.profiles
alter column profile_experience_version set default 'preferences-v2';
