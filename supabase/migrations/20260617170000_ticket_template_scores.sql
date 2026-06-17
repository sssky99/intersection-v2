alter table public.ticket_templates
add column if not exists score_temperature integer,
add column if not exists score_texture integer,
add column if not exists score_tone integer,
add column if not exists score_rhythm integer,
add column if not exists score_alcohol integer,
add column if not exists score_romance integer;

alter table public.ticket_templates
drop constraint if exists ticket_templates_score_temperature_check;

alter table public.ticket_templates
add constraint ticket_templates_score_temperature_check
check (score_temperature is null or score_temperature between 1 and 5);

alter table public.ticket_templates
drop constraint if exists ticket_templates_score_texture_check;

alter table public.ticket_templates
add constraint ticket_templates_score_texture_check
check (score_texture is null or score_texture between 1 and 5);

alter table public.ticket_templates
drop constraint if exists ticket_templates_score_tone_check;

alter table public.ticket_templates
add constraint ticket_templates_score_tone_check
check (score_tone is null or score_tone between 1 and 5);

alter table public.ticket_templates
drop constraint if exists ticket_templates_score_rhythm_check;

alter table public.ticket_templates
add constraint ticket_templates_score_rhythm_check
check (score_rhythm is null or score_rhythm between 1 and 5);

alter table public.ticket_templates
drop constraint if exists ticket_templates_score_alcohol_check;

alter table public.ticket_templates
add constraint ticket_templates_score_alcohol_check
check (score_alcohol is null or score_alcohol between 1 and 5);

alter table public.ticket_templates
drop constraint if exists ticket_templates_score_romance_check;

alter table public.ticket_templates
add constraint ticket_templates_score_romance_check
check (score_romance is null or score_romance between 1 and 5);
