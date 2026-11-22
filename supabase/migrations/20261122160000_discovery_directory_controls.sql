-- Tighten directory editing and role approval invariants.
drop policy if exists institution_directory_manager_select on public.institution_directory_profiles;
create policy institution_directory_manager_select on public.institution_directory_profiles for select to authenticated
using(private.has_active_membership(organisation_id,array['owner','admin']));

create or replace function private.guard_educator_profile_update()
returns trigger language plpgsql set search_path=''
as $$
begin
  if auth.uid() is not null and auth.uid()=old.user_id then
    if new.verification_status is distinct from old.verification_status then
      raise exception 'Educator verification status is controlled by Learnora review.';
    end if;
    if old.verification_status <> 'verified' and new.public_profile then
      raise exception 'Only verified educators can publish a public profile.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_educator_profile_update on public.educator_profiles;
create trigger guard_educator_profile_update before update on public.educator_profiles
for each row execute function private.guard_educator_profile_update();

create or replace function private.guard_user_role_update()
returns trigger language plpgsql set search_path=''
as $$
begin
  if new.user_id is distinct from old.user_id or new.role is distinct from old.role then
    raise exception 'Account identity and role cannot be changed through a role status update.';
  end if;
  if new.role='educator' and new.status='active' and not exists(
    select 1 from public.educator_profiles ep where ep.user_id=new.user_id and ep.verification_status='verified'
  ) then
    raise exception 'Educator role requires verified educator credentials.';
  end if;
  if new.role='platform_admin' and new.status='active' and not exists(
    select 1 from public.platform_administrators pa where pa.user_id=new.user_id and pa.status='active'
  ) then
    raise exception 'Platform administrator access requires a separate active administrator assignment.';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_user_role_update on public.user_roles;
create trigger guard_user_role_update before update on public.user_roles
for each row execute function private.guard_user_role_update();
