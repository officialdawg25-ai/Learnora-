-- Index remaining foreign keys and consolidate overlapping SELECT policies.
create index if not exists ai_messages_user_idx on public.ai_messages(user_id);
create index if not exists class_courses_assigned_by_idx on public.class_courses(assigned_by);
create index if not exists class_memberships_created_by_idx on public.class_memberships(created_by);
create index if not exists competencies_parent_idx on public.competencies(parent_competency_id);
create index if not exists competency_frameworks_org_idx on public.competency_frameworks(organisation_id);
create index if not exists competency_prerequisites_prereq_idx on public.competency_prerequisites(prerequisite_competency_id);
create index if not exists credentials_academy_idx on public.credentials(academy_id);
create index if not exists credentials_course_idx on public.credentials(course_id);
create index if not exists credentials_issuer_org_idx on public.credentials(issuer_organisation_id);
create index if not exists educator_earnings_academy_idx on public.educator_earnings(academy_id);
create index if not exists guardian_relationships_verified_by_idx on public.guardian_relationships(verified_by);
create index if not exists institution_classes_campus_idx on public.institution_classes(campus_id);
create index if not exists institution_classes_created_by_idx on public.institution_classes(created_by);
create index if not exists institution_classes_department_idx on public.institution_classes(department_id);
create index if not exists institution_departments_campus_idx on public.institution_departments(campus_id);
create index if not exists knowledge_sources_created_by_idx on public.knowledge_sources(created_by);
create index if not exists knowledge_sources_org_idx on public.knowledge_sources(organisation_id);
create index if not exists competency_evidence_attempt_idx on public.learner_competency_evidence(assessment_attempt_id);
create index if not exists competency_evidence_competency_idx on public.learner_competency_evidence(competency_id);
create index if not exists competency_evidence_verified_by_idx on public.learner_competency_evidence(verified_by);
create index if not exists competency_mastery_competency_idx on public.learner_competency_mastery(competency_id);
create index if not exists opportunity_saves_opportunity_idx on public.learner_opportunity_saves(opportunity_id);
create index if not exists ledger_accounts_owner_idx on public.ledger_accounts(owner_user_id);
create index if not exists settlement_batches_imported_by_idx on public.payment_settlement_batches(imported_by);
create index if not exists refunds_payment_idx on public.refunds(payment_transaction_id);
create index if not exists refunds_requested_by_idx on public.refunds(requested_by);
create index if not exists safeguarding_cases_assigned_idx on public.safeguarding_cases(assigned_to);
create index if not exists safeguarding_cases_org_idx on public.safeguarding_cases(organisation_id);
create index if not exists safeguarding_cases_reporter_idx on public.safeguarding_cases(reporter_user_id);
create index if not exists safeguarding_cases_subject_idx on public.safeguarding_cases(subject_user_id);

drop policy if exists attempts_select_learner_or_owner on public.assessment_attempts;
drop policy if exists attempts_select_authorised_guardian on public.assessment_attempts;
drop policy if exists attempts_select_institution_staff on public.assessment_attempts;
drop policy if exists attempts_select_academy_team on public.assessment_attempts;
create policy attempts_select_authorised_context on public.assessment_attempts
for select to authenticated using (
 learner_id=(select auth.uid())
 or private.guardian_has_scope(learner_id,'assessment_reports')
 or exists(select 1 from public.assessments a join public.courses c on c.id=a.course_id
   where a.id=assessment_id and private.can_manage_academy(c.academy_id))
 or exists(select 1 from public.assessments a join public.class_courses cc on cc.course_id=a.course_id
   join public.institution_classes ic on ic.id=cc.class_id
   where a.id=assessment_id and private.has_active_membership(ic.organisation_id,array['owner','admin','academic_manager','department_head']))
);

drop policy if exists enrolments_select_learner_or_academy_owner on public.enrolments;
drop policy if exists enrolments_select_academy_team on public.enrolments;
create policy enrolments_select_learner_or_academy_team on public.enrolments
for select to authenticated using (
 learner_id=(select auth.uid())
 or exists(select 1 from public.courses c where c.id=course_id and private.can_manage_academy(c.academy_id))
);

drop policy if exists knowledge_sources_select_authorised on public.knowledge_sources;
drop policy if exists knowledge_sources_select_owner_drafts on public.knowledge_sources;
create policy knowledge_sources_select_authorised_or_owner_draft on public.knowledge_sources
for select to authenticated using (
 (publication_status='draft' and created_by=(select auth.uid()))
 or (publication_status='published' and (
  access_scope='public'
  or (course_id is not null and private.can_access_course_content(course_id))
  or (organisation_id is not null and private.has_active_membership(organisation_id,null))
  or (access_scope='academy_private' and course_id is not null and exists(select 1 from public.courses c where c.id=course_id and private.can_manage_academy(c.academy_id)))
 ))
);

drop policy if exists knowledge_chunks_select_authorised on public.knowledge_chunks;
drop policy if exists knowledge_chunks_select_owner_drafts on public.knowledge_chunks;
create policy knowledge_chunks_select_authorised_or_owner_draft on public.knowledge_chunks
for select to authenticated using (
 exists(select 1 from public.knowledge_sources s where s.id=source_id and (
  (s.publication_status='draft' and s.created_by=(select auth.uid()))
  or (s.publication_status='published' and (
   s.access_scope='public'
   or (s.course_id is not null and private.can_access_course_content(s.course_id))
   or (s.organisation_id is not null and private.has_active_membership(s.organisation_id,null))
   or (s.access_scope='academy_private' and s.course_id is not null and exists(select 1 from public.courses c where c.id=s.course_id and private.can_manage_academy(c.academy_id)))
  ))
 ))
);

drop policy if exists progress_select_learner_or_owner on public.learning_progress;
drop policy if exists progress_select_authorised_guardian on public.learning_progress;
create policy progress_select_authorised_context on public.learning_progress
for select to authenticated using (
 learner_id=(select auth.uid())
 or private.guardian_has_scope(learner_id,'learning_progress')
 or exists(select 1 from public.lessons l join public.course_modules cm on cm.id=l.module_id
   join public.courses c on c.id=cm.course_id where l.id=lesson_id and private.can_manage_academy(c.academy_id))
);
