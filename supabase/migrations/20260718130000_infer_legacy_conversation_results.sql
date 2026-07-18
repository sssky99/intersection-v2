alter table public.profiles
add column if not exists conversation_result_source text,
add column if not exists conversation_result_confidence numeric;

alter table public.profiles
drop constraint if exists profiles_conversation_result_source_check;

alter table public.profiles
add constraint profiles_conversation_result_source_check
check (
  conversation_result_source is null
  or conversation_result_source in ('direct', 'legacy_inferred')
);

alter table public.profiles
drop constraint if exists profiles_conversation_result_confidence_check;

alter table public.profiles
add constraint profiles_conversation_result_confidence_check
check (
  conversation_result_confidence is null
  or conversation_result_confidence between 0 and 1
);

update public.profiles
set
  conversation_result_source = 'direct',
  conversation_result_confidence = 1
where conversation_result_version = 'v1'
  and conversation_result_code is not null;

with legacy_answers as (
  select
    user_id,
    max(answer_value) filter (where question_order = 1) as q1,
    max(answer_value) filter (where question_order = 2) as q2,
    max(answer_value) filter (where question_order = 3) as q3,
    max(answer_value) filter (where question_order = 4) as q4,
    max(answer_value) filter (where question_order = 5) as q5,
    max(answer_value) filter (where question_order = 6) as q6,
    max(answer_value) filter (where question_order = 7) as q7,
    (jsonb_agg(to_jsonb(answer_values)) filter (where question_order = 5))->0
      as q5_values
  from public.user_answers
  where question_order between 1 and 7
  group by user_id
),
eligible as (
  select *
  from legacy_answers
  where q1 in ('1', '2', '3', '4', '5')
    and q2 in ('1', '2', '3', '4', '5')
    and q3 in ('1', '2', '3', '4', '5')
    and q4 in ('1', '2', '3', '4', '5')
    and (
      jsonb_typeof(q5_values) = 'array'
      or (
        q5 in ('opener', 'connector', 'listener')
        and q6 in ('opener', 'connector', 'listener')
        and q7 in ('opener', 'connector', 'listener')
      )
    )
),
scored as (
  select
    user_id,
    0.8 * (q1::numeric - 3) +
      case
        when jsonb_typeof(q5_values) = 'array' then
          (case when q5_values ? 'starter' then 1.5 else 0 end) +
          (case when q5_values ? 'mood_maker' then 1.25 else 0 end) +
          (case when q5_values ? 'questioner' then 0.5 else 0 end) +
          (case when q5_values ? 'listener' then -1.5 else 0 end) +
          (case when q5_values ? 'reactor' then -0.5 else 0 end) +
          (case when q5_values ? 'organizer' then -0.25 else 0 end)
        else
          (case q5 when 'opener' then 1.5 when 'listener' then -1.5 else 0 end) +
          (case q6 when 'opener' then 1.5 when 'listener' then -1.5 else 0 end) +
          (case q7 when 'opener' then 1.5 when 'listener' then -1.5 else 0 end)
      end as i_score,
    0.8 * (q3::numeric - 3) +
      case
        when jsonb_typeof(q5_values) = 'array' then
          (case when q5_values ? 'questioner' then 1.5 else 0 end) +
          (case when q5_values ? 'listener' then -1.5 else 0 end) +
          (case when q5_values ? 'reactor' then -1 else 0 end) +
          (case when q5_values ? 'organizer' then -0.5 else 0 end)
        else
          (case q5 when 'opener' then 0.75 when 'connector' then -0.5 when 'listener' then -1.5 end) +
          (case q6 when 'opener' then 0.75 when 'connector' then -0.5 when 'listener' then -1.5 end) +
          (case q7 when 'opener' then 0.75 when 'connector' then -0.5 when 'listener' then -1.5 end)
      end as q_score,
    0.9 * (q2::numeric - 3) + 1.1 * (q3::numeric - 3) as w_score,
    1.0 * (q1::numeric - 3) + 1.2 * (q4::numeric - 3) as e_score
  from eligible
),
calculated as (
  select
    user_id,
    (case when i_score > 0 then 'I' else 'O' end) ||
    (case when q_score > 0 then 'Q' else 'L' end) ||
    (case when w_score > 0 then 'W' else 'H' end) ||
    (case when e_score > 0 then 'E' else 'C' end) as result_code,
    (
      least(1.0, abs(i_score) / 4.0) +
      least(1.0, abs(q_score) / 3.0) +
      least(1.0, abs(w_score) / 4.0) +
      least(1.0, abs(e_score) / 4.4)
    ) / 4.0 as confidence
  from scored
)
update public.profiles as profiles
set
  conversation_result_code = calculated.result_code,
  conversation_result_version = 'legacy-inferred-v1',
  conversation_result_calculated_at = now(),
  conversation_result_source = 'legacy_inferred',
  conversation_result_confidence = calculated.confidence
from calculated
where profiles.user_id = calculated.user_id
  and profiles.conversation_result_version is distinct from 'v1';
