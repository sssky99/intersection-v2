alter table public.ticket_templates
  add column if not exists recommendation_preferred_activities text[] not null default '{}',
  add column if not exists recommendation_recent_interests text[] not null default '{}';

alter table public.ticket_templates
  drop constraint if exists ticket_templates_recommendation_preferred_activities_check,
  add constraint ticket_templates_recommendation_preferred_activities_check
    check (
      cardinality(recommendation_preferred_activities) <= 3
      and recommendation_preferred_activities <@ array[
        'meal', 'culture', 'outdoor', 'play', 'reading', 'taste'
      ]::text[]
    ),
  drop constraint if exists ticket_templates_recommendation_recent_interests_check,
  add constraint ticket_templates_recommendation_recent_interests_check
    check (
      cardinality(recommendation_recent_interests) <= 3
      and recommendation_recent_interests <@ array[
        'travel', 'food', 'coffee', 'movie', 'music', 'book',
        'exhibition', 'fitness', 'nature', 'game', 'photo', 'growth'
      ]::text[]
    );
