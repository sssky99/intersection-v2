alter table public.ticket_instances
add column if not exists operation_code text,
add column if not exists operation_note text;
