with answer_sets as (
  select
    user_id,
    max(answer_value) filter (where question_order = 1) as q1,
    max(answer_value) filter (where question_order = 2) as q2,
    max(answer_value) filter (where question_order = 3) as q3,
    max(answer_value) filter (where question_order = 4) as q4,
    max(answer_value) filter (where question_order = 5) as q5,
    max(answer_value) filter (where question_order = 6) as q6,
    max(answer_value) filter (where question_order = 7) as q7,
    max(answer_value) filter (where question_order = 8) as q8,
    max(answer_value) filter (where question_order = 9) as q9,
    max(answer_value) filter (where question_order = 10) as q10,
    max(answer_value) filter (where question_order = 11) as q11,
    max(answer_value) filter (where question_order = 12) as q12,
    max(answer_value) filter (where question_order = 13) as q13,
    max(answer_value) filter (where question_order = 14) as q14,
    max(answer_value) filter (where question_order = 15) as q15,
    max(answer_value) filter (where question_order = 16) as q16
  from public.user_answers
  where question_order between 1 and 16
  group by user_id
),
eligible as (
  select *
  from answer_sets
  where q1 in ('O', 'I') and q2 in ('O', 'I')
    and q3 in ('O', 'I') and q4 in ('O', 'I')
    and q5 in ('L', 'Q') and q6 in ('L', 'Q')
    and q7 in ('L', 'Q') and q8 in ('L', 'Q')
    and q9 in ('H', 'W') and q10 in ('H', 'W')
    and q11 in ('H', 'W') and q12 in ('H', 'W')
    and q13 in ('C', 'E') and q14 in ('C', 'E')
    and q15 in ('C', 'E') and q16 in ('C', 'E')
),
calculated as (
  select
    user_id,
    (
      case
        when ((q1 = 'O')::int + (q2 = 'O')::int + (q3 = 'O')::int + (q4 = 'O')::int) > 2 then 'O'
        when ((q1 = 'O')::int + (q2 = 'O')::int + (q3 = 'O')::int + (q4 = 'O')::int) < 2 then 'I'
        else q2
      end ||
      case
        when ((q5 = 'L')::int + (q6 = 'L')::int + (q7 = 'L')::int + (q8 = 'L')::int) > 2 then 'L'
        when ((q5 = 'L')::int + (q6 = 'L')::int + (q7 = 'L')::int + (q8 = 'L')::int) < 2 then 'Q'
        else q5
      end ||
      case
        when ((q9 = 'H')::int + (q10 = 'H')::int + (q11 = 'H')::int + (q12 = 'H')::int) > 2 then 'H'
        when ((q9 = 'H')::int + (q10 = 'H')::int + (q11 = 'H')::int + (q12 = 'H')::int) < 2 then 'W'
        else q9
      end ||
      case
        when ((q13 = 'C')::int + (q14 = 'C')::int + (q15 = 'C')::int + (q16 = 'C')::int) > 2 then 'C'
        when ((q13 = 'C')::int + (q14 = 'C')::int + (q15 = 'C')::int + (q16 = 'C')::int) < 2 then 'E'
        else q13
      end
    ) as result_code
  from eligible
)
update public.profiles as profiles
set
  conversation_result_code = calculated.result_code,
  conversation_result_version = 'v1',
  conversation_result_calculated_at = now()
from calculated
where profiles.user_id = calculated.user_id
  and (
    profiles.conversation_result_code is distinct from calculated.result_code
    or profiles.conversation_result_version is distinct from 'v1'
  );
