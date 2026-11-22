-- Explicitly document that these sensitive indexes are backend-only.
create policy learner_login_usernames_backend_only on public.learner_login_usernames for all to anon,authenticated using(false) with check(false);
create policy family_audit_events_backend_only on public.family_audit_events for all to anon,authenticated using(false) with check(false);
