do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can read own profile photos'
  ) then
    create policy "Users can read own profile photos"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'profile-photos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end
$$;
