-- Let invitees see the academy/class name without granting membership data or course access.
drop policy if exists academies_public_discovery on public.academies;
drop policy if exists academies_select_published_or_member on public.academies;
create policy academies_select_public_or_authorised_member on public.academies
for select to anon,authenticated using (
 status='published'
 or owner_user_id=(select auth.uid())
 or (organisation_id is not null and private.has_active_membership(organisation_id,null))
 or exists(select 1 from public.academy_memberships am where am.academy_id=id and am.user_id=(select auth.uid()) and am.status in ('invited','active'))
);

create or replace function private.has_class_invitation(p_class_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
 select auth.uid() is not null and exists(select 1 from public.class_memberships cm
  where cm.class_id=p_class_id and cm.user_id=(select auth.uid()) and cm.status='invited');
$function$;
revoke all on function private.has_class_invitation(uuid) from public,anon;
grant execute on function private.has_class_invitation(uuid) to authenticated;

drop policy if exists institution_classes_select_members on public.institution_classes;
create policy institution_classes_select_members on public.institution_classes
for select to authenticated using (
 private.has_active_membership(organisation_id,null)
 or private.is_class_member(id)
 or private.has_class_invitation(id)
);
