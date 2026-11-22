-- Atomic, service-role-only guardian relationship review and event logging.
create or replace function public.review_guardian_relationship(
 p_relationship_id uuid,
 p_decision text,
 p_reviewer_id uuid,
 p_approved_consent_version text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare v_relationship public.guardian_relationships%rowtype; v_now timestamptz:=now();
begin
 if p_decision is null or p_decision not in ('active','rejected') or p_reviewer_id is null then
  raise exception 'Invalid guardian review decision.';
 end if;
 select * into v_relationship from public.guardian_relationships
  where id=p_relationship_id and status='pending' for update;
 if not found then raise exception 'Pending guardian request not found.' using errcode='P0002'; end if;
 if p_decision='active' then
  if v_relationship.learner_consent_status<>'approved'
   or v_relationship.learner_consent_at is null
   or v_relationship.learner_consent_version<>'learnora-learner-connection-v1'
   or p_approved_consent_version is null
   or v_relationship.consent_version<>p_approved_consent_version
   or v_relationship.evidence_reference is null
   or pg_catalog.btrim(v_relationship.evidence_reference)='' then
   raise exception 'Activation requires learner acknowledgement, the configured guardian consent version, and independently reviewed legal-authority evidence.' using errcode='23514';
  end if;
 end if;
 update public.guardian_relationships
  set status=p_decision,verified_by=p_reviewer_id,verified_at=v_now
  where id=p_relationship_id;
 insert into public.guardian_relationship_events(relationship_id,actor_user_id,event_type,metadata)
 values(p_relationship_id,p_reviewer_id,case when p_decision='active' then 'admin_activated' else 'admin_rejected' end,
  jsonb_build_object('decision',p_decision,'learner_consent_version',v_relationship.learner_consent_version));
 return jsonb_build_object('id',p_relationship_id,'status',p_decision,'learner_acknowledgement',v_relationship.learner_consent_status,'reviewed_at',v_now);
end;
$function$;
revoke all on function public.review_guardian_relationship(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.review_guardian_relationship(uuid,text,uuid,text) to service_role;
comment on function public.review_guardian_relationship(uuid,text,uuid,text) is 'Atomic guardian review, requiring learner acknowledgement and a configured guardian consent version before activation. Execute is restricted to service_role after Learnora platform permission checks.';
