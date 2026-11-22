-- Learnora educator operations: verification, academy teams, immutable course snapshots,
-- publication review queue and privacy-safe educator analytics.
create table if not exists public.educator_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  professional_bio text,
  teaching_experience_years integer check (teaching_experience_years is null or teaching_experience_years between 0 and 80),
  teaching_languages text[] not null default array['en']::text[],
  subjects text[] not null default '{}'::text[],
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','more_information_required','suspended','rejected')),
  public_profile boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.educator_verification_submissions (
  id uuid primary key default gen_random_uuid(),
  educator_user_id uuid not null references public.profiles(id) on delete cascade,
  credential_type text not null,
  issuer text,
  credential_reference text,
  document_storage_path text,
  notes text,
  status text not null default 'pending'
    check (status in ('pending','verified','more_information_required','rejected')),
  reviewer_user_id uuid references public.profiles(id),
  reviewer_notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (reviewed_at is null or reviewer_user_id is not null)
);

create table if not exists public.academy_memberships (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin','editor','instructor','analyst')),
  status text not null default 'invited' check (status in ('invited','active','suspended','left')),
  invited_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id,user_id)
);

create table if not exists public.course_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (course_id,version_number)
);

create table if not exists public.publication_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','approved','changes_requested','rejected','withdrawn')),
  reviewer_user_id uuid references public.profiles(id),
  reviewer_notes text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists academy_memberships_user_status_idx on public.academy_memberships(user_id,status);
create index if not exists course_versions_course_created_idx on public.course_versions(course_id,created_at desc);
create index if not exists publication_reviews_status_requested_idx on public.publication_reviews(status,requested_at desc);
create index if not exists educator_verification_status_idx on public.educator_profiles(verification_status);

alter table public.educator_profiles enable row level security;
alter table public.educator_verification_submissions enable row level security;
alter table public.academy_memberships enable row level security;
alter table public.course_versions enable row level security;
alter table public.publication_reviews enable row level security;

grant select, insert, update on public.educator_profiles to authenticated;
grant select, insert on public.educator_verification_submissions to authenticated;
grant select, insert, update on public.academy_memberships to authenticated;
grant select on public.course_versions to authenticated;
grant select, insert on public.publication_reviews to authenticated;

create policy educator_profiles_select_self_or_public_verified on public.educator_profiles
for select to authenticated using (
  user_id = (select auth.uid()) or (public_profile and verification_status = 'verified')
);
create policy educator_profiles_insert_self on public.educator_profiles
for insert to authenticated with check (
  user_id = (select auth.uid())
  and verification_status = 'unverified'
  and public_profile = false
);
create policy educator_profiles_update_self on public.educator_profiles
for update to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function private.prevent_self_verification_change()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if auth.role() <> 'service_role'
     and new.verification_status is distinct from old.verification_status then
    raise exception 'Educator verification status is controlled by the verification review process' using errcode='42501';
  end if;
  return new;
end;
$function$;
create trigger educator_verification_status_guard
before update on public.educator_profiles
for each row execute function private.prevent_self_verification_change();

create policy educator_verification_select_owner on public.educator_verification_submissions
for select to authenticated using (educator_user_id = (select auth.uid()));
create policy educator_verification_insert_owner on public.educator_verification_submissions
for insert to authenticated with check (educator_user_id = (select auth.uid()) and status = 'pending' and reviewer_user_id is null and reviewed_at is null);

create policy academy_memberships_select_member_or_manager on public.academy_memberships
for select to authenticated using (
  user_id = (select auth.uid()) or private.can_manage_academy(academy_id)
);
create or replace function private.can_admin_academy(p_academy_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select auth.uid() is not null and exists (
    select 1 from public.academies a
    where a.id=p_academy_id and (
      a.owner_user_id=(select auth.uid())
      or (a.organisation_id is not null and private.has_active_membership(a.organisation_id,array['owner','admin']))
      or exists (select 1 from public.academy_memberships am where am.academy_id=a.id
        and am.user_id=(select auth.uid()) and am.status='active' and am.role='admin')
    )
  );
$function$;

create policy academy_memberships_insert_manager on public.academy_memberships
for insert to authenticated with check (
  private.can_admin_academy(academy_id)
  and invited_by = (select auth.uid())
  and role in ('admin','editor','instructor','analyst')
);
create policy academy_memberships_update_manager on public.academy_memberships
for update to authenticated using (private.can_admin_academy(academy_id))
with check (private.can_admin_academy(academy_id));

create policy course_versions_select_manager on public.course_versions
for select to authenticated using (
  exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id))
);

create policy publication_reviews_select_manager on public.publication_reviews
for select to authenticated using (
  exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id))
);
create policy publication_reviews_insert_manager on public.publication_reviews
for insert to authenticated with check (
  requested_by = (select auth.uid())
  and status = 'pending'
  and reviewer_user_id is null
  and exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id))
);

-- Extend academy authorisation to named team members, without granting learner or analyst editing rights.
create or replace function private.can_manage_academy(p_academy_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $function$
  select auth.uid() is not null and exists (
    select 1 from public.academies a
    where a.id = p_academy_id
      and (
        a.owner_user_id = (select auth.uid())
        or (a.organisation_id is not null and private.has_active_membership(a.organisation_id, array['owner','admin','academic_manager']))
        or exists (
          select 1 from public.academy_memberships am
          where am.academy_id = a.id
            and am.user_id = (select auth.uid())
            and am.status = 'active'
            and am.role in ('admin','editor','instructor')
        )
      )
  );
$function$;

create or replace function private.snapshot_course(p_course_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $function$
declare
  v_version integer;
  v_snapshot jsonb;
begin
  if not exists (select 1 from public.courses c where c.id = p_course_id) then
    return;
  end if;
  select coalesce(max(cv.version_number),0)+1 into v_version
  from public.course_versions cv where cv.course_id = p_course_id;

  select jsonb_build_object(
    'course', to_jsonb(c),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'module',to_jsonb(cm),
        'lessons',coalesce((
          select jsonb_agg(to_jsonb(l) order by l.position,l.created_at)
          from public.lessons l where l.module_id=cm.id
        ),'[]'::jsonb)
      ) order by cm.position,cm.created_at)
      from public.course_modules cm where cm.course_id=c.id
    ),'[]'::jsonb)
  ) into v_snapshot
  from public.courses c where c.id=p_course_id;

  insert into public.course_versions(course_id,version_number,snapshot,created_by)
  values (p_course_id,v_version,v_snapshot,auth.uid());
end;
$function$;

revoke all on function private.snapshot_course(uuid) from public, anon, authenticated;
revoke all on function private.capture_course_version_from_content() from public, anon, authenticated;
grant execute on function private.can_admin_academy(uuid) to authenticated;

create or replace function public.submit_course_for_review(p_course_id uuid)
returns uuid
language plpgsql security invoker
set search_path = ''
as $function$
declare v_review_id uuid;
begin
  if not private.can_manage_academy((select c.academy_id from public.courses c where c.id=p_course_id)) then
    raise exception 'Not authorised to submit this course for review' using errcode='42501';
  end if;
  update public.courses set publication_status='review',updated_at=now() where id=p_course_id;
  insert into public.publication_reviews(course_id,requested_by)
  values(p_course_id,(select auth.uid())) returning id into v_review_id;
  return v_review_id;
end;
$function$;
revoke all on function public.submit_course_for_review(uuid) from public, anon;
grant execute on function public.submit_course_for_review(uuid) to authenticated;

-- Snapshot on content changes. The version row is immutable to client roles.
create or replace function private.capture_course_version_from_content()
returns trigger
language plpgsql security definer
set search_path = ''
as $function$
declare v_course_id uuid;
begin
  if tg_op='DELETE' then
    if tg_table_name='courses' then
      return old;
    elsif tg_table_name='course_modules' then
      v_course_id := old.course_id;
    else
      select cm.course_id into v_course_id from public.course_modules cm where cm.id=old.module_id;
    end if;
  else
    if tg_table_name='courses' then
      v_course_id := new.id;
    elsif tg_table_name='course_modules' then
      v_course_id := new.course_id;
    else
      select cm.course_id into v_course_id from public.course_modules cm where cm.id=new.module_id;
    end if;
  end if;
  perform private.snapshot_course(v_course_id);
  if tg_op='DELETE' then return old; else return new; end if;
end;
$function$;

drop trigger if exists courses_snapshot_after_change on public.courses;
create trigger courses_snapshot_after_change
after insert or update on public.courses
for each row execute function private.capture_course_version_from_content();
drop trigger if exists modules_snapshot_after_change on public.course_modules;
create trigger modules_snapshot_after_change
after insert or update on public.course_modules
for each row execute function private.capture_course_version_from_content();
drop trigger if exists lessons_snapshot_after_change on public.lessons;
create trigger lessons_snapshot_after_change
after insert or update on public.lessons
for each row execute function private.capture_course_version_from_content();

create trigger educator_profiles_updated_at before update on public.educator_profiles
for each row execute function private.set_updated_at();
create trigger academy_memberships_updated_at before update on public.academy_memberships
for each row execute function private.set_updated_at();

create or replace view public.educator_course_analytics
with (security_invoker=true)
as
select
  c.id as course_id,
  c.academy_id,
  c.title,
  c.publication_status,
  c.created_at,
  count(distinct e.id) filter (where e.status in ('active','completed')) as total_enrolments,
  count(distinct e.id) filter (where e.status='active') as active_learners,
  count(distinct e.id) filter (where e.status='completed') as completed_learners,
  case when count(distinct e.id) filter (where e.status in ('active','completed'))=0 then 0
    else round(100.0 * count(distinct e.id) filter (where e.status='completed') /
      count(distinct e.id) filter (where e.status in ('active','completed')),2) end as completion_rate_percent
from public.courses c
left join public.enrolments e on e.course_id=c.id
where private.can_manage_academy(c.academy_id)
group by c.id;

grant select on public.educator_course_analytics to authenticated;

comment on table public.educator_verification_submissions is 'Verification evidence metadata only. Store files in a private bucket and keep review decisions server-controlled.';
comment on table public.course_versions is 'Immutable snapshots preserve prior course content for audit and learner historical context.';
comment on view public.educator_course_analytics is 'Descriptive enrolment and completion metrics; not an AI judgement of teaching quality.';
