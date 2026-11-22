-- Parent portal snapshot: only verified and consented learner information is returned.
create or replace function private.guardian_portal_snapshot()
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare v_actor uuid:=auth.uid(); v_result jsonb;
begin
 if v_actor is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.user_roles r where r.user_id=v_actor and r.role='parent_guardian' and r.status='active') then
  raise exception 'An active parent or guardian role is required';
 end if;
 select jsonb_build_object('children',coalesce(jsonb_agg(
  jsonb_build_object(
   'relationship_id',g.id,'learner_id',p.id,'display_name',p.display_name,'avatar_path',p.avatar_path,
   'consent_scopes',g.consent_scopes,'connected_at',g.verified_at,
   'progress',case when 'learning_progress'=any(g.consent_scopes) then jsonb_build_object(
    'record_count',(select count(*) from public.learning_progress lp where lp.learner_id=p.id),
    'average_percent',(select round(avg(lp.progress_percent),1) from public.learning_progress lp where lp.learner_id=p.id),
    'completed_count',(select count(*) from public.learning_progress lp where lp.learner_id=p.id and lp.status='completed'),
    'subjects',coalesce((select jsonb_agg(x.subject_row order by x.subject_name) from (
     select distinct coalesce(nullif(c.subject,''),c.title) subject_name,
      jsonb_build_object('course_id',c.id,'title',c.title,'subject',c.subject,'educator_name',coalesce(ep.public_display_name,ep_profile.display_name)) subject_row
     from public.learning_progress lp join public.lessons le on le.id=lp.lesson_id
     join public.course_modules cm on cm.id=le.module_id join public.courses c on c.id=cm.course_id
     left join public.educator_profiles ep on ep.user_id=c.created_by
     left join public.profiles ep_profile on ep_profile.id=c.created_by
     where lp.learner_id=p.id
    ) x),'[]'::jsonb)
   ) else null end,
   'assessments',case when 'assessment_reports'=any(g.consent_scopes) then jsonb_build_object(
    'record_count',(select count(*) from public.assessment_attempts aa where aa.learner_id=p.id and aa.graded_at is not null),
    'average_score',(select round(avg(aa.score),1) from public.assessment_attempts aa where aa.learner_id=p.id and aa.graded_at is not null),
    'recent',coalesce((select jsonb_agg(x.assessment_row order by x.graded_at desc) from (
     select aa.graded_at,jsonb_build_object('assessment_id',a.id,'title',a.title,'subject',c.subject,'score',aa.score,'graded_at',aa.graded_at,'feedback',aa.feedback) assessment_row
     from public.assessment_attempts aa join public.assessments a on a.id=aa.assessment_id
     left join public.courses c on c.id=a.course_id
     where aa.learner_id=p.id and aa.graded_at is not null order by aa.graded_at desc limit 5
    ) x),'[]'::jsonb)
   ) else null end
  ) order by p.display_name),'[]'::jsonb))
 into v_result from public.guardian_relationships g join public.profiles p on p.id=g.learner_user_id
 where g.guardian_user_id=v_actor and g.status='active' and g.learner_consent_status='approved' and g.revoked_at is null;
 return coalesce(v_result,jsonb_build_object('children','[]'::jsonb));
end;
$function$;
revoke all on function private.guardian_portal_snapshot() from public,anon;
grant execute on function private.guardian_portal_snapshot() to authenticated;
create or replace function public.guardian_portal_snapshot()
returns jsonb language sql stable security invoker set search_path=''
as $function$ select private.guardian_portal_snapshot(); $function$;
revoke all on function public.guardian_portal_snapshot() from public,anon;
grant execute on function public.guardian_portal_snapshot() to authenticated;
comment on function private.guardian_portal_snapshot() is 'Returns only verified, non-revoked learner relationships for the authenticated parent and only academic categories explicitly consented to by the learner.';
