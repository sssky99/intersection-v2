alter table public.ticket_instances
add column if not exists remaining_seat_label_count integer not null default 0;

alter table public.ticket_instances
drop constraint if exists ticket_instances_remaining_seat_label_count_check;

alter table public.ticket_instances
add constraint ticket_instances_remaining_seat_label_count_check
check (remaining_seat_label_count between 0 and 6);
