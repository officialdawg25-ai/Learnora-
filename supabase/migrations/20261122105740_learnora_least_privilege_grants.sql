-- Keep anonymous access to published academy/course discovery only.
revoke all privileges on all tables in schema public from anon;
grant select on public.academies, public.courses to anon;

-- Remove administrative table privileges that are not needed by application users.
revoke truncate, references, trigger, maintain on all tables in schema public from authenticated;

-- Learner and membership lifecycle writes must move through audited server workflows.
revoke update, delete on public.organisation_memberships from authenticated;
revoke update, delete on public.enrolments from authenticated;
revoke update, delete on public.learning_progress from authenticated;
revoke update, delete on public.assessment_attempts from authenticated;
