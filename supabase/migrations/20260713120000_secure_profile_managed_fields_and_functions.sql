create or replace function public.protect_profile_managed_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.membership_status := null;
    new.membership_plan := null;
    new.membership_start_date := null;
    new.membership_end_date := null;
    new.membership_purchase_clicked_at := null;
    new.membership_updated_at := null;
    new.score_temperature := null;
    new.score_texture := null;
    new.score_tone := null;
    new.score_rhythm := null;
    new.matching_precision_bonus := 0;
    new.questions_completed := false;
    new.profile_completed := false;
    new.public_intro := null;
    new.public_emoji := null;
    new.public_intro_generated_at := null;
    new.public_intro_model := null;
    new.last_profile_regenerated_at := null;
    new.profile_regeneration_started_at := null;
    new.profile_regeneration_questions_completed_at := null;
    return new;
  end if;

  if new.membership_status is distinct from old.membership_status
    or new.membership_plan is distinct from old.membership_plan
    or new.membership_start_date is distinct from old.membership_start_date
    or new.membership_end_date is distinct from old.membership_end_date
    or new.membership_purchase_clicked_at is distinct from old.membership_purchase_clicked_at
    or new.membership_updated_at is distinct from old.membership_updated_at
    or new.score_temperature is distinct from old.score_temperature
    or new.score_texture is distinct from old.score_texture
    or new.score_tone is distinct from old.score_tone
    or new.score_rhythm is distinct from old.score_rhythm
    or new.matching_precision_bonus is distinct from old.matching_precision_bonus
    or new.questions_completed is distinct from old.questions_completed
    or new.profile_completed is distinct from old.profile_completed
    or new.public_intro is distinct from old.public_intro
    or new.public_emoji is distinct from old.public_emoji
    or new.public_intro_generated_at is distinct from old.public_intro_generated_at
    or new.public_intro_model is distinct from old.public_intro_model
    or new.last_profile_regenerated_at is distinct from old.last_profile_regenerated_at
    or new.profile_regeneration_started_at is distinct from old.profile_regeneration_started_at
    or new.profile_regeneration_questions_completed_at is distinct from old.profile_regeneration_questions_completed_at
  then
    raise exception 'server-managed profile fields cannot be changed directly';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_managed_fields_trigger on public.profiles;
create trigger protect_profile_managed_fields_trigger
before insert or update on public.profiles
for each row execute function public.protect_profile_managed_fields();

revoke all on function public.protect_profile_managed_fields() from public, anon, authenticated;

revoke all on function public.complete_profile_regeneration(
  uuid,
  jsonb,
  text,
  text,
  text,
  timestamptz,
  jsonb
) from public, anon, authenticated;
grant execute on function public.complete_profile_regeneration(
  uuid,
  jsonb,
  text,
  text,
  text,
  timestamptz,
  jsonb
) to service_role;

revoke all on function public.increment_service_counter(text, integer, integer, integer)
from public, anon, authenticated;
grant execute on function public.increment_service_counter(text, integer, integer, integer)
to service_role;
