-- Secure lesson progress and assessment submission/marking workflows.
drop policy if exists progress_insert_enrolled_learner on public.learning_progress;
revoke insert,update,delete on public.learning_progress from authenticated;

create or replace function public.record_lesson_progress(p_lesson_id uuid,p_progress_percent numeric)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_learner uuid; v_course_id uuid; v_row public.learning_progress%rowtype; v_status text;
begin
 v_learner:=auth.uid();
 if v_learner is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_progress_percent is null or p_progress_percent<0 or p_progress_percent>100 then raise exception 'Progress must be between 0 and 100'; end if;
 select cm.course_id into v_course_id from public.lessons l join public.course_modules cm on cm.id=l.module_id where l.id=p_lesson_id;
 if v_course_id is null then raise exception 'Lesson not found'; end if;
 if not exists(select 1 from public.enrolments e where e.course_id=v_course_id and e.learner_id=v_learner and e.status in ('active','completed')) then
  raise exception 'An active enrolment is required' using errcode='42501';
 end if;
 v_status:=case when p_progress_percent=100 then 'completed' else 'in_progress' end;
 insert into public.learning_progress(learner_id,lesson_id,status,progress_percent,evidence,started_at,completed_at,last_activity_at,updated_at)
 values(v_learner,p_lesson_id,v_status,p_progress_percent,jsonb_build_object('source','learner_action','event','lesson_progress_update'),now(),case when p_progress_percent=100 then now() else null end,now(),now())
 on conflict(learner_id,lesson_id) do update set
  status=case when public.learning_progress.status='completed' then 'completed' else excluded.status end,
  progress_percent=greatest(public.learning_progress.progress_percent,excluded.progress_percent),
  completed_at=coalesce(public.learning_progress.completed_at,excluded.completed_at),
  last_activity_at=now(),updated_at=now()
 returning * into v_row;
 return jsonb_build_object('lesson_id',v_row.lesson_id,'status',v_row.status,'progress_percent',v_row.progress_percent,'completed_at',v_row.completed_at);
end;
$function$;
revoke all on function public.record_lesson_progress(uuid,numeric) from public,anon;
grant execute on function public.record_lesson_progress(uuid,numeric) to authenticated;

drop policy if exists attempts_insert_learner on public.assessment_attempts;
revoke insert,update,delete on public.assessment_attempts from authenticated;

create or replace function public.submit_assessment_attempt(p_assessment_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
 v_learner uuid; v_assessment public.assessments%rowtype; v_attempt_number integer; v_limit integer;
 v_question record; v_answer jsonb; v_total numeric:=0; v_earned numeric:=0; v_auto_count integer:=0; v_needs_review boolean:=false;
 v_question_count integer:=0; v_unknown_count integer:=0; v_attempt_id uuid; v_status text; v_score numeric; v_feedback jsonb;
begin
 v_learner:=auth.uid();
 if v_learner is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if jsonb_typeof(p_answers)<>'object' then raise exception 'Answers must be a JSON object'; end if;
 if octet_length(p_answers::text)>50000 then raise exception 'Assessment submission is too large'; end if;
 select * into v_assessment from public.assessments where id=p_assessment_id and publication_status='published' for update;
 if not found then raise exception 'Published assessment not found'; end if;
 if not exists(select 1 from public.enrolments e where e.course_id=v_assessment.course_id and e.learner_id=v_learner and e.status='active') then
  raise exception 'An active course enrolment is required' using errcode='42501';
 end if;
 v_limit:=coalesce(nullif(v_assessment.settings->>'attempt_limit','')::integer,3);
 if v_limit<1 then v_limit:=3; end if;
 select count(*)+1 into v_attempt_number from public.assessment_attempts where assessment_id=p_assessment_id and learner_id=v_learner;
 if v_attempt_number>v_limit then raise exception 'Assessment attempt limit reached'; end if;
 select count(*) into v_question_count from public.assessment_questions where assessment_id=p_assessment_id;
 if v_question_count<1 then raise exception 'Assessment has no questions'; end if;
 select count(*) into v_unknown_count
 from jsonb_object_keys(p_answers) k
 where not exists(select 1 from public.assessment_questions q where q.assessment_id=p_assessment_id and q.id::text=k);
 if v_unknown_count>0 then raise exception 'Submission contains unknown question identifiers'; end if;
 for v_question in
  select q.id,q.question_type,q.points,k.correct_answer
  from public.assessment_questions q
  left join public.assessment_question_keys k on k.question_id=q.id
  where q.assessment_id=p_assessment_id order by q.position
 loop
  v_total:=v_total+v_question.points;
  v_answer:=p_answers->v_question.id::text;
  if v_question.question_type in ('multiple_choice','numeric') and v_question.correct_answer is not null then
   v_auto_count:=v_auto_count+1;
   if v_answer is not null and v_answer=v_question.correct_answer then v_earned:=v_earned+v_question.points; end if;
  else
   v_needs_review:=true;
  end if;
 end loop;
 if v_total<=0 then raise exception 'Assessment total points must be greater than zero'; end if;
 if not v_needs_review and v_auto_count=v_question_count then
  v_status:='graded';v_score:=round((v_earned/v_total)*100,2);
  v_feedback:=jsonb_build_object('marking','deterministic_objective','earned_points',v_earned,'total_points',v_total,'score_percent',v_score,'human_review_required',false);
 else
  v_status:='submitted';v_score:=null;
  v_feedback:=jsonb_build_object('marking','pending_human_review','objective_points',v_earned,'total_points',v_total,'human_review_required',true);
 end if;
 insert into public.assessment_attempts(assessment_id,learner_id,attempt_number,status,answers,score,feedback,submitted_at,graded_at)
 values(p_assessment_id,v_learner,v_attempt_number,v_status,p_answers,v_score,v_feedback,now(),case when v_status='graded' then now() else null end)
 returning id into v_attempt_id;
 return jsonb_build_object('attempt_id',v_attempt_id,'attempt_number',v_attempt_number,'status',v_status,'score',v_score,'feedback',v_feedback);
end;
$function$;
revoke all on function public.submit_assessment_attempt(uuid,jsonb) from public,anon;
grant execute on function public.submit_assessment_attempt(uuid,jsonb) to authenticated;

create or replace function public.grade_assessment_attempt(p_attempt_id uuid,p_score numeric,p_feedback jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_course_id uuid; v_attempt public.assessment_attempts%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_score is null or p_score<0 or p_score>100 then raise exception 'Score must be between 0 and 100'; end if;
 select a.course_id into v_course_id from public.assessment_attempts aa join public.assessments a on a.id=aa.assessment_id where aa.id=p_attempt_id;
 if v_course_id is null or not private.can_manage_academy((select c.academy_id from public.courses c where c.id=v_course_id)) then
  raise exception 'Not authorised to grade this attempt' using errcode='42501';
 end if;
 update public.assessment_attempts set status='graded',score=p_score,feedback=coalesce(p_feedback,'{}'::jsonb),graded_at=now(),graded_by=auth.uid()
 where id=p_attempt_id and status='submitted' returning * into v_attempt;
 if not found then raise exception 'Only submitted attempts can be graded'; end if;
 return jsonb_build_object('attempt_id',v_attempt.id,'status',v_attempt.status,'score',v_attempt.score,'graded_at',v_attempt.graded_at);
end;
$function$;
revoke all on function public.grade_assessment_attempt(uuid,numeric,jsonb) from public,anon;
grant execute on function public.grade_assessment_attempt(uuid,numeric,jsonb) to authenticated;
