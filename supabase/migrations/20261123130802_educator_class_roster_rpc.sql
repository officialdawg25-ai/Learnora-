-- Return a minimal class roster only to educators who are active staff for that class.
create or replace function public.get_educator_class_roster(p_class_id uuid)
returns table (
  learner_user_id uuid,
  display_name text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    cm.user_id as learner_user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'Learner') as display_name,
    cm.created_at as joined_at
  from public.class_memberships cm
  join public.user_roles ur
    on ur.user_id = cm.user_id
   and ur.role = 'learner'
   and ur.status = 'active'
  left join public.profiles p
    on p.id = cm.user_id
  where cm.class_id = p_class_id
    and cm.role = 'learner'
    and cm.status = 'active'
    and auth.uid() is not null
    and private.is_class_staff(p_class_id)
  order by coalesce(p.display_name, ''), cm.created_at;
$function$;

revoke all on function public.get_educator_class_roster(uuid) from public, anon;
grant execute on function public.get_educator_class_roster(uuid) to authenticated;
