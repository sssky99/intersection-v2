alter table public.profiles
add column if not exists public_emoji text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_public_emoji_length'
  ) then
    alter table public.profiles
    add constraint profiles_public_emoji_length
    check (public_emoji is null or char_length(public_emoji) between 1 and 16);
  end if;
end $$;
