alter table public.profiles
add column if not exists public_intro_revealed_generated_at timestamptz;

update public.profiles
set public_intro_revealed_generated_at = public_intro_generated_at
where public_intro_generated_at is not null
  and public_intro_revealed_generated_at is null;
