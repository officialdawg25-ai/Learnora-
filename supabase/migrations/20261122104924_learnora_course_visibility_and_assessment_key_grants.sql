create or replace function private.can_access_course_content(p_course_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
  select 1 from public.courses c join public.academies a on a.id=c.academy_id
  where c.id=p_course_id and (
   private.can_manage_academy(c.academy_id)
   or (c.publication_status='published' and a.status='published' and (
    c.access_type='free' or exists (select 1 from public.enrolments e where e.course_id=c.id and e.learner_id=(select auth.uid()) and e.status='active')
   ))
  )
 );
$$;
grant select, insert, update, delete on public.assessment_question_keys to authenticated;
