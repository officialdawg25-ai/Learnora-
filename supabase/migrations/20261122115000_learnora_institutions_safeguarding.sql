-- Learnora institutional tenancy, class delivery and guardian safeguarding foundations.
create table public.institution_campuses (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.organisations(id) on delete cascade,
 name text not null,
 campus_code text,
 status text not null default 'active' check (status in ('active','inactive','archived')),
 created_at timestamptz not null default now(),
 unique(organisation_id,campus_code)
);
create table public.institution_departments (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.organisations(id) on delete cascade,
 campus_id uuid references public.institution_campuses(id) on delete set null,
 name text not null,
 created_at timestamptz not null default now(),
 unique(organisation_id,name,campus_id)
);
create table public.institution_classes (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.organisations(id) on delete cascade,
 campus_id uuid references public.institution_campuses(id) on delete set null,
 department_id uuid references public.institution_departments(id) on delete set null,
 name text not null,
 grade_or_level text,
 academic_year integer,
 status text not null default 'active' check (status in ('active','archived')),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(organisation_id,name,academic_year)
);
create table public.class_memberships (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.institution_classes(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null check (role in ('learner','educator','assistant')),
 status text not null default 'invited' check (status in ('invited','active','suspended','left')),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(class_id,user_id,role)
);
create table public.class_courses (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.institution_classes(id) on delete cascade,
 course_id uuid not null references public.courses(id) on delete cascade,
 assigned_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(class_id,course_id)
);
create table public.guardian_relationships (
 id uuid primary key default gen_random_uuid(),
 guardian_user_id uuid not null references public.profiles(id) on delete cascade,
 learner_user_id uuid not null references public.profiles(id) on delete cascade,
 relationship_type text not null check (relationship_type in ('parent','legal_guardian','caregiver')),
 status text not null default 'pending' check (status in ('pending','active','rejected','revoked','expired')),
 consent_scopes text[] not null default array['learning_progress','assessment_reports']::text[],
 consent_version text not null,
 evidence_reference text,
 verified_by uuid references public.profiles(id),
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 check (guardian_user_id<>learner_user_id),
 check (status<>'active' or (verified_by is not null and verified_at is not null))
);
create table public.safeguarding_cases (
 id uuid primary key default gen_random_uuid(),
 reporter_user_id uuid references public.profiles(id),
 subject_user_id uuid references public.profiles(id),
 organisation_id uuid references public.organisations(id),
 category text not null check (category in ('inappropriate_contact','harassment','bullying','unsafe_content','privacy','live_session','other')),
 severity text not null default 'standard' check (severity in ('standard','high','urgent')),
 description text not null check (length(description) between 10 and 10000),
 status text not null default 'open' check (status in ('open','triage','investigating','resolved','closed')),
 assigned_to uuid references public.profiles(id),
 resolution_notes text,
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);

create index institution_campuses_org_idx on public.institution_campuses(organisation_id);
create index institution_departments_org_idx on public.institution_departments(organisation_id);
create index institution_classes_org_year_idx on public.institution_classes(organisation_id,academic_year,status);
create index class_memberships_user_status_idx on public.class_memberships(user_id,status);
create index class_courses_course_idx on public.class_courses(course_id);
create index guardian_relationships_learner_status_idx on public.guardian_relationships(learner_user_id,status);
create index guardian_relationships_guardian_status_idx on public.guardian_relationships(guardian_user_id,status);
create index safeguarding_cases_status_created_idx on public.safeguarding_cases(status,severity,created_at);

alter table public.institution_campuses enable row level security;
alter table public.institution_departments enable row level security;
alter table public.institution_classes enable row level security;
alter table public.class_memberships enable row level security;
alter table public.class_courses enable row level security;
alter table public.guardian_relationships enable row level security;
alter table public.safeguarding_cases enable row level security;

grant select,insert,update on public.institution_campuses,public.institution_departments,public.institution_classes to authenticated;
grant select,insert on public.class_memberships,public.class_courses to authenticated;
grant select,insert on public.guardian_relationships to authenticated;
revoke all on public.safeguarding_cases from anon,authenticated;

create or replace function private.is_class_member(p_class_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
 select auth.uid() is not null and exists(select 1 from public.class_memberships cm
  where cm.class_id=p_class_id and cm.user_id=(select auth.uid()) and cm.status='active');
$function$;
create or replace function private.is_class_staff(p_class_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
 select auth.uid() is not null and exists(select 1 from public.class_memberships cm
  where cm.class_id=p_class_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role in ('educator','assistant'));
$function$;
revoke all on function private.is_class_member(uuid) from public,anon;
revoke all on function private.is_class_staff(uuid) from public,anon;
grant execute on function private.is_class_member(uuid),private.is_class_staff(uuid) to authenticated;

create policy institution_campuses_select_members on public.institution_campuses for select to authenticated
using(private.has_active_membership(organisation_id,null));
create policy institution_campuses_insert_admin on public.institution_campuses for insert to authenticated
with check(private.has_active_membership(organisation_id,array['owner','admin','academic_manager']));
create policy institution_campuses_update_admin on public.institution_campuses for update to authenticated
using(private.has_active_membership(organisation_id,array['owner','admin','academic_manager']))
with check(private.has_active_membership(organisation_id,array['owner','admin','academic_manager']));

create policy institution_departments_select_members on public.institution_departments for select to authenticated
using(private.has_active_membership(organisation_id,null));
create policy institution_departments_insert_admin on public.institution_departments for insert to authenticated
with check(private.has_active_membership(organisation_id,array['owner','admin','academic_manager']));
create policy institution_departments_update_admin on public.institution_departments for update to authenticated
using(private.has_active_membership(organisation_id,array['owner','admin','academic_manager']))
with check(private.has_active_membership(organisation_id,array['owner','admin','academic_manager']));

create policy institution_classes_select_members on public.institution_classes for select to authenticated
using(private.has_active_membership(organisation_id,null) or private.is_class_member(id));
create policy institution_classes_insert_admin on public.institution_classes for insert to authenticated
with check(created_by=(select auth.uid()) and private.has_active_membership(organisation_id,array['owner','admin','academic_manager','department_head']));
create policy institution_classes_update_admin on public.institution_classes for update to authenticated
using(private.has_active_membership(organisation_id,array['owner','admin','academic_manager','department_head']))
with check(private.has_active_membership(organisation_id,array['owner','admin','academic_manager','department_head']));

create policy class_memberships_select_self_or_staff on public.class_memberships for select to authenticated
using(user_id=(select auth.uid()) or exists(select 1 from public.institution_classes c where c.id=class_id and private.has_active_membership(c.organisation_id,array['owner','admin','academic_manager','department_head']))
or private.is_class_staff(class_id));
create policy class_memberships_insert_staff on public.class_memberships for insert to authenticated
with check(created_by=(select auth.uid()) and exists(select 1 from public.institution_classes c where c.id=class_id and private.has_active_membership(c.organisation_id,array['owner','admin','academic_manager','department_head'])));

create policy class_courses_select_members on public.class_courses for select to authenticated
using(private.is_class_member(class_id) or exists(select 1 from public.institution_classes c where c.id=class_id and private.has_active_membership(c.organisation_id,null)));
create policy class_courses_insert_admin on public.class_courses for insert to authenticated
with check(assigned_by=(select auth.uid()) and exists(select 1 from public.institution_classes c where c.id=class_id and private.has_active_membership(c.organisation_id,array['owner','admin','academic_manager','department_head'])));

create policy guardian_relationship_select_participants on public.guardian_relationships for select to authenticated
using(guardian_user_id=(select auth.uid()) or learner_user_id=(select auth.uid()));
create policy guardian_relationship_insert_guardian_pending on public.guardian_relationships for insert to authenticated
with check(guardian_user_id=(select auth.uid()) and status='pending' and verified_by is null and verified_at is null);

create policy safeguarding_cases_service_only on public.safeguarding_cases for all to service_role using(true) with check(true);

create or replace function private.guardian_has_scope(p_learner_id uuid,p_scope text)
returns boolean language sql stable security definer set search_path=''
as $function$
 select auth.uid() is not null and exists(
  select 1 from public.guardian_relationships g
  where g.guardian_user_id=(select auth.uid()) and g.learner_user_id=p_learner_id
   and g.status='active' and p_scope=any(g.consent_scopes)
 );
$function$;
revoke all on function private.guardian_has_scope(uuid,text) from public,anon;
grant execute on function private.guardian_has_scope(uuid,text) to authenticated;

create policy progress_select_authorised_guardian on public.learning_progress
for select to authenticated using (private.guardian_has_scope(learner_id,'learning_progress'));
create policy attempts_select_authorised_guardian on public.assessment_attempts
for select to authenticated using (private.guardian_has_scope(learner_id,'assessment_reports'));
create policy attempts_select_institution_staff on public.assessment_attempts
for select to authenticated using (
 exists(select 1 from public.assessments a
  join public.class_courses cc on cc.course_id=a.course_id
  join public.institution_classes ic on ic.id=cc.class_id
  where a.id=assessment_id and private.has_active_membership(ic.organisation_id,array['owner','admin','academic_manager','department_head']))
);

create or replace view public.institution_class_analytics
with (security_invoker=true)
as
select c.id as class_id,c.organisation_id,c.name,c.grade_or_level,c.academic_year,
 count(distinct cm.user_id) filter(where cm.role='learner' and cm.status='active') as active_learners,
 count(distinct cm.user_id) filter(where cm.role='educator' and cm.status='active') as active_educators,
 count(distinct cc.course_id) as assigned_courses,
 count(distinct aa.id) as assessment_attempts,
 round(avg(aa.score),2) as average_assessment_score
from public.institution_classes c
left join public.class_memberships cm on cm.class_id=c.id
left join public.class_courses cc on cc.class_id=c.id
left join public.assessments a on a.course_id=cc.course_id
left join public.assessment_attempts aa on aa.assessment_id=a.id and aa.status='graded'
where private.has_active_membership(c.organisation_id,array['owner','admin','academic_manager','department_head'])
group by c.id;
grant select on public.institution_class_analytics to authenticated;

comment on table public.guardian_relationships is 'Guardian access remains pending until independently verified. Learner data access must also check the requested consent scope.';
comment on table public.safeguarding_cases is 'Safeguarding case records are restricted to trusted server-side workflows and must never be exposed through ordinary client queries.';
