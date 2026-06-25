alter table public.ticket_templates
  add column if not exists atmosphere_gender_mood text,
  add column if not exists atmosphere_age_band_id text;

alter table public.meeting_proposals
  add column if not exists atmosphere_gender_mood text,
  add column if not exists atmosphere_age_band_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ticket_templates_atmosphere_gender_mood_check'
  ) then
    alter table public.ticket_templates
      add constraint ticket_templates_atmosphere_gender_mood_check
      check (
        atmosphere_gender_mood is null
        or atmosphere_gender_mood in ('male', 'female', 'balanced')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ticket_templates_atmosphere_age_band_id_check'
  ) then
    alter table public.ticket_templates
      add constraint ticket_templates_atmosphere_age_band_id_check
      check (
        atmosphere_age_band_id is null
        or atmosphere_age_band_id in (
          '20-early',
          '20-middle',
          '20-late',
          '30-early',
          '30-middle'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'meeting_proposals_atmosphere_gender_mood_check'
  ) then
    alter table public.meeting_proposals
      add constraint meeting_proposals_atmosphere_gender_mood_check
      check (
        atmosphere_gender_mood is null
        or atmosphere_gender_mood in ('male', 'female', 'balanced')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'meeting_proposals_atmosphere_age_band_id_check'
  ) then
    alter table public.meeting_proposals
      add constraint meeting_proposals_atmosphere_age_band_id_check
      check (
        atmosphere_age_band_id is null
        or atmosphere_age_band_id in (
          '20-early',
          '20-middle',
          '20-late',
          '30-early',
          '30-middle'
        )
      );
  end if;
end $$;
