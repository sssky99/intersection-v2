alter table public.profiles
add column if not exists conversation_result_code text,
add column if not exists conversation_result_version text,
add column if not exists conversation_result_calculated_at timestamptz;

alter table public.profiles
drop constraint if exists profiles_conversation_result_code_check;

alter table public.profiles
add constraint profiles_conversation_result_code_check
check (
  conversation_result_code is null
  or conversation_result_code in (
    'OLHC', 'OLHE', 'OLWC', 'OLWE',
    'OQHC', 'OQHE', 'OQWC', 'OQWE',
    'ILHC', 'ILHE', 'ILWC', 'ILWE',
    'IQHC', 'IQHE', 'IQWC', 'IQWE'
  )
);
