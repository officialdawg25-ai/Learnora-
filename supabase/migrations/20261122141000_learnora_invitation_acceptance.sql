-- Invitees can accept only their own pending membership; they cannot change roles or tenants.
revoke update on public.academy_memberships from authenticated;
grant update(status) on public.academy_memberships to authenticated;
drop policy if exists academy_memberships_update_manager on public.academy_memberships;
create policy academy_memberships_update_manager_or_accept on public.academy_memberships
for update to authenticated
using (private.can_admin_academy(academy_id) or (user_id=(select auth.uid()) and status='invited'))
with check (private.can_admin_academy(academy_id) or (user_id=(select auth.uid()) and status='active'));

revoke update on public.class_memberships from authenticated;
grant update(status) on public.class_memberships to authenticated;
create policy class_memberships_accept_own_invite on public.class_memberships
for update to authenticated
using(user_id=(select auth.uid()) and status='invited')
with check(user_id=(select auth.uid()) and status='active');
