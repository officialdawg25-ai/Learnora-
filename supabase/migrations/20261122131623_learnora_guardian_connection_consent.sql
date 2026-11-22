-- Learnora parent/learner connection requests, learner consent, single-use invitations and revocation.
-- Existing guardian relationships remain pending by default; no existing record is activated by this migration.

alter table public.guardian_relationships
  add column learner_consent_status text not null default 'pending'
    check (learner_consent_status in ('pending','approved','declined')),
  add column learner_consent_at timestamptz,
  add column learner_consent_version text,
  add column revoked_at timestamptz,
  add column revoked_by uuid references public.profiles(id) on delete set null,
  add column guardian_invite_id uuid;

alter table public.guardian_relationships
  add constraint guardian_relationship_consent_evidence_check
    check (
      (learner_consent_status = 'pending' and learner_consent_at is null and learner_consent_version is null)
      or (learner_consent_status in ('approved','declined') and learner_consent_at is not null and learner_consent_version is not null)
    ),
  add constraint guardian_relationship_active_requires_learner_consent
    check (status <> 'active' or learner_consent_status = 'approved'),
  add constraint guardian_relationship_revocation_evidence_check
    check ((status = 'revoked' and revoked_at is not null and revoked_by is not null) or status <> 'revoked'),
  add constraint guardian_relationship_scopes_check
    check (cardinality(consent_scopes) > 0 and consent_scopes <@ array['learning_progress','assessment_reports']::text[]);

create unique index guardian_relationship_one_open_pair
  on public.guardian_relationships(guardian_user_id,learner_user_id)
  where status in ('pending','active');

create table public.guardian_connection_invites (
  id uuid primary key default gen_random_uuid(),
  learner_user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  consent_scopes text[] not null
    check (cardinality(consent_scopes) > 0 and consent_scopes <@ array['learning_progress','assessment_reports']::text[]),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((redeemed_at is null and redeemed_by is null) or (redeemed_at is not null and redeemed_by is not null))
);
create index guardian_invites_learner_created_idx on public.guardian_connection_invites(learner_user_id,created_at desc);
create index guardian_invites_expiry_idx on public.guardian_connection_invites(expires_at) where redeemed_at is null and revoked_at is null;
alter table public.guardian_connection_invites enable row level security;
revoke all on public.guardian_connection_invites from anon,authenticated;
grant select on public.guardian_connection_invites to authenticated;
create policy guardian_invites_select_owner on public.guardian_connection_invites for select to authenticated
  using (learner_user_id = (select auth.uid()));

create table public.guardian_relationship_events (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.guardian_relationships(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in (
    'request_submitted','invite_redeemed','learner_approved','learner_declined',
    'guardian_revoked','learner_revoked','admin_activated','admin_rejected'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index guardian_relationship_events_timeline_idx on public.guardian_relationship_events(relationship_id,created_at desc);
alter table public.guardian_relationship_events enable row level security;
revoke all on public.guardian_relationship_events from anon,authenticated;
grant select on public.guardian_relationship_events to authenticated;
create policy guardian_relationship_events_participants_read on public.guardian_relationship_events for select to authenticated
  using (exists (
    select 1 from public.guardian_relationships r
    where r.id = relationship_id and (r.guardian_user_id = (select auth.uid()) or r.learner_user_id = (select auth.uid()))
  ));

alter table public.guardian_relationships
  add constraint guardian_relationship_invite_fk
  foreign key (guardian_invite_id) references public.guardian_connection_invites(id) on delete set null;

drop policy if exists guardian_relationship_insert_guardian_pending on public.guardian_relationships;
create policy guardian_relationship_insert_guardian_pending on public.guardian_relationships for insert to authenticated
  with check (
    guardian_user_id = (select auth.uid()) and status = 'pending'
    and verified_by is null and verified_at is null
    and learner_consent_status = 'pending' and learner_consent_at is null and learner_consent_version is null
    and revoked_at is null and revoked_by is null
  );

create or replace function private.guardian_has_scope(p_learner_id uuid,p_scope text)
returns boolean language sql stable security definer set search_path=''
as $function$
  select auth.uid() is not null and exists (
    select 1 from public.guardian_relationships g
    where g.guardian_user_id=(select auth.uid()) and g.learner_user_id=p_learner_id
      and g.status='active' and g.learner_consent_status='approved'
      and g.revoked_at is null and p_scope=any(g.consent_scopes)
  );
$function$;
revoke all on function private.guardian_has_scope(uuid,text) from public,anon;
grant execute on function private.guardian_has_scope(uuid,text) to authenticated;

create or replace function private.request_guardian_connection(
  p_learner_user_id uuid,p_relationship_type text,p_consent_scopes text[],
  p_evidence_reference text,p_consent_version text
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_guardian uuid := auth.uid(); v_id uuid;
begin
  if v_guardian is null then raise exception 'Authentication required'; end if;
  if p_learner_user_id is null or p_learner_user_id=v_guardian then
    raise exception 'Unable to submit this connection request. Check the learner details or use a learner-issued invitation.';
  end if;
  if p_relationship_type is null or p_relationship_type not in ('parent','legal_guardian','caregiver')
     or p_consent_version is distinct from 'learnora-guardian-connection-v1'
     or p_consent_scopes is null or cardinality(p_consent_scopes)=0
     or not (p_consent_scopes <@ array['learning_progress','assessment_reports']::text[]) then
    raise exception 'The connection request is incomplete or invalid.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_guardian::text||':'||p_learner_user_id::text,0));
  if not exists(select 1 from public.profiles where id=p_learner_user_id)
     or exists(select 1 from public.guardian_relationships where guardian_user_id=v_guardian and learner_user_id=p_learner_user_id and status in ('pending','active')) then
    raise exception 'Unable to submit this connection request. Check the learner details or use a learner-issued invitation.';
  end if;
  insert into public.guardian_relationships(guardian_user_id,learner_user_id,relationship_type,status,consent_scopes,consent_version,evidence_reference,learner_consent_status)
  values(v_guardian,p_learner_user_id,p_relationship_type,'pending',p_consent_scopes,p_consent_version,
    nullif(pg_catalog.btrim(coalesce(p_evidence_reference,'')),''),'pending') returning id into v_id;
  insert into public.guardian_relationship_events(relationship_id,actor_user_id,event_type,metadata)
  values(v_id,v_guardian,'request_submitted',jsonb_build_object('scopes',p_consent_scopes));
  return v_id;
exception when unique_violation or foreign_key_violation then
  raise exception 'Unable to submit this connection request. Check the learner details or use a learner-issued invitation.';
end;
$function$;

create or replace function private.create_guardian_connection_invite(p_token_hash text,p_consent_scopes text[])
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_learner uuid := auth.uid(); v_id uuid; v_expiry timestamptz;
begin
  if v_learner is null then raise exception 'Authentication required'; end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
     or p_consent_scopes is null or cardinality(p_consent_scopes)=0
     or not (p_consent_scopes <@ array['learning_progress','assessment_reports']::text[]) then
    raise exception 'The invitation is incomplete or invalid.';
  end if;
  if (select count(*) from public.guardian_connection_invites
      where learner_user_id=v_learner and redeemed_at is null and revoked_at is null and expires_at>now()) >= 5 then
    raise exception 'You have reached the limit of active invitations. Revoke or wait for an existing invitation to expire.';
  end if;
  v_expiry := now() + interval '72 hours';
  insert into public.guardian_connection_invites(learner_user_id,token_hash,consent_scopes,expires_at)
  values(v_learner,p_token_hash,p_consent_scopes,v_expiry) returning id into v_id;
  return jsonb_build_object('invite_id',v_id,'expires_at',v_expiry);
end;
$function$;

create or replace function private.redeem_guardian_connection_invite(
  p_token_hash text,p_relationship_type text,p_evidence_reference text,p_consent_version text
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_guardian uuid := auth.uid(); v_invite public.guardian_connection_invites%rowtype; v_id uuid;
begin
  if v_guardian is null then raise exception 'Authentication required'; end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
     or p_relationship_type is null or p_relationship_type not in ('parent','legal_guardian','caregiver')
     or p_consent_version is distinct from 'learnora-guardian-connection-v1' then
    raise exception 'This invitation could not be redeemed. Check the code or ask the learner to issue a new one.';
  end if;
  select * into v_invite from public.guardian_connection_invites
    where token_hash=p_token_hash and expires_at>now() and redeemed_at is null and revoked_at is null for update;
  if not found or v_invite.learner_user_id=v_guardian then
    raise exception 'This invitation could not be redeemed. Check the code or ask the learner to issue a new one.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_guardian::text||':'||v_invite.learner_user_id::text,0));
  if exists(select 1 from public.guardian_relationships where guardian_user_id=v_guardian and learner_user_id=v_invite.learner_user_id and status in ('pending','active')) then
    raise exception 'A connection request already exists for this learner.';
  end if;
  insert into public.guardian_relationships(guardian_user_id,learner_user_id,relationship_type,status,consent_scopes,consent_version,evidence_reference,learner_consent_status,guardian_invite_id)
  values(v_guardian,v_invite.learner_user_id,p_relationship_type,'pending',v_invite.consent_scopes,p_consent_version,
    nullif(pg_catalog.btrim(coalesce(p_evidence_reference,'')),''),'pending',v_invite.id) returning id into v_id;
  update public.guardian_connection_invites set redeemed_at=now(),redeemed_by=v_guardian where id=v_invite.id;
  insert into public.guardian_relationship_events(relationship_id,actor_user_id,event_type,metadata)
  values(v_id,v_guardian,'invite_redeemed',jsonb_build_object('scopes',v_invite.consent_scopes,'invite_id',v_invite.id));
  return v_id;
exception when unique_violation then
  raise exception 'A connection request already exists for this learner.';
end;
$function$;

create or replace function private.respond_guardian_connection(p_relationship_id uuid,p_decision text,p_consent_version text)
returns text language plpgsql security definer set search_path=''
as $function$
declare v_learner uuid := auth.uid();
begin
  if v_learner is null then raise exception 'Authentication required'; end if;
  if p_decision is null or p_decision not in ('approve','decline')
     or p_consent_version is distinct from 'learnora-learner-connection-v1' then
    raise exception 'A valid learner decision and consent version are required.';
  end if;
  perform 1 from public.guardian_relationships
    where id=p_relationship_id and learner_user_id=v_learner and status='pending' and learner_consent_status='pending' for update;
  if not found then raise exception 'This connection request is no longer awaiting your response.'; end if;
  if p_decision='approve' then
    update public.guardian_relationships set learner_consent_status='approved',learner_consent_at=now(),learner_consent_version=p_consent_version where id=p_relationship_id;
    insert into public.guardian_relationship_events(relationship_id,actor_user_id,event_type,metadata)
    values(p_relationship_id,v_learner,'learner_approved',jsonb_build_object('consent_version',p_consent_version));
    return 'approved_pending_guardian_verification';
  else
    update public.guardian_relationships set status='rejected',learner_consent_status='declined',learner_consent_at=now(),learner_consent_version=p_consent_version where id=p_relationship_id;
    insert into public.guardian_relationship_events(relationship_id,actor_user_id,event_type,metadata)
    values(p_relationship_id,v_learner,'learner_declined',jsonb_build_object('consent_version',p_consent_version));
    return 'declined';
  end if;
end;
$function$;

create or replace function private.revoke_guardian_connection(p_relationship_id uuid)
returns text language plpgsql security definer set search_path=''
as $function$
declare v_actor uuid := auth.uid(); v_event text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  update public.guardian_relationships set status='revoked',revoked_at=now(),revoked_by=v_actor
    where id=p_relationship_id and status in ('pending','active')
      and (guardian_user_id=v_actor or learner_user_id=v_actor)
    returning case when guardian_user_id=v_actor then 'guardian_revoked' else 'learner_revoked' end into v_event;
  if not found then raise exception 'This connection cannot be revoked by this account.'; end if;
  insert into public.guardian_relationship_events(relationship_id,actor_user_id,event_type,metadata)
  values(p_relationship_id,v_actor,v_event,'{}'::jsonb);
  return 'revoked';
end;
$function$;

create or replace function private.revoke_guardian_connection_invite(p_invite_id uuid)
returns text language plpgsql security definer set search_path=''
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.guardian_connection_invites set revoked_at=now()
    where id=p_invite_id and learner_user_id=auth.uid() and redeemed_at is null and revoked_at is null;
  if not found then raise exception 'This invitation can no longer be revoked.'; end if;
  return 'revoked';
end;
$function$;

create or replace function public.request_guardian_connection(p_learner_user_id uuid,p_relationship_type text,p_consent_scopes text[],p_evidence_reference text,p_consent_version text)
returns uuid language sql security invoker set search_path=''
as $function$ select private.request_guardian_connection($1,$2,$3,$4,$5); $function$;
create or replace function public.create_guardian_connection_invite(p_token_hash text,p_consent_scopes text[])
returns jsonb language sql security invoker set search_path=''
as $function$ select private.create_guardian_connection_invite($1,$2); $function$;
create or replace function public.redeem_guardian_connection_invite(p_token_hash text,p_relationship_type text,p_evidence_reference text,p_consent_version text)
returns uuid language sql security invoker set search_path=''
as $function$ select private.redeem_guardian_connection_invite($1,$2,$3,$4); $function$;
create or replace function public.respond_guardian_connection(p_relationship_id uuid,p_decision text,p_consent_version text)
returns text language sql security invoker set search_path=''
as $function$ select private.respond_guardian_connection($1,$2,$3); $function$;
create or replace function public.revoke_guardian_connection(p_relationship_id uuid)
returns text language sql security invoker set search_path=''
as $function$ select private.revoke_guardian_connection($1); $function$;
create or replace function public.revoke_guardian_connection_invite(p_invite_id uuid)
returns text language sql security invoker set search_path=''
as $function$ select private.revoke_guardian_connection_invite($1); $function$;

grant usage on schema private to authenticated;
revoke all on function private.request_guardian_connection(uuid,text,text[],text,text) from public,anon;
revoke all on function private.create_guardian_connection_invite(text,text[]) from public,anon;
revoke all on function private.redeem_guardian_connection_invite(text,text,text,text) from public,anon;
revoke all on function private.respond_guardian_connection(uuid,text,text) from public,anon;
revoke all on function private.revoke_guardian_connection(uuid) from public,anon;
revoke all on function private.revoke_guardian_connection_invite(uuid) from public,anon;
grant execute on function private.request_guardian_connection(uuid,text,text[],text,text) to authenticated;
grant execute on function private.create_guardian_connection_invite(text,text[]) to authenticated;
grant execute on function private.redeem_guardian_connection_invite(text,text,text,text) to authenticated;
grant execute on function private.respond_guardian_connection(uuid,text,text) to authenticated;
grant execute on function private.revoke_guardian_connection(uuid) to authenticated;
grant execute on function private.revoke_guardian_connection_invite(uuid) to authenticated;

revoke all on function public.request_guardian_connection(uuid,text,text[],text,text) from public,anon;
revoke all on function public.create_guardian_connection_invite(text,text[]) from public,anon;
revoke all on function public.redeem_guardian_connection_invite(text,text,text,text) from public,anon;
revoke all on function public.respond_guardian_connection(uuid,text,text) from public,anon;
revoke all on function public.revoke_guardian_connection(uuid) from public,anon;
revoke all on function public.revoke_guardian_connection_invite(uuid) from public,anon;
grant execute on function public.request_guardian_connection(uuid,text,text[],text,text) to authenticated;
grant execute on function public.create_guardian_connection_invite(text,text[]) to authenticated;
grant execute on function public.redeem_guardian_connection_invite(text,text,text,text) to authenticated;
grant execute on function public.respond_guardian_connection(uuid,text,text) to authenticated;
grant execute on function public.revoke_guardian_connection(uuid) to authenticated;
grant execute on function public.revoke_guardian_connection_invite(uuid) to authenticated;

comment on table public.guardian_connection_invites is 'Learner-issued, hashed, single-use guardian connection codes. Plaintext codes are only displayed to the learner at creation.';
comment on table public.guardian_relationship_events is 'Append-only audit history for guardian relationship requests, learner consent, invitation redemption and revocation.';
comment on column public.guardian_relationships.learner_consent_status is 'Learner response is recorded separately from legal guardian verification; it never activates a relationship by itself.';
