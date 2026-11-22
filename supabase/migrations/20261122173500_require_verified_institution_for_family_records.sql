create or replace function private.is_institution_staff_for_learner(p_learner_id uuid,p_institution_id uuid,p_allowed_roles text[])
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id and o.status='active'
  join public.institution_classes ic on ic.organisation_id=m.organisation_id
  join public.class_memberships cm on cm.class_id=ic.id
  where m.user_id=auth.uid() and m.organisation_id=p_institution_id and m.status='active'
   and m.role=any(p_allowed_roles) and cm.user_id=p_learner_id and cm.role='learner' and cm.status='active'
 );
$$;
create or replace function private.is_institution_staff_any_for_learner(p_learner_id uuid,p_allowed_roles text[])
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id and o.status='active'
  join public.institution_classes ic on ic.organisation_id=m.organisation_id
  join public.class_memberships cm on cm.class_id=ic.id
  where m.user_id=auth.uid() and m.status='active' and m.role=any(p_allowed_roles)
   and cm.user_id=p_learner_id and cm.role='learner' and cm.status='active'
 );
$$;
