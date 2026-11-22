# Supabase project notes

Project reference: gkloowmlfxfrwcxggnzl.

Remote migration history verified through Supabase management tools:

- 20261122103407 — learnora_core_learning_foundation
- 20261122103505 — learnora_rls_hardening_and_auth_profiles
- 20261122104247 — learnora_public_discovery_and_privilege_restrictions
- 20261122104407 — learnora_index_and_academy_tenancy_fix
- 20261122104911 — learnora_assessment_key_and_progress_integrity
- 20261122104924 — learnora_course_visibility_and_assessment_key_grants
- 20261122105740 — learnora_least_privilege_grants

The first two migrations were applied remotely before the repository was populated and are not yet checked into this branch. Migrations 3–7 are tracked using their exact remote version numbers. Before running Supabase CLI push or treating this repository as canonical, pull and reconcile the exact first two remote migrations; do not recreate or reapply them blindly.

Anonymous table privileges are limited to published academy/course discovery. Authenticated users no longer have TRUNCATE/MAINTAIN/REFERENCES/TRIGGER privileges, and client updates/deletes are removed from enrolment, membership, progress and attempt records until audited server workflows exist. All current public tables have RLS enabled. The Supabase security advisor returned no findings after the latest hardening. The performance advisor reports only unused-index informational findings expected on a new, empty schema.
