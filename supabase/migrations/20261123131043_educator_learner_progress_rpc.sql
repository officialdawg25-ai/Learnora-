-- Expose only competency mastery summaries to active educators who teach the learner's class.
create or replace function public.get_educator_learner_progress(
  p_class_id uuid,
  p_learner_user_id uuid
)
returns table (
  competency_code text,
  competency_title text,
  competency_description text,
  competency_level text,
  mastery_state text,
  evidence_count integer,
  confidence numeric,
  rationale text,
  evaluated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    c.code,
    c.title,
    c.description,
    c.level,
    m.mastery_state,
    m.evidence_count,
    m.confidence,
    m.rationale,
    m.evaluated_at
  from public.learner_competency_mastery m
  join public.competencies c on c.id = m.competency_id
  where m.learner_user_id = p_learner_user_id
    and auth.uid() is not null
    and private.is_class_staff(p_class_id)
    and exists (
      select 1
      from public.class_memberships cm
      join public.user_roles ur
        on ur.user_id = cm.user_id
       and ur.role = 'learner'
       and ur.status = 'active'
      where cm.class_id = p_class_id
        and cm.user_id = p_learner_user_id
        and cm.role = 'learner'
        and cm.status = 'active'
    )
  order by c.code;
$function$;

revoke all on function public.get_educator_learner_progress(uuid, uuid) from public, anon;
grant execute on function public.get_educator_learner_progress(uuid, uuid) to authenticated;
