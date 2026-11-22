drop policy if exists learner_discovery_select_self_or_opted_adult on public.learner_discovery_profiles;
create policy learner_discovery_select_self_or_opted_adult on public.learner_discovery_profiles for select to authenticated
using(
 exists(select 1 from public.user_roles r where r.user_id=learner_discovery_profiles.user_id and r.role='learner' and r.status='active')
 and (
  user_id=(select auth.uid())
  or (discoverable and private.is_adult_discoverable(user_id))
 )
);
drop policy if exists learner_discovery_insert_self on public.learner_discovery_profiles;
create policy learner_discovery_insert_self on public.learner_discovery_profiles for insert to authenticated
with check(user_id=(select auth.uid())
 and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='learner' and r.status='active')
 and (not discoverable or private.is_adult_discoverable(user_id)));
drop policy if exists learner_discovery_update_self on public.learner_discovery_profiles;
create policy learner_discovery_update_self on public.learner_discovery_profiles for update to authenticated
using(user_id=(select auth.uid()) and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='learner' and r.status='active'))
with check(user_id=(select auth.uid())
 and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='learner' and r.status='active')
 and (not discoverable or private.is_adult_discoverable(user_id)));

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
 where auth.uid() is not null
 and exists(select 1 from public.user_roles me where me.user_id=auth.uid() and me.role='learner' and me.status='active')
 and d.user_id<>auth.uid() and d.discoverable=true
 and exists(select 1 from public.user_roles other_role where other_role.user_id=d.user_id and other_role.role='learner' and other_role.status='active')
 and private.is_adult_discoverable(d.user_id);
$$;
revoke all on function private.discoverable_learning_connections() from public,anon;
grant execute on function private.discoverable_learning_connections() to authenticated;
