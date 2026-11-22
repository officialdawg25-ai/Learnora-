-- A learner invitation can only be issued by a learner account.
create or replace function private.create_guardian_connection_invite(p_token_hash text,p_consent_scopes text[])
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_learner uuid:=auth.uid(); v_id uuid; v_expiry timestamptz;
begin
 if v_learner is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.user_roles r where r.user_id=v_learner and r.role='learner' and r.status='active') then
  raise exception 'Only an active learner account can issue a guardian invitation.';
 end if;
 if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_consent_scopes is null or cardinality(p_consent_scopes)=0
  or not(p_consent_scopes <@ array['learning_progress','assessment_reports']::text[]) then raise exception 'The invitation is incomplete or invalid.'; end if;
 if (select count(*) from public.guardian_connection_invites where learner_user_id=v_learner and redeemed_at is null and revoked_at is null and expires_at>now())>=5 then
  raise exception 'You have reached the limit of active invitations. Revoke or wait for an existing invitation to expire.';
 end if;
 v_expiry:=now()+interval '72 hours';
 insert into public.guardian_connection_invites(learner_user_id,token_hash,consent_scopes,expires_at) values(v_learner,p_token_hash,p_consent_scopes,v_expiry) returning id into v_id;
 return jsonb_build_object('invite_id',v_id,'expires_at',v_expiry);
end; $$;

-- Only an account that has requested the parent/guardian role may redeem a learner-issued invitation.
create or replace function private.redeem_guardian_connection_invite(p_token_hash text,p_relationship_type text,p_evidence_reference text,p_consent_version text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_guardian uuid:=auth.uid(); v_invite public.guardian_connection_invites%rowtype; v_id uuid;
begin
 if v_guardian is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.user_roles r where r.user_id=v_guardian and r.role='parent_guardian' and r.status='active') then
  raise exception 'A parent or guardian account is required to redeem this invitation.';
 end if;
 if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_relationship_type is null or p_relationship_type not in ('parent','legal_guardian','caregiver')
  or p_consent_version is distinct from 'learnora-guardian-connection-v1' then raise exception 'This invitation could not be redeemed. Check the code or ask the learner to issue a new one.'; end if;
 select * into v_invite from public.guardian_connection_invites where token_hash=p_token_hash and expires_at>now() and redeemed_at is null and revoked_at is null for update;
 if not found or v_invite.learner_user_id=v_guardian then raise exception 'This invitation could not be redeemed. Check the code or ask the learner to issue a new one.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_guardian::text||':'||v_invite.learner_user_id::text,0));
 if exists(select 1 from public.guardian_relationships where guardian_user_id=v_guardian and learner_user_id=v_invite.learner_user_id and status in ('pending','active')) then raise exception 'A connection request already exists for this learner.'; end if;
 insert into public.guardian_relationships(guardian_user_id,learner_user_id,relationship_type,status,consent_scopes,consent_version,evidence_reference,learner_consent_status,guardian_invite_id)
 values(v_guardian,v_invite.learner_user_id,p_relationship_type,'pending',v_invite.consent_scopes,p_consent_version,nullif(pg_catalog.btrim(coalesce(p_evidence_reference,'')),''),'pending',v_invite.id) returning id into v_id;
 update public.guardian_connection_invites set redeemed_at=now(),redeemed_by=v_guardian where id=v_invite.id;
 insert into public.guardian_relationship_events(relationship_id,actor_user_id,event_type,metadata) values(v_id,v_guardian,'invite_redeemed',jsonb_build_object('scopes',v_invite.consent_scopes,'invite_id',v_invite.id));
 return v_id;
exception when unique_violation then raise exception 'A connection request already exists for this learner.';
end; $$;

-- Direct learner-ID connection requests also require an active parent/guardian account.
create or replace function private.request_guardian_connection(p_learner_user_id uuid,p_relationship_type text,p_consent_scopes text[],p_evidence_reference text,p_consent_version text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_guardian uuid:=auth.uid(); v_id uuid;
begin
 if v_guardian is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.user_roles r where r.user_id=v_guardian and r.role='parent_guardian' and r.status='active') then
  raise exception 'A parent or guardian account is required to request this connection.';
 end if;
 if p_learner_user_id is null or p_learner_user_id=v_guardian then raise exception 'Unable to submit this connection request. Check the learner details or use a learner-issued invitation.'; end if;
 if p_relationship_type is null or p_relationship_type not in ('parent','legal_guardian','caregiver')
  or p_consent_version is distinct from 'learnora-guardian-connection-v1'
  or p_consent_scopes is null or cardinality(p_consent_scopes)=0
  or not(p_consent_scopes <@ array['learning_progress','assessment_reports']::text[]) then raise exception 'The connection request is incomplete or invalid.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_guardian::text||':'||p_learner_user_id::text,0));
 if not exists(select 1 from public.profiles where id=p_learner_user_id)
  or exists(select 1 from public.guardian_relationships where guardian_user_id=v_guardian and learner_user_id=p_learner_user_id and status in ('pending','active')) then
  raise exception 'Unable to submit this connection request. Check the learner details or use a learner-issued invitation.';
 end if;
 insert into public.guardian_relationships(guardian_user_id,learner_user_id,relationship_type,status,consent_scopes,consent_version,evidence_reference,learner_consent_status)
 values(v_guardian,p_learner_user_id,p_relationship_type,'pending',p_consent_scopes,p_consent_version,nullif(pg_catalog.btrim(coalesce(p_evidence_reference,'')),''),'pending') returning id into v_id;
 insert into public.guardian_relationship_events(relationship_id,actor_user_id,event_type,metadata) values(v_id,v_guardian,'request_submitted',jsonb_build_object('scopes',p_consent_scopes));
 return v_id;
exception when unique_violation or foreign_key_violation then raise exception 'Unable to submit this connection request. Check the learner details or use a learner-issued invitation.';
end; $$;

-- Only the learner side of a relationship can acknowledge or decline the request.
create or replace function private.respond_guardian_connection(p_relationship_id uuid,p_decision text,p_consent_version text)
returns text language plpgsql security definer set search_path=''
as $$
declare v_learner uuid:=auth.uid();
begin
 if v_learner is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.user_roles r where r.user_id=v_learner and r.role='learner' and r.status='active') then
  raise exception 'Only the learner account can respond to this guardian request.';
 end if;
 if p_decision is null or p_decision not in ('approve','decline') or p_consent_version is distinct from 'learnora-learner-connection-v1' then raise exception 'A valid learner decision and consent version are required.'; end if;
 perform 1 from public.guardian_relationships where id=p_relationship_id and learner_user_id=v_learner and status='pending' and learner_consent_status='pending' for update;
 if not found then raise exception 'This connection request is no longer awaiting your response.'; end if;
 if p_decision='approve' then
  update public.guardian_relationships set learner_consent_status='approved',learner_consent_at=now(),learner_consent_version=p_consent_version where id=p_relationship_id;
  insert into public.guardian_relationship_events(relationship_id,actor_user_id,event_type,metadata) values(p_relationship_id,v_learner,'learner_approved',jsonb_build_object('consent_version',p_consent_version));
  return 'approved_pending_guardian_verification';
 else
  update public.guardian_relationships set status='rejected',learner_consent_status='declined',learner_consent_at=now(),learner_consent_version=p_consent_version where id=p_relationship_id;
  insert into public.guardian_relationship_events(relationship_id,actor_user_id,event_type,metadata) values(p_relationship_id,v_learner,'learner_declined',jsonb_build_object('consent_version',p_consent_version));
  return 'declined';
 end if;
end; $$;
