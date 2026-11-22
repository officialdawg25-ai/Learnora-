# Learnora — Phase 0 verified technical baseline

**Audit date:** 22 November 2026  
**Git branch audited:** `main`  
**Supabase project:** `gkloowmlfxfrwcxggnzl` (Learnora, eu-west-1, PostgreSQL 17)  
**Repository:** `officialdawg25-ai/Learnora-`

## Executive summary

The Supabase project contains an initial, RLS-protected learning and organisation schema. The GitHub repository is effectively uninitialised: it contains only an 11-byte README. The database is active and empty of application records. Empty tables are treated as a legitimate new-project state, not a defect.

The first implementation must establish a real frontend against the existing database, not create a second data model or replace the existing project.

## Evidence and classification

| Area | Finding | Classification |
|---|---|---|
| GitHub repository | Exists, public, default branch `main`, repository size 0 KB; root contains only README.md (11 bytes) | VERIFIED |
| Supabase project | Learnora project ref `gkloowmlfxfrwcxggnzl`, ACTIVE_HEALTHY, PostgreSQL 17.12, eu-west-1 | VERIFIED |
| Database migrations | Two Learnora migrations: `20261122103407 learnora_core_learning_foundation`, `20261122103505 learnora_rls_hardening_and_auth_profiles` | VERIFIED |
| Public application tables | 15 tables, all have RLS enabled | VERIFIED |
| Application data | All 15 public application tables report 0 rows | VERIFIED |
| Auth users | 0 rows in `auth.users` | VERIFIED |
| Storage | No application storage buckets | VERIFIED |
| Edge Functions | No deployed Supabase Edge Functions | VERIFIED |
| Security advisor | No findings returned | VERIFIED |
| Performance advisor | 21 unused-index notices; not automatic defects and must not be dropped without workload evidence | VERIFIED |
| Auth profile creation | `auth.users` insert trigger calls `private.handle_new_user()`, creating a profile | VERIFIED |
| Updated-at triggers | Present on profiles, organisations, academies, courses, modules, lessons, progress and assessments | VERIFIED |
| Existing frontend/deployment | No frontend source or deployment configuration found in repository root | VERIFIED |
| Live payment, AI, video, email integrations | No deployed Edge Functions; provider configuration not established by this audit | PARTIAL / BLOCKED |

## Existing public database model

The following 15 tables already exist and must be reused:

1. `profiles` — user profile linked to `auth.users`.
2. `organisations` — school, university, college, provider, academy, corporate or non-profit organisation.
3. `organisation_memberships` — user membership and role within an organisation.
4. `academies` — educator-owned or organisation-associated learning academy.
5. `courses` — course catalogue and publication/access configuration.
6. `course_modules` — ordered course modules.
7. `lessons` — text, video, audio, interactive, recording, resource and activity lessons.
8. `enrolments` — learner-to-course enrolment.
9. `learning_objectives` — course/lesson learning objectives.
10. `learning_progress` — learner lesson progress and evidence.
11. `assessments` — formative, summative, practice and diagnostic assessments.
12. `assessment_questions` — question definitions and rubrics.
13. `assessment_attempts` — learner attempts, answers, score and feedback.
14. `ai_activity` — AI capability/provider/model/token/cost/latency/outcome usage records.
15. `audit_events` — actor, organisation, action and resource audit events.

The existing schema includes constraints, foreign keys, uniqueness constraints, indexes, updated-at triggers and private helper functions. It is a foundation, not a completed domain model.

## Existing security controls observed

- RLS is enabled on every public application table.
- Policies exist for profile self-access, organisation memberships, academy management, published course access, enrolment, lesson/module/objective access, learner progress, assessment attempts and AI activity.
- Private security-definer helpers use an empty search path for core membership/course access checks.
- Authenticated user creation has a profile bootstrap trigger.
- No security-advisor lint findings were returned.

## Security and product gaps requiring follow-up

1. No guardian relationship or consent model exists.
2. No dedicated educator verification workflow/profile exists.
3. No institution campus/department/class hierarchy exists.
4. No programme/framework/qualification/credential model exists.
5. No commercial ledger, orders, refunds, subscriptions or educator settlement model exists.
6. No community, messaging, moderation or live-session domain exists.
7. No knowledge-source/chunk, AI conversation, evaluation or provider configuration domain exists.
8. No storage buckets exist; upload policies and retention cannot yet be assessed.
9. No Edge Functions exist; privileged operations and external integrations are not implemented.
10. Current profile read policy is self-only; public educator/academy discovery must be designed without weakening profile privacy.
11. Current enrolment/progress/assessment flows require adversarial RLS testing before public launch.
12. Unused-index notices should be reviewed after real query workloads exist, not treated as instructions to remove indexes.

## Existing RLS policy posture

The audit observed table-specific policies on all 15 public tables. Notable boundaries include:

- Profiles: self insert/select/update.
- Organisations: creator insert, member select, owner/admin update.
- Memberships: self owner bootstrap, self/admin select, admin update.
- Academies: owner insert, published/member select, manager update.
- Courses and content: published or authorised academy manager access.
- Enrolments: self-enrolment for published free courses; learner/academy-owner read.
- Learning progress: active enrolment required for learner writes; learner/academy-owner reads; completed progress is not learner-editable.
- Assessment attempts: active enrolment and published assessment required for learner attempt creation; learner/academy-owner read.
- AI activity: self read.
- Audit events: actor read.

This is a policy inventory, not proof that all cross-tenant and IDOR scenarios are safe. Automated RLS tests remain required.

## Immediate decisions

- Keep the current Supabase project and existing public tables.
- Keep one Supabase Auth identity with contextual memberships.
- Use a modular monolith initially.
- Work on a dedicated implementation branch, not `main`.
- Do not create production data or test users in the live project.
- Do not create payment, AI or video credentials or claim integrations are operational.
- Extend the schema only through reviewed, forward-only migrations.
- Preserve existing RLS policies unless a tested migration explicitly changes them.

## Audit limitations

This audit verified GitHub metadata and repository root, Supabase project metadata, public table definitions, RLS policy inventory, selected database functions/triggers, migration history, storage buckets, Edge Functions and advisor output. It did not inspect a deployed website, Cloudflare configuration, provider dashboards, secret values, complete legal compliance, real learner workflows or production traffic. Those items remain BLOCKED or PARTIAL until evidence is available.
