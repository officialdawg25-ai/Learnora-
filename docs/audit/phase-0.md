# Learnora — Phase 0 current-state audit

**Audit date:** 22 November 2026  
**GitHub repository:** `officialdawg25-ai/Learnora-`  
**Working branch:** `foundation/learnora-platform-v1`  
**Supabase project:** `gkloowmlfxfrwcxggnzl` — Learnora, eu-west-1, PostgreSQL 17

## Executive finding

The main branch began as a README-only repository. The linked Supabase project already contains a 15-table learning/organisation foundation and has since been extended through additional remote migrations. The active foundation branch contains a React/Vite app, initial educator and learner flows, SQL migration files, RLS hardening and CI.

The remote migration ledger is now ahead of the original source baseline. Do not run a blanket migration push or recreate the remote schema. Reconcile the exact remote history before treating the repository as the authoritative migration source.

## Verified current state

| Area | Finding | Status |
|---|---|---|
| GitHub main | README-only at initial audit | VERIFIED |
| Working branch | React/Vite foundation, learner discovery, free enrolment and educator academy/course drafts | VERIFIED |
| Supabase | ACTIVE_HEALTHY, PostgreSQL 17, eu-west-1 | VERIFIED |
| Remote migration ledger | Six migrations listed below | VERIFIED |
| Public tables | 16 tables, all with RLS enabled | VERIFIED |
| Auth users | Zero at initial audit; no test users were created by this audit | VERIFIED |
| Storage buckets | No application buckets at initial audit | VERIFIED |
| Edge Functions | None deployed at initial audit | VERIFIED |
| Security advisor | No findings returned after hardening | VERIFIED |
| Performance advisor | Unused-index informational findings only; no index removals justified without workload evidence | VERIFIED |
| CI | At least one GitHub Actions TypeScript/Vite production build completed successfully on the foundation branch; newer runs must be checked by exact commit before merge | VERIFIED / PARTIAL |
| Browser/device testing | Not demonstrated by CI | BLOCKED |
| Payment/AI/video/email providers | No operational provider integration established by the audit | BLOCKED |

## Remote Supabase migration history

The remote migration ledger reports:

1. `20261122103407 learnora_core_learning_foundation`
2. `20261122103505 learnora_rls_hardening_and_auth_profiles`
3. `20261122104247 learnora_public_discovery_and_privilege_restrictions`
4. `20261122104407 learnora_academy_tenancy_and_index_fix`
5. `20261122104911 learnora_assessment_key_and_progress_integrity`
6. `20261122104924 learnora_course_visibility_and_assessment_key_grants`\n7. `20261122105740 learnora_least_privilege_grants`

The repository's Supabase notes identify the first two as remotely applied before the repository was populated. Migrations 3–7 are tracked with their exact remote version IDs. Confirm the exact SQL for every remote version before any CLI migration deployment. A migration ledger entry alone is not the migration source.

## Current public database domains

The 16 current public tables are:

- Identity/tenancy: `profiles`, `organisations`, `organisation_memberships`, `academies`.
- Learning catalogue/delivery: `courses`, `course_modules`, `lessons`, `enrolments`, `learning_objectives`, `learning_progress`.
- Assessment: `assessments`, `assessment_questions`, `assessment_question_keys`, `assessment_attempts`.
- Intelligence/governance: `ai_activity`, `audit_events`.

All 16 have RLS enabled. The question-key table is separate from learner-visible question content and its observed policies are academy-manager scoped. This is an important improvement over exposing answer keys in question JSON.

## Existing security boundaries observed

- One Supabase Auth identity system; `profiles.id` references `auth.users.id`.
- Auth user creation invokes a profile bootstrap trigger.
- Organisation membership and academy ownership are represented in database records.
- Private helper functions govern active membership, academy management and course-content access.
- Published course/academy discovery is exposed through explicit anonymous read policies.
- Free self-enrolment is limited to published courses and active academies.
- Learner progress and assessment attempt updates are restricted; client-side attempts are constrained to enrolled learners and published assessments.
- Assessment answer keys are stored separately and only accessible to authorised academy managers.
- The Supabase security advisor returned no findings. Anonymous table privileges were reduced to SELECT on academies/courses; authenticated TRUNCATE/MAINTAIN/REFERENCES/TRIGGER were revoked, and client UPDATE/DELETE was removed from memberships, enrolments, progress and assessment attempts.

These controls are not a substitute for adversarial RLS tests. Test anonymous, learner A vs learner B, educator A vs academy B, institution A vs institution B, revoked membership, guardian scope, and direct REST/RPC access.

## Repository implementation observed

The active foundation branch includes:
- React, TypeScript and Vite.
- Supabase email/password authentication and profile bootstrap.
- Published course discovery and subject filtering.
- Free course enrolment.
- Academy creation and draft course creation.
- Responsive learner/discovery/educator-studio screens.
- Initial database migrations and RLS restrictions.
- GitHub Actions TypeScript/Vite build workflow.
- Foundation architecture and implementation status documentation.

The foundation is not the full product. The lesson authoring/player, secure assessment submission/marking workflows, AI gateway, payments/ledger, guardian/child controls, community/messaging, live classrooms, complete institution administration, credentials and opportunities remain future phases.

## High-priority gaps

1. Migration source reconciliation: exact remote SQL must be committed for all six applied versions.
2. RLS tests: create isolated test identities and prove negative access cases in a disposable/staging environment.
3. Assessment execution: implement server-authoritative attempt creation, deterministic marking, educator-reviewed subjective marking and immutable attempt history.
4. Learning evidence: progress is not mastery; build a competency/evidence model before academic claims.
5. Educator governance: verification states, evidence handling, appeals and suspension controls.
6. Child safeguarding: age-appropriate onboarding, guardian relationship/consent, communication restrictions, reporting and incident workflows.
7. Commerce: PayFast sandbox verification, idempotent webhook processing, double-entry ledger, refunds and reconciliation before paid enrolment.
8. AI: provider-independent server gateway, authorised retrieval, evaluation and cost controls; no live AI capability should be claimed until configured and tested.
9. Storage: private buckets, scoped policies, file validation, retention and authorised signed downloads.
10. Institution tenancy: explicit institution/campus/class hierarchy and cross-tenant negative tests.
11. Operations: backups, restore test, incident response, observability, accessibility and mobile UAT.

## Guardrails

- No production user/test data created during the audit.
- No production secrets read or exposed.
- No payment configuration changed.
- No destructive DDL or RLS policy changes performed in this audit.
- No indexes dropped because they are currently unused.
- No claim of accreditation, POPIA compliance or production readiness.
- No public release or merge is implied by the existence of a successful build.

## Next sequence

1. Reconcile and version-control all six remote migrations.
2. Validate the latest foundation branch CI against its current head commit.
3. Run real-account signup/confirmation/sign-in, discovery, free enrolment, academy creation and draft-course creation in a staging or approved test environment.
4. Add database/RLS integration tests before expanding data access.
5. Implement lesson authoring/player and secure assessment workflows.
6. Add educator verification and guardian safeguarding before onboarding minors.
7. Add PayFast sandbox and ledger only after financial workflow design and provider validation.
8. Continue AI, community, institutional and academic-record phases in dependency order.
