-- Trigger helpers are invoked by PostgreSQL itself and do not need direct client access.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;

  if to_regprocedure('public.sync_meeting_event_application_count()') is not null then
    execute 'revoke all on function public.sync_meeting_event_application_count() from public, anon, authenticated';
  end if;
end;
$$;

-- Avoid the deprecated auth.role() helper in row triggers. The current database
-- role is authoritative here and still lets service_role perform managed writes.
create or replace function public.protect_operator_profile_flag()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.is_test_participant := false;
    elsif new.is_test_participant is distinct from old.is_test_participant then
      raise exception 'is_test_participant can only be changed by the service role';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.protect_profile_managed_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user <> 'authenticated' then
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

create or replace function public.protect_profile_experience_version()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user = 'authenticated'
    and new.profile_experience_version is distinct from old.profile_experience_version
  then
    raise exception 'profile experience version cannot be changed directly';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_operator_profile_flag() from public, anon, authenticated;
revoke all on function public.protect_profile_managed_fields() from public, anon, authenticated;
revoke all on function public.protect_profile_experience_version() from public, anon, authenticated;

-- Wrapping auth.uid() in a scalar subquery lets PostgreSQL evaluate it once per
-- statement instead of once per row, without changing policy semantics.
alter policy "Users can manage own answers" on public.user_answers
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can read own profile" on public.profiles
  using ((select auth.uid()) = user_id);
alter policy "Users can create own profile" on public.profiles
  with check ((select auth.uid()) = user_id);
alter policy "Users can update own profile" on public.profiles
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can select own meeting feedback" on public.meeting_feedback
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own meeting feedback" on public.meeting_feedback
  with check ((select auth.uid()) = user_id);
alter policy "Users can update own meeting feedback" on public.meeting_feedback
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can select own blind date offers" on public.blind_date_offers
  using (((select auth.uid()) = participant_a_id) or ((select auth.uid()) = participant_b_id));

alter policy "Users can manage own profile regeneration answers" on public.profile_regeneration_answers
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Meeting members can send open chat messages" on public.meeting_chat_messages
  with check (
    sender_id = (select auth.uid())
    and public.meeting_chat_can_access(ticket_instance_id)
  );
alter policy "Meeting members can delete own open chat messages" on public.meeting_chat_messages
  using (
    sender_id = (select auth.uid())
    and public.meeting_chat_can_access(ticket_instance_id)
  )
  with check (
    sender_id = (select auth.uid())
    and public.meeting_chat_can_access(ticket_instance_id)
  );

alter policy "Users can read own ticket invitations" on public.ticket_invitations
  using ((select auth.uid()) = user_id);
alter policy "Users can read own ticket participations" on public.ticket_participations
  using ((select auth.uid()) = user_id);
alter policy "Users can read own ticket rejections" on public.ticket_rejections
  using ((select auth.uid()) = user_id);
alter policy "Users can read own meeting date applications" on public.meeting_date_applications
  using ((select auth.uid()) = user_id);
alter policy "Users can read own ticket interactions" on public.ticket_user_interactions
  using ((select auth.uid()) = user_id);
