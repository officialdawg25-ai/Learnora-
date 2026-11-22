drop index if exists public.organisation_memberships_user_status_idx;

drop policy if exists "academies_insert_owner" on public.academies;
create policy "academies_insert_owner_or_org_manager" on public.academies
for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and (
    organisation_id is null
    or private.has_active_membership(organisation_id, array['owner','admin'])
  )
);
