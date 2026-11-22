-- Public role requests are safe under RLS and do not require SECURITY DEFINER.
drop policy if exists user_roles_self_request_insert on public.user_roles;
create policy user_roles_self_request_insert on public.user_roles for insert to authenticated
with check (
 user_id=(select auth.uid())
 and role in ('learner','parent_guardian','educator','institution')
 and source='self_service'
 and status=case when role in ('learner','parent_guardian') then 'active' else 'pending' end
);
grant insert on public.user_roles to authenticated;

create or replace function public.request_learnora_role(p_role text)
returns table(requested_role text, role_status text)
language plpgsql
security invoker
set search_path=''
as $$
declare v_user uuid := auth.uid(); v_status text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_role not in ('learner','parent_guardian','educator','institution') then raise exception 'Unsupported account role'; end if;
 v_status := case when p_role in ('learner','parent_guardian') then 'active' else 'pending' end;
 insert into public.user_roles(user_id,role,status,source)
 values(v_user,p_role,v_status,'self_service')
 on conflict(user_id,role) do nothing;
 return query select ur.role,ur.status from public.user_roles ur where ur.user_id=v_user and ur.role=p_role;
end;
$$;
revoke all on function public.request_learnora_role(text) from public,anon;
grant execute on function public.request_learnora_role(text) to authenticated;

-- The privileged query returns only opt-in adult user IDs and aggregate shared-class/course counts.
-- Keep the SECURITY DEFINER implementation outside the exposed API schema and expose an invoker wrapper.
create or replace function private.discoverable_learning_connections()
returns table(user_id uuid, shared_class_count integer, shared_course_count integer)
language sql stable security definer set search_path=''
as $$
 select d.user_id,
  (select count(distinct mine.class_id)::integer from public.class_memberships mine
   join public.class_memberships theirs on theirs.class_id=mine.class_id
   where mine.user_id=auth.uid() and mine.status='active' and theirs.user_id=d.user_id and theirs.status='active'),
  (select count(distinct mine.course_id)::integer from public.enrolments mine
   join public.enrolments theirs on theirs.course_id=mine.course_id
   where mine.learner_id=auth.uid() and mine.status in ('active','completed')
   and theirs.learner_id=d.user_id and theirs.status in ('active','completed'))
 from public.learner_discovery_profiles d
 where auth.uid() is not null and d.user_id<>auth.uid() and d.discoverable=true
 and private.is_adult_discoverable(d.user_id);
$$;
revoke all on function private.discoverable_learning_connections() from public,anon;
grant execute on function private.discoverable_learning_connections() to authenticated;

create or replace function public.discoverable_learning_connections()
returns table(user_id uuid, shared_class_count integer, shared_course_count integer)
language sql stable security invoker set search_path=''
as $$ select * from private.discoverable_learning_connections() $$;
revoke all on function public.discoverable_learning_connections() from public,anon;
grant execute on function public.discoverable_learning_connections() to authenticated;
