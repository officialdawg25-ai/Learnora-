create or replace function public.review_institution_verification(
 p_submission_id uuid,
 p_decision text,
 p_reviewer_id uuid,
 p_notes text default null
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $function$
declare
 v_organisation_id uuid;
 v_organisation_status text;
begin
 if p_decision not in ('verified','more_information_required','rejected') then
  raise exception 'Invalid institution verification decision' using errcode='22023';
 end if;
 if p_reviewer_id is null then
  raise exception 'Reviewer is required' using errcode='22023';
 end if;

 select organisation_id into v_organisation_id
 from public.institution_verification_submissions
 where id=p_submission_id and status='pending'
 for update;

 if v_organisation_id is null then
  raise exception 'Pending institution verification not found' using errcode='P0002';
 end if;

 v_organisation_status:=case
  when p_decision='verified' then 'active'
  when p_decision='rejected' then 'suspended'
  else 'pending'
 end;

 update public.institution_verification_submissions
 set status=p_decision,
     reviewer_user_id=p_reviewer_id,
     reviewer_notes=left(coalesce(p_notes,''),4000),
     reviewed_at=now()
 where id=p_submission_id;

 update public.organisations
 set status=v_organisation_status,updated_at=now()
 where id=v_organisation_id;

 if not found then
  raise exception 'Institution organisation record not found' using errcode='P0002';
 end if;

 return jsonb_build_object('status',p_decision,'organisation_status',v_organisation_status);
end;
$function$;

revoke all on function public.review_institution_verification(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.review_institution_verification(uuid,text,uuid,text) to service_role;
