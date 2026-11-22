# Learnora implementation status

Updated: 2026-11-22

## Verified baseline

- GitHub repository was initially README-only on main.
- Supabase project is active, PostgreSQL 17, eu-west-1.
- Remote migration ledger currently reports six applied Learnora migrations; see [Supabase project notes](../../supabase/README.md).
- No Edge Functions were present at the latest verified audit.
- No application storage buckets were present at the initial audit.

## Implemented in the foundation branch

- React + TypeScript + Vite application shell.
- Responsive discovery, learner-space and educator-studio screens.
- Supabase email/password auth integration and auth profile bootstrap trigger.
- Published course discovery, subject filtering, free enrolment, academy creation and draft course creation.
- Core database domains for profiles, organisations, memberships, academies, courses, modules, lessons, enrolments, objectives, progress, assessments, attempts, assessment answer keys, AI usage metering and audit events.
- RLS enabled for all 16 current public tables.
- Private helper functions for organisation membership, academy management and paid/free course content access.
- Anonymous course/academy discovery limited to published records.
- Client update privileges removed from memberships, enrolments, progress and assessment attempts until server-controlled workflows are implemented.
- Assessment answer keys are stored separately from learner-visible question options and are educator-manager-only.
- Academy association requires appropriate organisation membership.
- Six remote migrations are recorded. The first two remote migrations still require exact source reconciliation into version control before this repository is the canonical migration source.

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
- Catalog inspection confirmed RLS enabled on all 16 current public tables.
- Supabase security advisor returned no findings after hardening.
- Performance advisor returned unused-index informational findings only; these are not reasons to remove indexes without workload evidence.
- No Edge Functions are deployed.
- A GitHub Actions TypeScript/Vite production build passed on a prior foundation-branch commit. Recheck CI on the latest head before merge.
- Browser/device and real-account workflow tests have not been run.
- No production deployment or production-readiness claim is made.

## Next required steps

1. Reconcile the exact source SQL for all six remote migrations; do not blindly reapply remote migrations.
2. Validate CI against the latest foundation branch head.
3. Configure the Supabase URL and publishable key in the deployment environment.
4. Test signup, email confirmation, signin, public course discovery, free enrolment, academy creation and draft-course creation with real test accounts in an approved test environment.
5. Implement lesson authoring/player and secure assessment RPCs before learner progress is exposed as mastery.
6. Implement educator verification, guardian consent and safeguarded institutional memberships before onboarding minors or institutions.
7. Implement verified payment workflows and an accounting ledger before enabling paid programmes.
