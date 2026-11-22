
create extension if not exists pgcrypto;

create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_path text,
  preferred_language text not null default 'en',
  country_code text not null default 'ZA',
  timezone text not null default 'Africa/Johannesburg',
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  organisation_type text not null check (organisation_type in ('school','university','college','training_provider','academy','corporate','non_profit','other')),
  country_code text not null default 'ZA',
  created_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organisation_memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','academic_manager','department_head','educator','assistant','learner','guardian','finance')),
  status text not null default 'active' check (status in ('invited','active','suspended','left')),
  created_at timestamptz not null default now(),
  unique (organisation_id, user_id)
);

create index organisation_memberships_user_idx on public.organisation_memberships(user_id, status);
create index organisation_memberships_org_role_idx on public.organisation_memberships(organisation_id, role, status);

create table public.academies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete set null,
  owner_user_id uuid not null references public.profiles(id),
  name text not null,
  slug text not null unique,
  description text,
  logo_path text,
  status text not null default 'draft' check (status in ('draft','published','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index academies_owner_idx on public.academies(owner_user_id);
create index academies_org_idx on public.academies(organisation_id);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  slug text not null,
  summary text,
  description text,
  subject text,
  education_level text,
  curriculum_framework text,
  language_code text not null default 'en',
  delivery_mode text not null default 'self_paced' check (delivery_mode in ('self_paced','live','blended','collaborative')),
  access_type text not null default 'free' check (access_type in ('free','paid','invitation')),
  price_minor bigint not null default 0 check (price_minor >= 0),
  currency char(3) not null default 'ZAR',
  publication_status text not null default 'draft' check (publication_status in ('draft','review','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, slug),
  check ((access_type = 'free' and price_minor = 0) or (access_type <> 'free'))
);

create index courses_academy_status_idx on public.courses(academy_id, publication_status);
create index courses_discovery_idx on public.courses(publication_status, subject, education_level);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null,
  lesson_type text not null default 'text' check (lesson_type in ('text','video','audio','interactive','live_recording','resource','activity')),
  content jsonb not null default '{}'::jsonb,
  resource_path text,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  position integer not null check (position >= 0),
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, position)
);

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('pending','active','completed','cancelled','refunded','suspended')),
  source text not null default 'self_service' check (source in ('self_service','institution','scholarship','admin','payment')),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (course_id, learner_id)
);

create index enrolments_learner_idx on public.enrolments(learner_id, status);
create index enrolments_course_idx on public.enrolments(course_id, status);

create table public.learning_objectives (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text not null,
  description text,
  competency_code text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  evidence jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, lesson_id)
);

create index learning_progress_learner_idx on public.learning_progress(learner_id, status);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  instructions text,
  assessment_type text not null default 'formative' check (assessment_type in ('formative','summative','practice','diagnostic')),
  settings jsonb not null default '{}'::jsonb,
  publication_status text not null default 'draft' check (publication_status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  question_type text not null check (question_type in ('multiple_choice','short_answer','long_answer','numeric','file_upload')),
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  rubric jsonb,
  points numeric(8,2) not null default 1 check (points >= 0),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (assessment_id, position)
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete restrict,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  status text not null default 'in_progress' check (status in ('in_progress','submitted','graded','voided')),
  answers jsonb not null default '{}'::jsonb,
  score numeric(8,2),
  feedback jsonb,
  submitted_at timestamptz,
  graded_at timestamptz,
  graded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (assessment_id, learner_id, attempt_number)
);

create index assessment_attempts_learner_idx on public.assessment_attempts(learner_id, created_at desc);

create table public.ai_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null check (capability in ('tutor','teacher','assessment','learning','language','academic')),
  provider text,
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_minor bigint check (estimated_cost_minor is null or estimated_cost_minor >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  outcome text not null default 'success' check (outcome in ('success','error','blocked','rate_limited')),
  created_at timestamptz not null default now()
);

create index ai_activity_user_idx on public.ai_activity(user_id, created_at desc);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  organisation_id uuid references public.organisations(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_org_idx on public.audit_events(organisation_id, created_at desc);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger organisations_set_updated_at before update on public.organisations for each row execute function private.set_updated_at();
create trigger academies_set_updated_at before update on public.academies for each row execute function private.set_updated_at();
create trigger courses_set_updated_at before update on public.courses for each row execute function private.set_updated_at();
create trigger course_modules_set_updated_at before update on public.course_modules for each row execute function private.set_updated_at();
create trigger lessons_set_updated_at before update on public.lessons for each row execute function private.set_updated_at();
create trigger learning_progress_set_updated_at before update on public.learning_progress for each row execute function private.set_updated_at();
create trigger assessments_set_updated_at before update on public.assessments for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.organisation_memberships enable row level security;
alter table public.academies enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.enrolments enable row level security;
alter table public.learning_objectives enable row level security;
alter table public.learning_progress enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.ai_activity enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles_select_self" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_self" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "organisations_select_members" on public.organisations for select to authenticated
using (exists (select 1 from public.organisation_memberships m where m.organisation_id = id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "organisations_insert_creator" on public.organisations for insert to authenticated with check (created_by = (select auth.uid()));
create policy "organisations_update_admins" on public.organisations for update to authenticated
using (exists (select 1 from public.organisation_memberships m where m.organisation_id = id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner','admin')))
with check (exists (select 1 from public.organisation_memberships m where m.organisation_id = id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner','admin')));

create policy "memberships_select_self_or_admin" on public.organisation_memberships for select to authenticated
using (user_id = (select auth.uid()) or exists (select 1 from public.organisation_memberships a where a.organisation_id = organisation_id and a.user_id = (select auth.uid()) and a.status = 'active' and a.role in ('owner','admin','academic_manager')));
create policy "memberships_insert_self_owner" on public.organisation_memberships for insert to authenticated
with check (user_id = (select auth.uid()) and role = 'owner' and exists (select 1 from public.organisations o where o.id = organisation_id and o.created_by = (select auth.uid())));
create policy "memberships_update_admin" on public.organisation_memberships for update to authenticated
using (exists (select 1 from public.organisation_memberships a where a.organisation_id = organisation_id and a.user_id = (select auth.uid()) and a.status = 'active' and a.role in ('owner','admin')))
with check (exists (select 1 from public.organisation_memberships a where a.organisation_id = organisation_id and a.user_id = (select auth.uid()) and a.status = 'active' and a.role in ('owner','admin')));

create policy "academies_select_published_or_owner" on public.academies for select to authenticated
using (status = 'published' or owner_user_id = (select auth.uid()) or (organisation_id is not null and exists (select 1 from public.organisation_memberships m where m.organisation_id = academies.organisation_id and m.user_id = (select auth.uid()) and m.status = 'active')));
create policy "academies_insert_owner" on public.academies for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy "academies_update_owner" on public.academies for update to authenticated
using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));

create policy "courses_select_published_or_academy_owner" on public.courses for select to authenticated
using (publication_status = 'published' or exists (select 1 from public.academies a where a.id = academy_id and (a.owner_user_id = (select auth.uid()) or (a.organisation_id is not null and exists (select 1 from public.organisation_memberships m where m.organisation_id = a.organisation_id and m.user_id = (select auth.uid()) and m.status = 'active')))));
create policy "courses_insert_academy_owner" on public.courses for insert to authenticated
with check (created_by = (select auth.uid()) and exists (select 1 from public.academies a where a.id = academy_id and a.owner_user_id = (select auth.uid())));
create policy "courses_update_academy_owner" on public.courses for update to authenticated
using (exists (select 1 from public.academies a where a.id = academy_id and a.owner_user_id = (select auth.uid())))
with check (exists (select 1 from public.academies a where a.id = academy_id and a.owner_user_id = (select auth.uid())));

create policy "modules_select_visible_course" on public.course_modules for select to authenticated
using (exists (select 1 from public.courses c where c.id = course_id and (c.publication_status = 'published' or exists (select 1 from public.academies a where a.id = c.academy_id and a.owner_user_id = (select auth.uid())))));
create policy "modules_manage_course_owner" on public.course_modules for all to authenticated
using (exists (select 1 from public.courses c join public.academies a on a.id = c.academy_id where c.id = course_id and a.owner_user_id = (select auth.uid())))
with check (exists (select 1 from public.courses c join public.academies a on a.id = c.academy_id where c.id = course_id and a.owner_user_id = (select auth.uid())));

create policy "lessons_select_visible_course" on public.lessons for select to authenticated
using (exists (select 1 from public.course_modules cm join public.courses c on c.id = cm.course_id where cm.id = module_id and (c.publication_status = 'published' or exists (select 1 from public.academies a where a.id = c.academy_id and a.owner_user_id = (select auth.uid())))));
create policy "lessons_manage_course_owner" on public.lessons for all to authenticated
using (exists (select 1 from public.course_modules cm join public.courses c on c.id = cm.course_id join public.academies a on a.id = c.academy_id where cm.id = module_id and a.owner_user_id = (select auth.uid())))
with check (exists (select 1 from public.course_modules cm join public.courses c on c.id = cm.course_id join public.academies a on a.id = c.academy_id where cm.id = module_id and a.owner_user_id = (select auth.uid())));

create policy "enrolments_select_learner_or_academy_owner" on public.enrolments for select to authenticated
using (learner_id = (select auth.uid()) or exists (select 1 from public.courses c join public.academies a on a.id = c.academy_id where c.id = course_id and a.owner_user_id = (select auth.uid())));
create policy "enrolments_insert_free_self" on public.enrolments for insert to authenticated
with check (learner_id = (select auth.uid()) and status = 'active' and exists (select 1 from public.courses c where c.id = course_id and c.publication_status = 'published' and c.access_type = 'free'));
create policy "enrolments_update_academy_owner" on public.enrolments for update to authenticated
using (exists (select 1 from public.courses c join public.academies a on a.id = c.academy_id where c.id = course_id and a.owner_user_id = (select auth.uid())))
with check (exists (select 1 from public.courses c join public.academies a on a.id = c.academy_id where c.id = course_id and a.owner_user_id = (select auth.uid())));

create policy "objectives_select_published_or_owner" on public.learning_objectives for select to authenticated
using (exists (select 1 from public.courses c where c.id = course_id and (c.publication_status = 'published' or exists (select 1 from public.academies a where a.id = c.academy_id and a.owner_user_id = (select auth.uid())))));
create policy "objectives_manage_owner" on public.learning_objectives for all to authenticated
using (exists (select 1 from public.courses c join public.academies a on a.id = c.academy_id where c.id = course_id and a.owner_user_id = (select auth.uid())))
with check (exists (select 1 from public.courses c join public.academies a on a.id = c.academy_id where c.id = course_id and a.owner_user_id = (select auth.uid())));

create policy "progress_select_learner_or_owner" on public.learning_progress for select to authenticated
using (learner_id = (select auth.uid()) or exists (select 1 from public.lessons l join public.course_modules cm on cm.id = l.module_id join public.courses c on c.id = cm.course_id join public.academies a on a.id = c.academy_id where l.id = lesson_id and a.owner_user_id = (select auth.uid())));
create policy "progress_insert_enrolled_learner" on public.learning_progress for insert to authenticated
with check (learner_id = (select auth.uid()) and exists (select 1 from public.lessons l join public.course_modules cm on cm.id = l.module_id join public.enrolments e on e.course_id = cm.course_id where l.id = lesson_id and e.learner_id = (select auth.uid()) and e.status = 'active'));
create policy "progress_update_learner" on public.learning_progress for update to authenticated
using (learner_id = (select auth.uid())) with check (learner_id = (select auth.uid()));

create policy "assessments_select_published_or_owner" on public.assessments for select to authenticated
using (publication_status = 'published' or exists (select 1 from public.courses c join public.academies a on a.id = c.academy_id where c.id = course_id and a.owner_user_id = (select auth.uid())));
create policy "assessments_manage_owner" on public.assessments for all to authenticated
using (exists (select 1 from public.courses c join public.academies a on a.id = c.academy_id where c.id = course_id and a.owner_user_id = (select auth.uid())))
with check (exists (select 1 from public.courses c join public.academies a on a.id = c.academy_id where c.id = course_id and a.owner_user_id = (select auth.uid())));

create policy "questions_select_published_or_owner" on public.assessment_questions for select to authenticated
using (exists (select 1 from public.assessments a where a.id = assessment_id and (a.publication_status = 'published' or exists (select 1 from public.courses c join public.academies ac on ac.id = c.academy_id where c.id = a.course_id and ac.owner_user_id = (select auth.uid())))));
create policy "questions_manage_owner" on public.assessment_questions for all to authenticated
using (exists (select 1 from public.assessments a join public.courses c on c.id = a.course_id join public.academies ac on ac.id = c.academy_id where a.id = assessment_id and ac.owner_user_id = (select auth.uid())))
with check (exists (select 1 from public.assessments a join public.courses c on c.id = a.course_id join public.academies ac on ac.id = c.academy_id where a.id = assessment_id and ac.owner_user_id = (select auth.uid())));

create policy "attempts_select_learner_or_owner" on public.assessment_attempts for select to authenticated
using (learner_id = (select auth.uid()) or exists (select 1 from public.assessments a join public.courses c on c.id = a.course_id join public.academies ac on ac.id = c.academy_id where a.id = assessment_id and ac.owner_user_id = (select auth.uid())));
create policy "attempts_insert_learner" on public.assessment_attempts for insert to authenticated
with check (learner_id = (select auth.uid()) and status = 'in_progress' and exists (select 1 from public.assessments a join public.courses c on c.id = a.course_id join public.enrolments e on e.course_id = c.id where a.id = assessment_id and a.publication_status = 'published' and e.learner_id = (select auth.uid()) and e.status = 'active'));
create policy "attempts_update_learner_in_progress" on public.assessment_attempts for update to authenticated
using (learner_id = (select auth.uid()) and status = 'in_progress') with check (learner_id = (select auth.uid()) and status in ('in_progress','submitted'));

create policy "ai_activity_select_self" on public.ai_activity for select to authenticated using (user_id = (select auth.uid()));
create policy "audit_events_select_actor" on public.audit_events for select to authenticated using (actor_user_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
