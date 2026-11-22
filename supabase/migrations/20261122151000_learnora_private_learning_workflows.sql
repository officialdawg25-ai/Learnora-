-- Keep privileged write logic outside the exposed public API schema.
alter function public.record_lesson_progress(uuid,numeric) set schema private;
alter function public.submit_assessment_attempt(uuid,jsonb) set schema private;
alter function public.grade_assessment_attempt(uuid,numeric,jsonb) set schema private;

grant usage on schema private to authenticated;
revoke all on function private.record_lesson_progress(uuid,numeric) from public,anon;
revoke all on function private.submit_assessment_attempt(uuid,jsonb) from public,anon;
revoke all on function private.grade_assessment_attempt(uuid,numeric,jsonb) from public,anon;
grant execute on function private.record_lesson_progress(uuid,numeric) to authenticated;
grant execute on function private.submit_assessment_attempt(uuid,jsonb) to authenticated;
grant execute on function private.grade_assessment_attempt(uuid,numeric,jsonb) to authenticated;

create or replace function public.record_lesson_progress(p_lesson_id uuid,p_progress_percent numeric)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.record_lesson_progress(p_lesson_id,p_progress_percent); $function$;
create or replace function public.submit_assessment_attempt(p_assessment_id uuid,p_answers jsonb)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.submit_assessment_attempt(p_assessment_id,p_answers); $function$;
create or replace function public.grade_assessment_attempt(p_attempt_id uuid,p_score numeric,p_feedback jsonb)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.grade_assessment_attempt(p_attempt_id,p_score,p_feedback); $function$;

revoke all on function public.record_lesson_progress(uuid,numeric) from public,anon;
revoke all on function public.submit_assessment_attempt(uuid,jsonb) from public,anon;
revoke all on function public.grade_assessment_attempt(uuid,numeric,jsonb) from public,anon;
grant execute on function public.record_lesson_progress(uuid,numeric) to authenticated;
grant execute on function public.submit_assessment_attempt(uuid,jsonb) to authenticated;
grant execute on function public.grade_assessment_attempt(uuid,numeric,jsonb) to authenticated;
