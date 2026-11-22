drop policy if exists "memberships_update_admin" on public.organisation_memberships;
drop policy if exists "progress_update_learner_incomplete" on public.learning_progress;
revoke update on public.organisation_memberships from authenticated;
revoke update on public.assessment_attempts from authenticated;
revoke update on public.learning_progress from authenticated;

create policy "academies_public_discovery" on public.academies for select to anon using (status = 'published');
create policy "courses_public_discovery" on public.courses for select to anon using (publication_status = 'published');
grant select on public.academies, public.courses to anon;

create index if not exists organisation_memberships_user_status_idx on public.organisation_memberships(user_id, status);
create index if not exists enrolments_learner_course_status_idx on public.enrolments(learner_id, course_id, status);
create index if not exists learning_progress_learner_lesson_idx on public.learning_progress(learner_id, lesson_id);
