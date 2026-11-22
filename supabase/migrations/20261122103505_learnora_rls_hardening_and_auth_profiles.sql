
create or replace function private.has_active_membership(p_organisation_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.organisation_memberships m
    where m.organisation_id = p_organisation_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (p_roles is null or m.role = any(p_roles))
  );
$$;

create or replace function private.can_manage_academy(p_academy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.academies a
    where a.id = p_academy_id
      and (
        a.owner_user_id = (select auth.uid())
        or (a.organisation_id is not null and private.has_active_membership(a.organisation_id, array['owner','admin','academic_manager']))
      )
  );
$$;

create or replace function private.can_access_course_content(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.courses c
    where c.id = p_course_id
      and (
        private.can_manage_academy(c.academy_id)
        or (
          c.publication_status = 'published'
          and (
            c.access_type = 'free'
            or exists (
              select 1 from public.enrolments e
              where e.course_id = c.id
                and e.learner_id = (select auth.uid())
                and e.status = 'active'
            )
          )
        )
      )
  );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.has_active_membership(uuid, text[]) from public, anon;
revoke all on function private.can_manage_academy(uuid) from public, anon;
revoke all on function private.can_access_course_content(uuid) from public, anon;
revoke all on function private.handle_new_user() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_active_membership(uuid, text[]) to authenticated;
grant execute on function private.can_manage_academy(uuid) to authenticated;
grant execute on function private.can_access_course_content(uuid) to authenticated;

drop trigger if exists on_auth_user_created_learnora on auth.users;
create trigger on_auth_user_created_learnora
after insert on auth.users
for each row execute function private.handle_new_user();

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

drop policy if exists "organisations_select_members" on public.organisations;
create policy "organisations_select_members" on public.organisations for select to authenticated
using (private.has_active_membership(id, null));

drop policy if exists "organisations_update_admins" on public.organisations;
create policy "organisations_update_admins" on public.organisations for update to authenticated
using (private.has_active_membership(id, array['owner','admin']))
with check (private.has_active_membership(id, array['owner','admin']));

drop policy if exists "memberships_select_self_or_admin" on public.organisation_memberships;
create policy "memberships_select_self_or_admin" on public.organisation_memberships for select to authenticated
using (user_id = (select auth.uid()) or private.has_active_membership(organisation_id, array['owner','admin','academic_manager']));

drop policy if exists "memberships_update_admin" on public.organisation_memberships;
create policy "memberships_update_admin" on public.organisation_memberships for update to authenticated
using (private.has_active_membership(organisation_id, array['owner','admin']))
with check (private.has_active_membership(organisation_id, array['owner','admin']));

drop policy if exists "academies_select_published_or_owner" on public.academies;
create policy "academies_select_published_or_member" on public.academies for select to authenticated
using (status = 'published' or owner_user_id = (select auth.uid()) or (organisation_id is not null and private.has_active_membership(organisation_id, null)));

drop policy if exists "academies_update_owner" on public.academies;
create policy "academies_update_owner" on public.academies for update to authenticated
using (private.can_manage_academy(id))
with check (private.can_manage_academy(id));

drop policy if exists "courses_select_published_or_academy_owner" on public.courses;
create policy "courses_select_published_or_manager" on public.courses for select to authenticated
using (publication_status = 'published' or private.can_manage_academy(academy_id));

drop policy if exists "courses_insert_academy_owner" on public.courses;
create policy "courses_insert_academy_manager" on public.courses for insert to authenticated
with check (created_by = (select auth.uid()) and private.can_manage_academy(academy_id));

drop policy if exists "courses_update_academy_owner" on public.courses;
create policy "courses_update_academy_manager" on public.courses for update to authenticated
using (private.can_manage_academy(academy_id))
with check (private.can_manage_academy(academy_id));

drop policy if exists "modules_select_visible_course" on public.course_modules;
drop policy if exists "modules_manage_course_owner" on public.course_modules;
create policy "modules_select_accessible_course" on public.course_modules for select to authenticated
using (private.can_access_course_content(course_id));
create policy "modules_insert_manager" on public.course_modules for insert to authenticated
with check (exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id)));
create policy "modules_update_manager" on public.course_modules for update to authenticated
using (exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id)))
with check (exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id)));
create policy "modules_delete_manager" on public.course_modules for delete to authenticated
using (exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id)));

drop policy if exists "lessons_select_visible_course" on public.lessons;
drop policy if exists "lessons_manage_course_owner" on public.lessons;
create policy "lessons_select_accessible_course" on public.lessons for select to authenticated
using (exists (select 1 from public.course_modules cm where cm.id = module_id and private.can_access_course_content(cm.course_id)));
create policy "lessons_insert_manager" on public.lessons for insert to authenticated
with check (exists (select 1 from public.course_modules cm join public.courses c on c.id = cm.course_id where cm.id = module_id and private.can_manage_academy(c.academy_id)));
create policy "lessons_update_manager" on public.lessons for update to authenticated
using (exists (select 1 from public.course_modules cm join public.courses c on c.id = cm.course_id where cm.id = module_id and private.can_manage_academy(c.academy_id)))
with check (exists (select 1 from public.course_modules cm join public.courses c on c.id = cm.course_id where cm.id = module_id and private.can_manage_academy(c.academy_id)));
create policy "lessons_delete_manager" on public.lessons for delete to authenticated
using (exists (select 1 from public.course_modules cm join public.courses c on c.id = cm.course_id where cm.id = module_id and private.can_manage_academy(c.academy_id)));

drop policy if exists "objectives_select_published_or_owner" on public.learning_objectives;
drop policy if exists "objectives_manage_owner" on public.learning_objectives;
create policy "objectives_select_accessible_course" on public.learning_objectives for select to authenticated
using (private.can_access_course_content(course_id));
create policy "objectives_insert_manager" on public.learning_objectives for insert to authenticated
with check (exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id)));
create policy "objectives_update_manager" on public.learning_objectives for update to authenticated
using (exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id)))
with check (exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id)));
create policy "objectives_delete_manager" on public.learning_objectives for delete to authenticated
using (exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id)));

drop policy if exists "assessments_select_published_or_owner" on public.assessments;
drop policy if exists "assessments_manage_owner" on public.assessments;
create policy "assessments_select_accessible_course" on public.assessments for select to authenticated
using (publication_status = 'published' and private.can_access_course_content(course_id) or private.can_manage_academy((select c.academy_id from public.courses c where c.id = course_id)));
create policy "assessments_insert_manager" on public.assessments for insert to authenticated
with check (created_by = (select auth.uid()) and exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id)));
create policy "assessments_update_manager" on public.assessments for update to authenticated
using (exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id)))
with check (exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id)));
create policy "assessments_delete_manager" on public.assessments for delete to authenticated
using (exists (select 1 from public.courses c where c.id = course_id and private.can_manage_academy(c.academy_id)));

drop policy if exists "questions_select_published_or_owner" on public.assessment_questions;
drop policy if exists "questions_manage_owner" on public.assessment_questions;
create policy "questions_select_accessible_assessment" on public.assessment_questions for select to authenticated
using (exists (select 1 from public.assessments a where a.id = assessment_id and a.publication_status = 'published' and private.can_access_course_content(a.course_id))
or exists (select 1 from public.assessments a join public.courses c on c.id = a.course_id where a.id = assessment_id and private.can_manage_academy(c.academy_id)));
create policy "questions_insert_manager" on public.assessment_questions for insert to authenticated
with check (exists (select 1 from public.assessments a join public.courses c on c.id = a.course_id where a.id = assessment_id and private.can_manage_academy(c.academy_id)));
create policy "questions_update_manager" on public.assessment_questions for update to authenticated
using (exists (select 1 from public.assessments a join public.courses c on c.id = a.course_id where a.id = assessment_id and private.can_manage_academy(c.academy_id)))
with check (exists (select 1 from public.assessments a join public.courses c on c.id = a.course_id where a.id = assessment_id and private.can_manage_academy(c.academy_id)));
create policy "questions_delete_manager" on public.assessment_questions for delete to authenticated
using (exists (select 1 from public.assessments a join public.courses c on c.id = a.course_id where a.id = assessment_id and private.can_manage_academy(c.academy_id)));

drop policy if exists "progress_update_learner" on public.learning_progress;
create policy "progress_update_learner_incomplete" on public.learning_progress for update to authenticated
using (learner_id = (select auth.uid()) and status <> 'completed')
with check (learner_id = (select auth.uid()) and status in ('not_started','in_progress'));

drop policy if exists "attempts_update_learner_in_progress" on public.assessment_attempts;

create index if not exists assessments_course_idx on public.assessments(course_id);
create index if not exists assessments_created_by_idx on public.assessments(created_by);
create index if not exists assessment_attempts_graded_by_idx on public.assessment_attempts(graded_by);
create index if not exists audit_events_actor_idx on public.audit_events(actor_user_id);
create index if not exists courses_created_by_idx on public.courses(created_by);
create index if not exists learning_objectives_course_idx on public.learning_objectives(course_id);
create index if not exists learning_objectives_lesson_idx on public.learning_objectives(lesson_id);
create index if not exists learning_progress_lesson_idx on public.learning_progress(lesson_id);
create index if not exists organisations_created_by_idx on public.organisations(created_by);
