# Learnora — Foundation architecture

## System shape

Start with a modular monolith (React/Vite + Supabase/Postgres). Introduce separately deployed workers only when workload, reliability or security boundaries justify them.

## Domains in the first database foundation

1. Identity and profiles
2. Organisations and memberships
3. Academies and educator ownership
4. Courses, modules and lessons
5. Enrolments and learning progress
6. Learning objectives
7. Assessments and attempts
8. AI activity metering
9. Audit events

## Security model

- Supabase Auth is the single identity provider.
- Profiles are keyed to auth.users.id.
- Roles are represented by organisation memberships, not user-editable metadata.
- Public discovery is limited to published course records.
- Academy management is restricted to owners or authorised institutional managers.
- Learner progress and attempts are scoped to the learner and relevant academy manager.
- Every public-schema table has RLS enabled.
- Private helper functions use a fixed empty search path and narrowly granted execution.
- No service-role key is accepted by the browser.

## Learning model

course → course_modules → lessons

Learning objectives attach to a course and optionally a lesson. Enrolment is separate from lesson progress. Progress is evidence of learner activity and completion state, not proof of mastery. Mastery requires assessment evidence and a future competency model.

## Commercial boundaries

Prices are integer minor units with ISO currency codes. The client currently supports free enrolment only. Paid checkout, payment webhooks, refunds, accounting ledger, educator earnings and payouts must be implemented as server-verified workflows before paid courses are sold.

## AI boundaries

ai_activity is metering/observability only. It is not an AI gateway and does not imply an AI model is configured. The future gateway must enforce user/tenant authorisation, provider routing, prompt and retrieval safety, budgets, evaluation and auditability.

## Roadmap

1. Identity and RLS
2. Course authoring and learner delivery
3. Assessment submission and educator grading
4. Payments and ledger
5. AI gateway and curriculum retrieval
6. Communities and safeguarded communication
7. Institutional administration and reporting
8. Competency records and verified credentials

## Explicit non-goals

- No fake demo records.
- No public exposure of learner records.
- No unreviewed AI grading with high-impact consequences.
- No unrestricted adult/minor direct messaging.
- No payment/payout claims without provider verification.
- No claim of accreditation or regulatory compliance.
