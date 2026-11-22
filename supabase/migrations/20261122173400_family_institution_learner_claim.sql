create or replace function private.is_institution_staff_any_for_learner(p_learner_id uuid,p_allowed_roles text[])
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.organisation_memberships m
  join public.institution_classes ic on ic.organisation_id=m.organisation_id
  join public.class_memberships cm on cm.class_id=ic.id
  where m.user_id=auth.uid() and m.status='active' and m.role=any(p_allowed_roles)
   and cm.user_id=p_learner_id and cm.role='learner' and cm.status='active'
 );
$$;
revoke all on function private.is_institution_staff_any_for_learner(uuid,text[]) from public,anon;
grant execute on function private.is_institution_staff_any_for_learner(uuid,text[]) to authenticated;
create policy family_learner_details_institution_claim on public.family_learner_details for update to authenticated using(
 institution_id is null and private.is_institution_staff_any_for_learner(learner_user_id,array['owner','admin','educator','teacher','registrar'])
) with check(
 institution_id is not null and private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','educator','teacher','registrar'])
);
