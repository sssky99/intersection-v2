alter table public.ticket_instances
add column if not exists ticket_reveal_override_at timestamptz;

comment on column public.ticket_instances.ticket_reveal_override_at is
  'Optional early reveal time for confirmed participants. Course and place reveal timing remains unchanged.';
