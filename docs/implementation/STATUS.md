# Learnora implementation status

Updated: 2026-11-22

## Verified baseline

- GitHub repository was initially README-only on main.
- Supabase project is active, PostgreSQL 17, and initially had no public tables or migration history.
- No Edge Functions were present at audit time.

## Implemented in the foundation branch

- React + TypeScript + Vite application shell.
- Responsive discovery, learner-space and educator-studio screens.
- Supabase email/password auth integration and auth profile bootstrap trigger.
- Published course discovery, free enrolment, academy creation and draft course creation.
- Core database domains for profiles, organisations, memberships, academies, courses, modules, lessons, enrolments, objectives, progress, assessments, attempts, AI usage metering and audit events.
- RLS enabled for every current public table.
- Private helper functions for organisation membership, academy management and paid/free course content access.
- Anonymous course/academy discovery limited to published records.
- Client update privileges removed from memberships, progress and assessment attempts until server-controlled workflows are implemented.
- Academy association requires appropriate organisation membership.

## Explicitly not implemented

- No live AI gateway/provider integration or curriculum retrieval.
- No PayFast checkout, webhook verification, ledger, refunds or educator payouts.
- No guardian/child relationship workflow or completed safeguarding operations.
- No communities, posts, messaging or live classroom services.
- No complete institutional administration UI or SIS integrations.
- No competency mastery engine, credentials or verified opportunity feeds.
- No module/lesson authoring UI, lesson player, assessment submission/marking workflow or publish review workflow.

## Verification status

- Supabase migration applications returned success.
- Catalog inspection confirmed RLS enabled on all 15 current public tables.
- Supabase security advisor returned no findings after hardening.
- Performance advisor returned only unused-index informational findings after duplicate-index remediation.
- No Edge Functions are deployed.
- Frontend build and browser/device tests have not been run because this execution used remote GitHub file operations and did not have a local repository checkout/runtime.

## Next required steps

1. Reconcile the initial remote migration into version-controlled SQL with Supabase CLI.
2. Clone/check out this branch, install pinned dependencies and run the production build.
3. Configure Vite Supabase URL and publishable key in deployment secrets.
4. Test signup, email confirmation, signin, public course discovery, free enrolment and educator academy/course creation with real test accounts.
5. Implement lesson authoring/player and secure assessment RPCs before learner progress is exposed.
6. Implement educator verification, guardian consent and safeguarded institutional memberships before onboarding minors or institutions.
7. Implement verified payment workflows and an accounting ledger before enabling paid programmes.
