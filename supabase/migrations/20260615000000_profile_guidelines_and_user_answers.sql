alter table public.profiles
add column if not exists community_guidelines_agreed boolean not null default false,
add column if not exists community_guidelines_agreed_at timestamptz;

create table if not exists public.user_answers (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_order integer not null,
  category text not null,
  question_type text not null,
  answer_value text,
  answer_values text[],
  answer_text text,
  other_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_order)
);

alter table public.user_answers enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_answers'
      and policyname = 'Users can manage own answers'
  ) then
    create policy "Users can manage own answers"
    on public.user_answers
    for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end
$$;

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do update
set public = excluded.public;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can upload own profile photos'
  ) then
    create policy "Users can upload own profile photos"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'profile-photos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can update own profile photos'
  ) then
    create policy "Users can update own profile photos"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'profile-photos'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'profile-photos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can delete own profile photos'
  ) then
    create policy "Users can delete own profile photos"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'profile-photos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end
$$;
