drop policy if exists learning_spaces_insert_owner on public.learning_spaces;
create policy learning_spaces_insert_owner on public.learning_spaces for insert to authenticated
with check(owner_user_id=(select auth.uid()) and (
 (space_type='study_group' and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='learner' and r.status='active'))
 or (space_type='community' and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role in ('educator','platform_admin') and r.status='active'))
));
drop policy if exists learning_space_memberships_insert_join on public.learning_space_memberships;
create policy learning_space_memberships_insert_join on public.learning_space_memberships for insert to authenticated
with check(
 (user_id=(select auth.uid()) and role='member'
  and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role in ('learner','educator') and r.status='active')
  and exists(select 1 from public.learning_spaces s where s.id=space_id and s.status='active' and s.visibility='public'))
 or (user_id=(select auth.uid()) and role='owner'
  and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role in ('learner','educator') and r.status='active')
  and exists(select 1 from public.learning_spaces s where s.id=space_id and s.owner_user_id=(select auth.uid())))
);
create or replace function private.guard_learning_space_identity()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.owner_user_id is distinct from old.owner_user_id or new.space_type is distinct from old.space_type then
  raise exception 'Learning space ownership and type cannot be changed after creation.';
 end if;
 return new;
end;
$$;
drop trigger if exists guard_learning_space_identity on public.learning_spaces;
create trigger guard_learning_space_identity before update on public.learning_spaces
for each row execute function private.guard_learning_space_identity();
