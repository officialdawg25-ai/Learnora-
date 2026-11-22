-- Organisation membership is meaningful only for an approved institution account.
create or replace function private.has_active_membership(p_organisation_id uuid,p_roles text[] default null)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null
 and exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role in ('institution','platform_admin') and r.status='active')
 and exists(select 1 from public.organisation_memberships m
  where m.organisation_id=p_organisation_id and m.user_id=auth.uid() and m.status='active'
  and (p_roles is null or m.role=any(p_roles)));
$$;

-- Academy management is limited to active educator/institution/admin roles.
create or replace function private.can_admin_academy(p_academy_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null
 and exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role in ('educator','institution','platform_admin') and r.status='active')
 and exists(select 1 from public.academies a where a.id=p_academy_id and (
  a.owner_user_id=auth.uid()
  or (a.organisation_id is not null and private.has_active_membership(a.organisation_id,array['owner','admin']))
  or exists(select 1 from public.academy_memberships am where am.academy_id=a.id and am.user_id=auth.uid() and am.status='active' and am.role='admin')
 ));
$$;

create or replace function private.can_manage_academy(p_academy_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null
 and exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role in ('educator','institution','platform_admin') and r.status='active')
 and exists(select 1 from public.academies a where a.id=p_academy_id and (
  a.owner_user_id=auth.uid()
  or (a.organisation_id is not null and private.has_active_membership(a.organisation_id,array['owner','admin','academic_manager']))
  or exists(select 1 from public.academy_memberships am where am.academy_id=a.id and am.user_id=auth.uid() and am.status='active' and am.role in ('admin','editor','instructor'))
 ));
$$;

create or replace function private.is_class_member(p_class_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null
 and exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='learner' and r.status='active')
 and exists(select 1 from public.class_memberships cm where cm.class_id=p_class_id and cm.user_id=auth.uid() and cm.status='active' and cm.role='learner');
$$;

create or replace function private.is_class_staff(p_class_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null
 and exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='educator' and r.status='active')
 and exists(select 1 from public.class_memberships cm where cm.class_id=p_class_id and cm.user_id=auth.uid() and cm.status='active' and cm.role in ('educator','assistant'));
$$;

drop policy if exists academies_update_owner on public.academies;
create policy academies_update_authorised_admin on public.academies for update to authenticated
using(private.can_admin_academy(id))
with check(private.can_admin_academy(id));

create or replace function private.guard_academy_identity()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.owner_user_id is distinct from old.owner_user_id or new.organisation_id is distinct from old.organisation_id then
  raise exception 'Academy ownership and institution association cannot be changed through ordinary editing.';
 end if;
 return new;
end;
$$;
drop trigger if exists guard_academy_identity on public.academies;
create trigger guard_academy_identity before update on public.academies
for each row execute function private.guard_academy_identity();

create or replace function private.guard_academy_membership_acceptance()
returns trigger language plpgsql set search_path=''
as $$
begin
 if auth.uid() is not null and old.user_id=auth.uid() and old.status='invited' and new.status='active' then
  if new.user_id is distinct from old.user_id or new.academy_id is distinct from old.academy_id or new.role is distinct from old.role then
   raise exception 'An invitation recipient cannot change the assigned academy role or identity.';
  end if;
  if not exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role in ('educator','institution') and r.status='active') then
   raise exception 'Only an approved educator or institution account can accept an academy staff invitation.';
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists guard_academy_membership_acceptance on public.academy_memberships;
create trigger guard_academy_membership_acceptance before update on public.academy_memberships
for each row execute function private.guard_academy_membership_acceptance();

create or replace function private.guard_class_membership_acceptance()
returns trigger language plpgsql set search_path=''
as $$
begin
 if auth.uid() is not null and old.user_id=auth.uid() and old.status='invited' and new.status='active' then
  if new.user_id is distinct from old.user_id or new.class_id is distinct from old.class_id or new.role is distinct from old.role then
   raise exception 'An invitation recipient cannot change the assigned class role or identity.';
  end if;
  if old.role='learner' and not exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='learner' and r.status='active') then
   raise exception 'A learner account is required to accept a learner class invitation.';
  end if;
  if old.role in ('educator','assistant') and not exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='educator' and r.status='active') then
   raise exception 'An approved educator account is required to accept an educator class invitation.';
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists guard_class_membership_acceptance on public.class_memberships;
create trigger guard_class_membership_acceptance before update on public.class_memberships
for each row execute function private.guard_class_membership_acceptance();
