do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ticket_instances'
      and column_name = 'minimum_participant_count'
  ) then
    alter table public.ticket_instances
      alter column minimum_participant_count set default 4;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ticket_templates'
      and column_name = 'minimum_participant_count'
  ) then
    alter table public.ticket_templates
      alter column minimum_participant_count set default 4;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'meeting_proposals'
      and column_name = 'minimum_participant_count'
  ) then
    alter table public.meeting_proposals
      alter column minimum_participant_count set default 4;
  end if;
end $$;
