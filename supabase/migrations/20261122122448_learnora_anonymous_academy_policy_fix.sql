drop policy if exists academies_select_public_or_authorised_member on public.academies;

create policy academies_select_public
on public.academies
for select
to anon
using (status = 'published');

create policy academies_select_authenticated_owner_or_member
on public.academies
for select
to authenticated
using (
  status = 'published'
  or owner_user_id = (select auth.uid())
  or (
    organisation_id is not null
    and private.has_active_membership(organisation_id, null::text[])
  )
  or exists (
    select 1
    from public.academy_memberships am
    where am.academy_id = public.academies.id
      and am.user_id = (select auth.uid())
      and am.status in ('invited', 'active')
  )
);
