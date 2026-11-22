create table if not exists public.institution_role_application_details (
 user_id uuid primary key references auth.users(id) on delete cascade,
 proposed_name text not null check(length(trim(proposed_name)) between 2 and 180),
 institution_type text not null check(length(trim(institution_type)) between 2 and 100),
 region text not null check(length(trim(region)) between 2 and 120),
 registration_reference text check(registration_reference is null or length(registration_reference)<=180),
 website_url text check(website_url is null or website_url ~ '^https://'),
 description text check(description is null or length(description)<=1500),
 submitted_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.institution_role_application_details enable row level security;
drop policy if exists institution_role_application_select_self_or_admin on public.institution_role_application_details;
create policy institution_role_application_select_self_or_admin on public.institution_role_application_details for select to authenticated
using(user_id=(select auth.uid()) or exists(select 1 from public.platform_administrators pa where pa.user_id=(select auth.uid()) and pa.status='active'));
drop policy if exists institution_role_application_insert_pending_self on public.institution_role_application_details;
create policy institution_role_application_insert_pending_self on public.institution_role_application_details for insert to authenticated
with check(user_id=(select auth.uid()) and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='institution' and r.status='pending'));
drop policy if exists institution_role_application_update_pending_self on public.institution_role_application_details;
create policy institution_role_application_update_pending_self on public.institution_role_application_details for update to authenticated
using(user_id=(select auth.uid()) and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='institution' and r.status='pending'))
with check(user_id=(select auth.uid()) and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='institution' and r.status='pending'));
grant select,insert,update on public.institution_role_application_details to authenticated;
