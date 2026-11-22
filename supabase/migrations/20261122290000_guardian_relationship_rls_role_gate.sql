drop policy if exists guardian_relationship_insert_guardian_pending on public.guardian_relationships;
create policy guardian_relationship_insert_guardian_pending on public.guardian_relationships for insert to authenticated
with check(
 guardian_user_id=(select auth.uid())
 and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='parent_guardian' and r.status='active')
 and status='pending' and verified_by is null and verified_at is null
 and learner_consent_status='pending' and learner_consent_at is null
 and learner_consent_version is null and revoked_at is null and revoked_by is null
);
