drop policy if exists "enrolments_update_academy_owner" on public.enrolments;
revoke update on public.enrolments from authenticated;

drop policy if exists "courses_public_discovery" on public.courses;
create policy "courses_public_discovery" on public.courses for select to anon
using (publication_status = 'published' and exists (select 1 from public.academies a where a.id = academy_id and a.status = 'published'));

drop policy if exists "courses_select_published_or_manager" on public.courses;
create policy "courses_select_published_or_manager" on public.courses for select to authenticated
using ((publication_status = 'published' and exists (select 1 from public.academies a where a.id = academy_id and a.status = 'published')) or private.can_manage_academy(academy_id));

drop policy if exists "enrolments_insert_free_self" on public.enrolments;
create policy "enrolments_insert_free_self" on public.enrolments for insert to authenticated
with check (learner_id = (select auth.uid()) and status = 'active' and exists (
 select 1 from public.courses c join public.academies a on a.id = c.academy_id
 where c.id = course_id and c.publication_status = 'published' and a.status = 'published' and c.access_type = 'free'
));

drop policy if exists "progress_insert_enrolled_learner" on public.learning_progress;
create policy "progress_insert_enrolled_learner" on public.learning_progress for insert to authenticated
with check (learner_id = (select auth.uid()) and status in ('not_started','in_progress') and progress_percent < 100 and completed_at is null and exists (
 select 1 from public.lessons l join public.course_modules cm on cm.id = l.module_id join public.enrolments e on e.course_id = cm.course_id
 where l.id = lesson_id and e.learner_id = (select auth.uid()) and e.status = 'active'
));

create table public.assessment_question_keys (
 id uuid primary key default gen_random_uuid(),
 question_id uuid not null unique references public.assessment_questions(id) on delete cascade,
 correct_answer jsonb not null,
 marking_guidance jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.assessment_question_keys enable row level security;
create trigger assessment_question_keys_set_updated_at before update on public.assessment_question_keys for each row execute function private.set_updated_at();
create policy "question_keys_select_manager" on public.assessment_question_keys for select to authenticated using (
 exists (select 1 from public.assessment_questions q join public.assessments a on a.id=q.assessment_id join public.courses c on c.id=a.course_id where q.id=question_id and private.can_manage_academy(c.academy_id))
);
create policy "question_keys_insert_manager" on public.assessment_question_keys for insert to authenticated with check (
 exists (select 1 from public.assessment_questions q join public.assessments a on a.id=q.assessment_id join public.courses c on c.id=a.course_id where q.id=question_id and private.can_manage_academy(c.academy_id))
);
create policy "question_keys_update_manager" on public.assessment_question_keys for update to authenticated using (
 exists (select 1 from public.assessment_questions q join public.assessments a on a.id=q.assessment_id join public.courses c on c.id=a.course_id where q.id=question_id and private.can_manage_academy(c.academy_id))
) with check (
 exists (select 1 from public.assessment_questions q join public.assessments a on a.id=q.assessment_id join public.courses c on c.id=a.course_id where q.id=question_id and private.can_manage_academy(c.academy_id))
);
create policy "question_keys_delete_manager" on public.assessment_question_keys for delete to authenticated using (
 exists (select 1 from public.assessment_questions q join public.assessments a on a.id=q.assessment_id join public.courses c on c.id=a.course_id where q.id=question_id and private.can_manage_academy(c.academy_id))
);
