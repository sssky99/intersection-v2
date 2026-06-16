grant select, insert, update, delete
on table public.user_answers
to authenticated;

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
