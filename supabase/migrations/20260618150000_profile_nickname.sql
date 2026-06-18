alter table public.profiles
add column if not exists nickname text;

update public.profiles
set nickname = right(regexp_replace(coalesce(name, ''), '[^가-힣]', '', 'g'), 2)
where nickname is null
  and length(regexp_replace(coalesce(name, ''), '[^가-힣]', '', 'g')) >= 2;

alter table public.profiles
drop constraint if exists profiles_nickname_korean_two_chars_check;

alter table public.profiles
add constraint profiles_nickname_korean_two_chars_check
check (
  nickname is null
  or nickname ~ '^[가-힣]{2}$'
);
