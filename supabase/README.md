# Supabase project notes

Project reference: gkloowmlfxfrwcxggnzl.

Remote migration history verified through Supabase management tools:

- 20261122103407 — learnora_core_learning_foundation
- 20261122103505 — learnora_rls_hardening_and_auth_profiles
- 20261122104247 — learnora_public_discovery_and_privilege_restrictions
- 20261122104407 — learnora_index_and_academy_tenancy_fix

The first two migrations were applied remotely before the repository was populated and are not yet checked into this branch. The last two migration SQL files are tracked using their exact remote version numbers. Before running Supabase CLI push or treating this repository as canonical, pull and reconcile the exact first two remote migrations; do not recreate or reapply them blindly.

Run security and performance advisors after schema changes. Current security advisor is clear. Performance advisor currently reports only unused indexes expected on a newly created schema.
