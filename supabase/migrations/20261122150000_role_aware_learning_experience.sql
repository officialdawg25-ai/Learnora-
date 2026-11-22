-- Learnora role-aware access, safe discovery, learning spaces and live-class scheduling.
-- Applied to the Learnora staging Supabase project before being committed here.
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('learner','parent_guardian','educator','institution','platform_admin')),
  status text not null default 'pending' check (status in ('active','pending','rejected','suspended')),
  source text not null default 'self_service' check (source in ('self_service','verified_legacy','administrator')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique(user_id, role)
);
create index if not exists user_roles_user_status_idx on public.user_roles(user_id,status);
alter table public.user_roles enable row level security;
drop policy if exists user_roles_select_self_or_admin on public.user_roles;
create policy user_roles_select_self_or_admin on public.user_roles for select to authenticated
using (user_id=(select auth.uid()) or exists(select 1 from public.platform_administrators pa where pa.user_id=(select auth.uid()) and pa.status='active'));
drop policy if exists user_roles_admin_update on public.user_roles;
create policy user_roles_admin_update on public.user_roles for update to authenticated
using (exists(select 1 from public.platform_administrators pa where pa.user_id=(select auth.uid()) and pa.status='active'))
with check (exists(select 1 from public.platform_administrators pa where pa.user_id=(select auth.uid()) and pa.status='active'));
revoke all on public.user_roles from anon, authenticated;
grant select, update on public.user_roles to authenticated;

create or replace function public.request_learnora_role(p_role text)
returns table(requested_role text, role_status text)
language plpgsql security definer set search_path=''
as $$
declare v_user uuid := auth.uid(); v_status text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_role not in ('learner','parent_guardian','educator','institution') then raise exception 'Unsupported account role'; end if;
  v_status := case when p_role in ('learner','parent_guardian') then 'active' else 'pending' end;
  insert into public.user_roles(user_id,role,status,source) values(v_user,p_role,v_status,'self_service')
  on conflict(user_id,role) do nothing;
  return query select ur.role,ur.status from public.user_roles ur where ur.user_id=v_user and ur.role=p_role;
end;
$$;
revoke all on function public.request_learnora_role(text) from public, anon;
grant execute on function public.request_learnora_role(text) to authenticated;

insert into public.user_roles(user_id,role,status,source)
select p.id,'learner','active','verified_legacy' from public.profiles p on conflict(user_id,role) do nothing;
insert into public.user_roles(user_id,role,status,source)
select ep.user_id,'educator','active','verified_legacy' from public.educator_profiles ep where ep.verification_status='verified' on conflict(user_id,role) do nothing;
insert into public.user_roles(user_id,role,status,source)
select om.user_id,'institution','active','verified_legacy' from public.organisation_memberships om
where om.status='active' and om.role in ('owner','admin','academic_manager','department_head') on conflict(user_id,role) do nothing;
insert into public.user_roles(user_id,role,status,source)
select distinct gr.guardian_user_id,'parent_guardian','active','verified_legacy' from public.guardian_relationships gr
where gr.status='active' and gr.revoked_at is null on conflict(user_id,role) do nothing;
insert into public.user_roles(user_id,role,status,source)
select pa.user_id,'platform_admin','active','administrator' from public.platform_administrators pa where pa.status='active'
on conflict(user_id,role) do nothing;

create or replace function private.is_adult_discoverable(p_user_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.profiles p where p.id=p_user_id and p.date_of_birth is not null
    and p.date_of_birth <= (current_date - interval '18 years'));
$$;
revoke all on function private.is_adult_discoverable(uuid) from public, anon;
grant execute on function private.is_adult_discoverable(uuid) to authenticated;

alter table public.educator_profiles add column if not exists public_display_name text,
  add column if not exists teaching_levels text[] not null default '{}',
  add column if not exists public_region text;

create table if not exists public.institution_directory_profiles (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  display_name text not null check(length(trim(display_name)) between 2 and 160),
  description text, region text, public_listing boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.institution_directory_profiles enable row level security;
drop policy if exists institution_directory_public_select on public.institution_directory_profiles;
create policy institution_directory_public_select on public.institution_directory_profiles for select to authenticated
using(public_listing and exists(select 1 from public.organisations o where o.id=organisation_id and o.status='active'));
drop policy if exists institution_directory_manager_insert on public.institution_directory_profiles;
create policy institution_directory_manager_insert on public.institution_directory_profiles for insert to authenticated
with check(private.has_active_membership(organisation_id,array['owner','admin']));
drop policy if exists institution_directory_manager_update on public.institution_directory_profiles;
create policy institution_directory_manager_update on public.institution_directory_profiles for update to authenticated
using(private.has_active_membership(organisation_id,array['owner','admin']))
with check(private.has_active_membership(organisation_id,array['owner','admin']));
grant select,insert,update on public.institution_directory_profiles to authenticated;

create table if not exists public.learner_discovery_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check(length(trim(display_name)) between 1 and 100),
  bio text check(bio is null or length(bio)<=500),
  subjects text[] not null default '{}', interests text[] not null default '{}',
  education_level text, discoverable boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists learner_discovery_subjects_idx on public.learner_discovery_profiles using gin(subjects);
create index if not exists learner_discovery_interests_idx on public.learner_discovery_profiles using gin(interests);
alter table public.learner_discovery_profiles enable row level security;
drop policy if exists learner_discovery_select_self_or_opted_adult on public.learner_discovery_profiles;
create policy learner_discovery_select_self_or_opted_adult on public.learner_discovery_profiles for select to authenticated
using(user_id=(select auth.uid()) or (discoverable and private.is_adult_discoverable(user_id)));
drop policy if exists learner_discovery_insert_self on public.learner_discovery_profiles;
create policy learner_discovery_insert_self on public.learner_discovery_profiles for insert to authenticated
with check(user_id=(select auth.uid()) and (not discoverable or private.is_adult_discoverable(user_id)));
drop policy if exists learner_discovery_update_self on public.learner_discovery_profiles;
create policy learner_discovery_update_self on public.learner_discovery_profiles for update to authenticated
using(user_id=(select auth.uid()))
with check(user_id=(select auth.uid()) and (not discoverable or private.is_adult_discoverable(user_id)));
grant select,insert,update on public.learner_discovery_profiles to authenticated;

create table if not exists public.learning_spaces (
  id uuid primary key default gen_random_uuid(),
  space_type text not null check(space_type in ('community','study_group')),
  title text not null check(length(trim(title)) between 3 and 140),
  description text, subject text, education_level text,
  visibility text not null default 'public' check(visibility in ('public','private')),
  status text not null default 'active' check(status in ('draft','active','suspended','archived')),
  owner_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists learning_spaces_directory_idx on public.learning_spaces(space_type,status,visibility,created_at desc);
create table if not exists public.learning_space_memberships (
  space_id uuid not null references public.learning_spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check(role in ('owner','moderator','member')),
  status text not null default 'active' check(status in ('invited','active','suspended','left')),
  created_at timestamptz not null default now(), primary key(space_id,user_id)
);
alter table public.learning_spaces enable row level security;
alter table public.learning_space_memberships enable row level security;
drop policy if exists learning_spaces_select_public_or_member on public.learning_spaces;
create policy learning_spaces_select_public_or_member on public.learning_spaces for select to authenticated
using((status='active' and visibility='public') or owner_user_id=(select auth.uid()) or exists(select 1 from public.learning_space_memberships m where m.space_id=id and m.user_id=(select auth.uid()) and m.status='active'));
drop policy if exists learning_spaces_insert_owner on public.learning_spaces;
create policy learning_spaces_insert_owner on public.learning_spaces for insert to authenticated
with check(owner_user_id=(select auth.uid()) and (space_type='study_group' or exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role in ('educator','platform_admin') and r.status='active')));
drop policy if exists learning_spaces_update_owner on public.learning_spaces;
create policy learning_spaces_update_owner on public.learning_spaces for update to authenticated
using(owner_user_id=(select auth.uid())) with check(owner_user_id=(select auth.uid()));
drop policy if exists learning_space_memberships_select_self_or_owner on public.learning_space_memberships;
create policy learning_space_memberships_select_self_or_owner on public.learning_space_memberships for select to authenticated
using(user_id=(select auth.uid()) or exists(select 1 from public.learning_spaces s where s.id=space_id and s.owner_user_id=(select auth.uid())));
drop policy if exists learning_space_memberships_insert_join on public.learning_space_memberships;
create policy learning_space_memberships_insert_join on public.learning_space_memberships for insert to authenticated
with check((user_id=(select auth.uid()) and role='member' and exists(select 1 from public.learning_spaces s where s.id=space_id and s.status='active' and s.visibility='public'))
 or (user_id=(select auth.uid()) and role='owner' and exists(select 1 from public.learning_spaces s where s.id=space_id and s.owner_user_id=(select auth.uid()))));
drop policy if exists learning_space_memberships_update_self_leave on public.learning_space_memberships;
create policy learning_space_memberships_update_self_leave on public.learning_space_memberships for update to authenticated
using(user_id=(select auth.uid()) and role='member') with check(user_id=(select auth.uid()) and role='member' and status='left');
grant select,insert,update on public.learning_spaces,public.learning_space_memberships to authenticated;

create table if not exists public.live_class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.institution_classes(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  educator_user_id uuid not null references public.profiles(id),
  title text not null check(length(trim(title)) between 3 and 180),
  description text, scheduled_start timestamptz not null, scheduled_end timestamptz not null,
  status text not null default 'scheduled' check(status in ('scheduled','live','completed','cancelled','rescheduled')),
  meeting_url text check(meeting_url is null or meeting_url ~ '^https://'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), check(scheduled_end>scheduled_start)
);
create index if not exists live_class_sessions_class_start_idx on public.live_class_sessions(class_id,scheduled_start);
alter table public.live_class_sessions enable row level security;
drop policy if exists live_class_sessions_select_class_members on public.live_class_sessions;
create policy live_class_sessions_select_class_members on public.live_class_sessions for select to authenticated
using(private.is_class_member(class_id) or private.is_class_staff(class_id) or exists(select 1 from public.platform_administrators pa where pa.user_id=(select auth.uid()) and pa.status='active'));
drop policy if exists live_class_sessions_insert_class_staff on public.live_class_sessions;
create policy live_class_sessions_insert_class_staff on public.live_class_sessions for insert to authenticated
with check(created_by=(select auth.uid()) and educator_user_id=(select auth.uid()) and private.is_class_staff(class_id));
drop policy if exists live_class_sessions_update_class_staff on public.live_class_sessions;
create policy live_class_sessions_update_class_staff on public.live_class_sessions for update to authenticated
using(created_by=(select auth.uid()) and private.is_class_staff(class_id))
with check(created_by=(select auth.uid()) and educator_user_id=(select auth.uid()) and private.is_class_staff(class_id));
grant select,insert,update on public.live_class_sessions to authenticated;

-- Public institution directory is curated separately from private organisation records.
create or replace function private.is_active_public_org(p_org_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.organisations o where o.id=p_org_id and o.status='active') $$;
revoke all on function private.is_active_public_org(uuid) from public,anon;
grant execute on function private.is_active_public_org(uuid) to authenticated;
drop policy if exists institution_directory_public_select on public.institution_directory_profiles;
create policy institution_directory_public_select on public.institution_directory_profiles for select to authenticated
using(public_listing and private.is_active_public_org(organisation_id));

-- Replace permissive legacy creator policies with verified role checks.
drop policy if exists academies_insert_owner_or_org_manager on public.academies;
drop policy if exists academies_insert_authorised_educator_or_institution on public.academies;
create policy academies_insert_authorised_educator_or_institution on public.academies for insert to authenticated
with check(owner_user_id=(select auth.uid()) and (
 (organisation_id is null and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='educator' and r.status='active'))
 or (organisation_id is not null and private.has_active_membership(organisation_id,array['owner','admin']) and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='institution' and r.status='active'))
));
drop policy if exists courses_insert_academy_manager on public.courses;
drop policy if exists courses_insert_authorised_educator_or_institution on public.courses;
create policy courses_insert_authorised_educator_or_institution on public.courses for insert to authenticated
with check(created_by=(select auth.uid()) and private.can_manage_academy(academy_id) and exists(
 select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.status='active' and r.role in ('educator','institution','platform_admin')
));
drop policy if exists organisations_insert_creator on public.organisations;
drop policy if exists organisations_insert_authorised_institution on public.organisations;
create policy organisations_insert_authorised_institution on public.organisations for insert to authenticated
with check(created_by=(select auth.uid()) and exists(
 select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role in ('institution','platform_admin') and r.status='active'
));
drop policy if exists memberships_insert_self_owner on public.organisation_memberships;
drop policy if exists memberships_insert_authorised_owner on public.organisation_memberships;
create policy memberships_insert_authorised_owner on public.organisation_memberships for insert to authenticated
with check(user_id=(select auth.uid()) and role='owner'
 and exists(select 1 from public.organisations o where o.id=organisation_id and o.created_by=(select auth.uid()))
 and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role in ('institution','platform_admin') and r.status='active')
);
