create or replace function public.review_educator_verification(
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
 v_educator_user_id uuid;
begin
 if p_decision is null or p_decision not in ('verified','more_information_required','rejected') then
  raise exception 'Invalid educator verification decision' using errcode='22023';
 end if;
 if p_reviewer_id is null then raise exception 'Reviewer is required' using errcode='22023'; end if;

 select educator_user_id into v_educator_user_id
 from public.educator_verification_submissions
 where id=p_submission_id and status='pending'
 for update;
 if v_educator_user_id is null then
  raise exception 'Pending educator verification not found' using errcode='P0002';
 end if;

 update public.educator_verification_submissions
 set status=p_decision,reviewer_user_id=p_reviewer_id,
     reviewer_notes=left(coalesce(p_notes,''),4000),reviewed_at=now()
 where id=p_submission_id;

 update public.educator_profiles
 set verification_status=p_decision
 where user_id=v_educator_user_id;
 if not found then raise exception 'Educator profile not found' using errcode='P0002'; end if;

 return jsonb_build_object('status',p_decision,'educator_user_id',v_educator_user_id);
end;
$function$;

create or replace function public.review_course_publication(
 p_review_id uuid,
 p_decision text,
 p_reviewer_id uuid,
 p_notes text default null
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $function$
declare
 v_course_id uuid;
 v_next_status text;
 v_module_count bigint;
 v_lesson_count bigint;
begin
 if p_decision is null or p_decision not in ('approved','changes_requested','rejected') then
  raise exception 'Invalid publication decision' using errcode='22023';
 end if;
 if p_reviewer_id is null then raise exception 'Reviewer is required' using errcode='22023'; end if;

 select course_id into v_course_id
 from public.publication_reviews
 where id=p_review_id and status='pending'
 for update;
 if v_course_id is null then
  raise exception 'Pending publication review not found' using errcode='P0002';
 end if;

 if p_decision='approved' then
  select count(*) into v_module_count from public.course_modules where course_id=v_course_id;
  select count(*) into v_lesson_count
  from public.lessons l join public.course_modules m on m.id=l.module_id
  where m.course_id=v_course_id;
  if v_module_count<1 or v_lesson_count<1 then
   raise exception 'A course needs at least one module and one lesson before approval' using errcode='23514';
  end if;
 end if;

 v_next_status:=case
  when p_decision='approved' then 'published'
  when p_decision='changes_requested' then 'draft'
  else 'archived'
 end;

 update public.courses
 set publication_status=v_next_status,
     published_at=case when p_decision='approved' then now() else null end
 where id=v_course_id;
 if not found then raise exception 'Course not found' using errcode='P0002'; end if;

 update public.publication_reviews
 set status=p_decision,reviewer_user_id=p_reviewer_id,
     reviewer_notes=left(coalesce(p_notes,''),4000),reviewed_at=now()
 where id=p_review_id;

 return jsonb_build_object('status',p_decision,'course_status',v_next_status,'course_id',v_course_id);
end;
$function$;

revoke all on function public.review_educator_verification(uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.review_course_publication(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.review_educator_verification(uuid,text,uuid,text) to service_role;
grant execute on function public.review_course_publication(uuid,text,uuid,text) to service_role;
