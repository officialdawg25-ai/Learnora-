-- Allow academy team members with teaching/management roles to read only their academy learning outcomes.
create policy enrolments_select_academy_team on public.enrolments
for select to authenticated using (
 exists(select 1 from public.courses c where c.id=course_id and private.can_manage_academy(c.academy_id))
);
create policy attempts_select_academy_team on public.assessment_attempts
for select to authenticated using (
 exists(select 1 from public.assessments a join public.courses c on c.id=a.course_id
  where a.id=assessment_id and private.can_manage_academy(c.academy_id))
);
