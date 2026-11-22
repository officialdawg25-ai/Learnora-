-- Platform governance identity. No browser role assignment or self-promotion.
create table public.platform_administrators (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 role text not null check(role in ('platform_owner','platform_admin','academic_reviewer','trust_safety','finance_admin')),
 permissions text[] not null default '{}'::text[],
 status text not null default 'active' check(status in ('active','suspended')),
 assigned_by uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
alter table public.platform_administrators enable row level security;
grant select on public.platform_administrators to authenticated;
revoke insert,update,delete on public.platform_administrators from anon,authenticated;
create policy platform_admin_select_self on public.platform_administrators
for select to authenticated using(user_id=(select auth.uid()));
create index platform_admin_status_idx on public.platform_administrators(status,role);
