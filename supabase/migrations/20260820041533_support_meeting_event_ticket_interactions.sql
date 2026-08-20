alter table public.ticket_user_interactions
  alter column ticket_instance_id drop not null,
  add column if not exists event_id uuid
    references public.meeting_events(id) on delete cascade;

alter table public.ticket_user_interactions
  drop constraint if exists ticket_user_interactions_target_check;

alter table public.ticket_user_interactions
  add constraint ticket_user_interactions_target_check
  check (num_nonnulls(ticket_instance_id, event_id) = 1);

alter table public.ticket_user_interactions
  drop constraint if exists ticket_user_interactions_user_id_event_id_key;

alter table public.ticket_user_interactions
  add constraint ticket_user_interactions_user_id_event_id_key
  unique (user_id, event_id);

create index if not exists ticket_user_interactions_event_status_idx
on public.ticket_user_interactions(event_id, status, updated_at desc)
where event_id is not null;
