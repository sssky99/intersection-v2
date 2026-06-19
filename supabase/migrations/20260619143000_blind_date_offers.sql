create table if not exists public.blind_date_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text,
  short_description text,
  time_label text,
  region text,
  guide_text text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blind_date_offers (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.blind_date_templates(id) on delete set null,
  participant_a_id uuid not null references public.profiles(user_id) on delete cascade,
  participant_b_id uuid not null references public.profiles(user_id) on delete cascade,
  source_type text not null default 'mutual_feedback'
    check (source_type in ('mutual_feedback', 'test')),
  feedback_a_id uuid references public.meeting_feedback(id) on delete set null,
  feedback_b_id uuid references public.meeting_feedback(id) on delete set null,
  ticket_instance_id uuid references public.ticket_instances(id) on delete set null,
  ticket_template_id uuid references public.ticket_templates(id) on delete set null,
  status text not null default 'offered'
    check (
      status in (
        'pending_admin',
        'offered',
        'waiting_response',
        'scheduled',
        'needs_reschedule',
        'declined',
        'expired',
        'cancelled',
        'completed'
      )
    ),
  time_label text not null,
  region text not null,
  candidate_dates date[] not null default '{}',
  a_response text not null default 'pending'
    check (a_response in ('pending', 'yes', 'no')),
  b_response text not null default 'pending'
    check (b_response in ('pending', 'yes', 'no')),
  a_available_dates date[] not null default '{}',
  b_available_dates date[] not null default '{}',
  a_responded_at timestamptz,
  b_responded_at timestamptz,
  scheduled_date date,
  scheduled_at timestamptz,
  declined_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (participant_a_id <> participant_b_id)
);

create index if not exists blind_date_templates_active_idx
on public.blind_date_templates(active);

create index if not exists blind_date_offers_participant_a_idx
on public.blind_date_offers(participant_a_id);

create index if not exists blind_date_offers_participant_b_idx
on public.blind_date_offers(participant_b_id);

create index if not exists blind_date_offers_status_idx
on public.blind_date_offers(status);

create index if not exists blind_date_offers_expires_at_idx
on public.blind_date_offers(expires_at);

create index if not exists blind_date_offers_feedback_pair_idx
on public.blind_date_offers(feedback_a_id, feedback_b_id);

alter table public.blind_date_templates enable row level security;
alter table public.blind_date_offers enable row level security;

drop policy if exists "Users can select own blind date offers" on public.blind_date_offers;
create policy "Users can select own blind date offers"
on public.blind_date_offers
for select
to authenticated
using (
  auth.uid() = participant_a_id
  or auth.uid() = participant_b_id
);

grant select on table public.blind_date_templates to authenticated;
grant select on table public.blind_date_offers to authenticated;
grant select, insert, update, delete on table public.blind_date_templates to service_role;
grant select, insert, update, delete on table public.blind_date_offers to service_role;

insert into public.blind_date_templates (
  title,
  short_description,
  time_label,
  region,
  guide_text,
  active
)
values (
  '블라인드 데이트',
  '서로 다시 만나보고 싶다고 선택된 분과 단둘이 만나는 자리예요.',
  '저녁 7시',
  '성수',
  '상대방은 현장에서 알 수 있어요. 정확한 장소는 운영진이 별도로 안내드릴게요.',
  true
)
on conflict do nothing;
