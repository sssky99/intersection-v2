alter table public.profiles
add column if not exists launch_notification_requested boolean not null default false,
add column if not exists launch_notification_requested_at timestamptz;

grant delete on table public.user_answers to service_role;
