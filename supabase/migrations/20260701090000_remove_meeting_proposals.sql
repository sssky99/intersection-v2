alter table if exists public.ticket_templates
  drop column if exists proposal_id,
  drop column if exists proposer_user_id,
  drop column if exists proposer_display_name,
  drop column if exists proposer_public_intro,
  drop column if exists proposer_public_emoji;

drop table if exists public.meeting_proposal_change_requests;
drop table if exists public.meeting_proposals;
