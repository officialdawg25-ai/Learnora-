-- Return enrolment rows only to users who can manage the course's academy.
create or replace function public.get_educator_course_roster(p_course_id uuid)
returns table (
  learner_user_id uuid,
  display_name text,
  enrolment_status text,
  enrolled_at timestamptz,
  completed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    e.learner_id,
    coalesce(nullif(btrim(p.display_name), ''), 'Learner'),
    e.status,
    e.enrolled_at,
    e.completed_at
  from public.enrolments e
  join public.courses c on c.id = e.course_id
  join public.user_roles ur
    on ur.user_id = e.learner_id
   and ur.role = 'learner'
   and ur.status = 'active'
  left join public.profiles p on p.id = e.learner_id
  where e.course_id = p_course_id
    and private.can_manage_academy(c.academy_id)
  order by e.enrolled_at desc;
$function$;

revoke all on function public.get_educator_course_roster(uuid) from public, anon;
grant execute on function public.get_educator_course_roster(uuid) to authenticated;
