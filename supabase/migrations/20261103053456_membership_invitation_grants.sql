-- Invitation grants are entitlements, not payments or recurring subscriptions.
create table public.membership_invitations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text not null check (length(btrim(label)) between 1 and 120),
  enabled boolean not null default true,
  expires_at timestamptz,
  max_redemptions integer check (max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  created_at timestamptz not null default now()
);

create table public.membership_invitation_grants (
  -- One special-invitation benefit per account, including different invitation links.
  user_id uuid primary key references auth.users(id) on delete cascade,
  invitation_id uuid not null references public.membership_invitations(id),
  before_state jsonb not null,
  after_state jsonb not null,
  granted_at timestamptz not null default now()
);
create index membership_invitation_grants_invitation_idx on public.membership_invitation_grants(invitation_id);

alter table public.membership_invitations enable row level security;
alter table public.membership_invitation_grants enable row level security;
revoke all on public.membership_invitations, public.membership_invitation_grants from public, anon, authenticated;
grant select, insert, update on public.membership_invitations, public.membership_invitation_grants to service_role;

create function public.claim_membership_invitation(p_user_id uuid, p_token_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  member public.profiles%rowtype;
  invitation public.membership_invitations%rowtype;
  receipt public.membership_invitation_grants%rowtype;
  today date := (now() at time zone 'Asia/Seoul')::date;
  extension_start date;
  new_start date;
  new_end date;
  current_member boolean;
  before_state jsonb;
  after_state jsonb;
begin
  -- Serialize with paid membership changes and other invitation claims for this account.
  select * into member from public.profiles where user_id = p_user_id for update;
  if not found then return jsonb_build_object('outcome', 'profile_incomplete'); end if;
  select * into receipt from public.membership_invitation_grants where user_id = p_user_id;
  if found then return jsonb_build_object('outcome', 'already_granted', 'end_date', receipt.after_state->>'end_date'); end if;
  if member.questions_completed is not true or member.profile_completed is not true then
    return jsonb_build_object('outcome', 'profile_incomplete');
  end if;

  -- The shared link limit is checked under a row lock across different accounts.
  select * into invitation from public.membership_invitations where token_hash = p_token_hash for update;
  if not found or invitation.enabled is not true or invitation.expires_at <= now() then
    return jsonb_build_object('outcome', 'invalid_invitation');
  end if;
  if invitation.max_redemptions is not null and invitation.redeemed_count >= invitation.max_redemptions then
    return jsonb_build_object('outcome', 'invitation_full');
  end if;

  current_member := coalesce(member.membership_status = 'active' and member.membership_start_date is not null and member.membership_end_date >= today, false);
  extension_start := case when current_member then member.membership_end_date + 1 else today end;
  new_start := case when current_member then member.membership_start_date else today end;
  -- Match calculateMembershipEndDate(one_month), including month-end and leap years.
  new_end := (extension_start + interval '1 month')::date - 1;
  before_state := jsonb_build_object('status', member.membership_status, 'plan', member.membership_plan,
    'start_date', member.membership_start_date, 'end_date', member.membership_end_date);
  after_state := jsonb_build_object('status', 'active', 'plan', case when current_member then coalesce(member.membership_plan, 'one_month') else 'one_month' end,
    'start_date', new_start, 'end_date', new_end);

  update public.profiles set membership_status = 'active',
    membership_plan = after_state->>'plan', membership_start_date = new_start,
    membership_end_date = new_end, membership_updated_at = now()
    where user_id = p_user_id;
  insert into public.membership_invitation_grants(user_id, invitation_id, before_state, after_state)
    values (p_user_id, invitation.id, before_state, after_state);
  update public.membership_invitations set redeemed_count = redeemed_count + 1 where id = invitation.id;
  return jsonb_build_object('outcome', 'granted', 'start_date', new_start, 'end_date', new_end, 'extended', current_member);
end;
$$;
revoke all on function public.claim_membership_invitation(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_membership_invitation(uuid, text) to service_role;
