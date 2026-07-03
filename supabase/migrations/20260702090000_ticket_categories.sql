-- Normalize ticket activity_type into the six product-facing ticket categories.

alter table public.ticket_templates
  drop constraint if exists ticket_templates_activity_type_category_check;

with categorized as (
  select
    id,
    case
      when activity_type in (
        '쇼핑 / 취향탐색',
        '활동 / 체험',
        '문화콘텐츠',
        '오락',
        '독서',
        '식사 / 카페'
      ) then activity_type
      when lower(search_text) ~ '(shop|shopping|쇼핑|취향|동묘|빈티지|구제|플리마켓)'
        then '쇼핑 / 취향탐색'
      when lower(search_text) ~ '(movie|display|exhibition|culture|영화|토이스토리|전시|공연|뮤지컬|미술|감상|문화|콘텐츠)'
        then '문화콘텐츠'
      when lower(search_text) ~ '(boardgame|game|entertainment|보드게임|게임|오락|놀이)'
        then '오락'
      when lower(search_text) ~ '(book|books|reading|책|독서|소설|서점)'
        then '독서'
      when lower(search_text) ~ '(activity|picture|볼링|활동|체험|클래스|워크숍|산책|러닝|운동|사진|컬러헌팅|한강)'
        then '활동 / 체험'
      when lower(search_text) ~ '(dinner|food|cafe|pizza|talk|식사|카페|커피|디저트|맛집|피자|저녁|브런치|대화)'
        then '식사 / 카페'
      else null
    end as next_activity_type
  from (
    select
      id,
      activity_type,
      concat_ws(
        ' ',
        activity_type,
        title,
        array_to_string(coalesce(mood_tags, '{}'), ' '),
        short_description
      ) as search_text
    from public.ticket_templates
  ) templates
)
update public.ticket_templates template
set
  activity_type = categorized.next_activity_type,
  updated_at = now()
from categorized
where template.id = categorized.id
  and categorized.next_activity_type is not null
  and template.activity_type is distinct from categorized.next_activity_type;

alter table public.ticket_templates
  add constraint ticket_templates_activity_type_category_check
  check (
    activity_type is null
    or activity_type in (
      '쇼핑 / 취향탐색',
      '활동 / 체험',
      '문화콘텐츠',
      '오락',
      '독서',
      '식사 / 카페'
    )
  )
  not valid;
