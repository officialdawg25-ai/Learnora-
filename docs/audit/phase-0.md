# Learnora — Phase 0 and implementation audit

**Audit date:** 22 November 2026  
**Repository:** `officialdawg25-ai/Learnora-`  
**Working branch:** `foundation/learnora-platform-v1`  
**Supabase project:** `gkloowmlfxfrwcxggnzl` — PostgreSQL 17, eu-west-1

## Executive finding

The original main branch was README-only. The isolated foundation branch now contains a real React/Vite application, educator and learner experiences, 54 RLS-protected public tables, four deployed Edge Functions, a 19-migration source history and initial institutional, family and academic workspaces.

The application and schema are materially more capable than the original audit baseline, but this is still a foundation build. Provider secrets, real-user tests, reviewer operations, safeguarding review and end-to-end financial/AI validation remain incomplete. Do not merge or launch based only on a green build.

## Verified current state

| Area | Finding | Status |
|---|---|---|
| Main branch | Unchanged by this work; implementation is isolated on the foundation branch | VERIFIED |
| Application | React + TypeScript + Vite; learner, educator, AI, family, institution and academic workspaces | VERIFIED |
| Supabase | Active PostgreSQL 17 project | VERIFIED |
| Migration history | 21 applied remote migrations; all exact-version SQL files are now present in the repository | VERIFIED |
| Public schema | 54 base tables, all with RLS enabled | VERIFIED |
| Auth users | 0; no test accounts or demo learner data created | VERIFIED |
| Learnora storage buckets | 0 | VERIFIED |
| Edge Functions | 4 deployed and ACTIVE | VERIFIED |
| Security advisor | No findings | VERIFIED |
| Health advisor | No findings | VERIFIED |
| Performance advisor | Remaining unused-index notices only; no unindexed-FK or multiple-permissive-policy findings | VERIFIED |
| Build | Latest verified code build passed; CI rerun on current branch head after migration reconciliation | VERIFIED / PARTIAL |
| Browser/mobile UAT | Not yet performed with real accounts/devices | BLOCKED |
| Provider tests | PayFast sandbox credentials and AI model provider secrets not configured | BLOCKED |
| Production deployment | Not performed | VERIFIED |

## Implemented systems

### Learning and educator operations
- Published course discovery and free enrolment.
- Academy creation and draft course authoring.
- Module and lesson authoring.
- Educator profiles and verification submission metadata.
- Academy team memberships.
- Course version snapshots and publication review request records.
- Descriptive educator course analytics.

### Commercial infrastructure
- Course orders and PayFast payment transaction records.
- Idempotent webhook event records.
- PayFast sandbox checkout and ITN verification Edge Functions.
- Double-entry ledger accounts, journals and entries.
- Refund requests and controlled completion workflow.
- Settlement batches, statement lines and reconciliation functions.
- Educator earnings, payout and subscription records.

### Learnora AI
- AI conversations and messages.
- Provider-independent OpenAI-compatible, Anthropic and Gemini adapters.
- Tutor and Teacher Intelligence workflows.
- Full-text curriculum knowledge retrieval under user RLS.
- Authenticated knowledge ingestion into private draft sources.
- AI activity metering and request limits.

### Institutional and safeguarding foundations
- Organisation, campus, department, class, class membership and course allocation.
- Aggregate institutional class reporting.
- Guardian relationship requests with explicit access scopes.
- Guardian access is pending until independently verified.
- Safeguarding case records are server-controlled.

### Academic intelligence
- Competency frameworks and prerequisite relationships.
- Learner competency evidence and mastery summary records.
- Platform/institution/accredited credential distinctions.
- Minimal public credential verification index.
- Verified-source opportunity directory and learner goals.

## Migration reconciliation

The first two remote migrations predated repository bootstrap. Their SQL was recovered from the remote `supabase_migrations.schema_migrations.statements` history and committed under their original versions. The remaining 17 migrations are also present with exact remote IDs.

Before using Supabase CLI in another environment, run `supabase migration list --remote` and confirm local/remote version alignment. Do not blindly push or recreate the schema.

## Security findings and boundaries

- All 54 public tables have RLS enabled.
- Anonymous discovery is limited to explicitly public records.
- Financial ledger and webhook tables are inaccessible to ordinary client roles.
- Credential verification exposes only a minimal public index, not recipient identity.
- Guardian access is scoped and remains pending until verified.
- Institution class membership and academy team access are checked through server-side database helpers.
- AI retrieval runs with the requesting user's JWT context; private source content is not globally indexed for every learner. Learner clients can only insert user-role chat messages; assistant messages are server-written. Unknown date of birth is treated as minor for AI capability routing.
- PayFast payment confirmation is separate from settlement; educator payout/marketplace fund handling is not enabled.
- Security and health advisors returned no findings at the latest check.

These controls still require adversarial tests using separate learner, educator, guardian and institution identities. The absence of advisor findings is not proof of full compliance or absence of exploitable application flaws.

## Outstanding launch blockers

1. **Real-user testing:** no auth users exist; verify signup, confirmation, signin, password recovery and role journeys.
2. **Educator governance:** private document upload, reviewer console, appeals, suspension workflow, invitation acceptance, version restore/diff and publication approval.
3. **Payments:** configure PayFast sandbox merchant details and URLs; test signature, server validation, retries, duplicate notifications, failure states, refunds and settlement statements.
4. **Finance:** implement approved commission policy and marketplace payout provider/legal arrangement before enabling educator withdrawals.
5. **AI:** configure provider secrets, seed authorised/licensed curriculum sources, evaluate outputs across subjects and South African languages, test prompt injection, and set actual cost limits.
6. **Child safeguarding:** approve consent wording with South African counsel, verify guardian identity/authority, implement moderation/escalation and test every minor communication boundary.
7. **Institutional:** invitation acceptance, verification, class workflows and interoperability conformance tests.
8. **Academic intelligence:** deterministic evidence processing, human review, credential issuance controls and verified opportunity operations.
9. **Core learning:** learner lesson player, assessment authoring/submission/marking, offline synchronisation and mastery evidence.
10. **Operations:** private storage buckets, backups and restore drills, incident response, monitoring, accessibility and mobile performance.

## Guardrails maintained

- No production users, learner records or fabricated content were seeded.
- No production payment configuration or secrets were changed.
- No service-role credentials were placed in browser code.
- No destructive schema reset or main-branch merge was performed.
- No accreditation, legal compliance or production-readiness claim is made.
- Unused indexes were not dropped without workload evidence.
