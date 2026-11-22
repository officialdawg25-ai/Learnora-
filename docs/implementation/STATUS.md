# Learnora implementation status

Updated: 22 November 2026

## Verified environment

- Repository: `officialdawg25-ai/Learnora-`
- Working branch: `foundation/learnora-platform-v1`
- Supabase project: `gkloowmlfxfrwcxggnzl`, PostgreSQL 17, eu-west-1
- Remote migration ledger: 25 applied migrations; every migration source is versioned under its exact remote ID.
- Public application schema: 55 tables; all 55 have RLS enabled.
- Authentication users: 0. No synthetic accounts or learner records were inserted.
- Storage: one private `learnora-verification` bucket; no public Learnora bucket.
- Platform administrator records: 0. No user has been self-promoted or automatically assigned administrator access.
- Active Edge Functions: `learnora-ai`, `learnora-knowledge-ingest`, `payfast-checkout`, `payfast-notify`, `learnora-admin`.

## Implemented application experiences

- React + TypeScript + Vite responsive application.
- Supabase email/password authentication, profile bootstrap and date-of-birth capture for age-aware feature routing.
- Public course discovery, subject filters and free enrolment.
- Learner learning-space and educator studio.
- Educator academy and draft course creation.
- Module and text/activity lesson authoring.
- Educator profile, private credential evidence upload, verification submission metadata, academy team invitations, course publication review submission and descriptive course analytics.
- Learnora AI navigation with Tutor and Teacher Intelligence modes.
- Family/guardian relationship request workspace with consent scopes and pending status.
- Institution workspace for organisation setup, classes, class membership invitations, course allocation and aggregate class reporting.
- Academic workspace for learner goals, credentials and opportunity discovery.
- Permission-gated platform administration navigation and review dashboard. It becomes available only after an authorised platform administrator is assigned.

## Database capabilities now present

- Educator profiles and private evidence-submission metadata; verification decisions remain server-controlled.
- Academy team memberships and expanded academy authorisation.
- Immutable course snapshots, publication review records and educator analytics view.
- Orders, PayFast payment transactions, webhook idempotency records, refunds, double-entry ledger, educator earnings, payout records and subscription records.
- Settlement batches/lines and server-only reconciliation functions.
- AI conversations/messages, curriculum knowledge sources/chunks, full-text retrieval and scoped RLS. Learners may only append user-role messages; assistant messages are written server-side.
- Institution campuses, departments, classes, class memberships and course assignments.
- Guardian relationship requests, consent scopes and restricted safeguarding case records.
- Competency frameworks, competencies, evidence, mastery summaries, credentials, public credential verification index, opportunities and learner goals.
- Platform administrator roles and explicit permission sets.
- Consolidated RLS policies and foreign-key indexes.

## Deployed server functions

| Function | JWT | Current purpose |
|---|---|---|
| `learnora-ai` | Required | Provider-independent AI gateway, scoped curriculum retrieval, tutor/teacher workflows |
| `learnora-knowledge-ingest` | Required | Authenticated educator/institution ingestion of draft learning material |
| `payfast-checkout` | Required | Creates pending course orders and sandbox checkout URLs |
| `payfast-notify` | Not required | Verifies PayFast ITN signature and server validation before posting confirmed payment |
| `learnora-admin` | Required | Permission-scoped educator, publication, guardian, institution, safeguarding, competency, opportunity, refund and credential workflows |

The deployed functions and their source files are versioned in the repository. No AI provider keys or PayFast merchant secrets have been configured. AI returns a provider-configuration response until a model is configured. PayFast functions are sandbox-only; production mode is blocked.

## Security and verification

- Supabase security advisor: no findings.
- Supabase health advisor: no findings.
- All 55 public tables have RLS enabled.
- Private verification storage allows an authenticated educator to upload/read only within their own user-ID folder; no public object access.
- Platform administrator records cannot be created or edited by ordinary client roles. The first administrator must be assigned by an authorised project operator using the documented bootstrap process.
- Guardian activation requires a verified authority reference and an exact server-configured approved consent version. The current UI submits a draft consent version, so activation remains blocked pending legal approval.
- Performance advisor: remaining notices are unused-index informational findings on a mostly empty database. Unindexed foreign keys and multiple-permissive-policy findings were addressed; no workload-unjustified indexes were removed.
- GitHub Actions production build and dependency advisory gate passed on the current application implementation lineage; CI is rerunning on the latest branch head after source reconciliation and governance UI changes.
- Browser/device, real-account, adversarial RLS and provider sandbox end-to-end tests have not yet been performed.
- No production deployment, merge or launch is claimed.

## Explicit limitations / blocked items

- No platform administrator has been assigned because there are no Auth users. The admin dashboard and Edge Function are implemented but cannot be exercised until an approved administrator is bootstrapped.
- Educator evidence upload is private and reviewer queues exist; real reviewer testing and appeals/suspension procedures remain.
- Academy team invitations currently target existing Learnora user UUIDs; email invitation acceptance is not complete.
- Course version snapshots are recorded automatically, but a restore/diff UI is not complete.
- Publication review requests and admin decisions are stored; real reviewer testing remains.
- Educator analytics are descriptive enrolment/completion counts; no verified revenue or teaching-effectiveness score is displayed.
- PayFast checkout and ITN verification code is deployed for sandbox only. Credentials, sandbox test merchant, browser return experience and full ITN reconciliation testing remain.
- Refund requests and approval are recorded; actual PayFast refund execution and provider-confirmed completion remain.
- Settlement matching functions exist; statement import UI and batch operations runbook remain.
- Educator payouts, marketplace settlement authority and recurring subscription lifecycle are not enabled. No third-party funds are represented as withdrawable.
- AI model provider configuration, model evaluation datasets, language benchmarks, safety regression suite and measured cost controls are not configured.
- Knowledge ingestion creates private drafts; source review/publishing is available to an authorised admin, but licensed curriculum corpus ingestion and content quality evaluation remain.
- Guardian relationships remain pending until independent identity/authority review; legal consent wording and safeguarding operations require qualified South African legal review.
- Institution workspace is a foundational class/organisation layer, not a replacement SIS; invitation acceptance, OneRoster/LTI integrations and broader reporting remain.
- Competency evidence review is implemented, but automated evidence processing/mastery calculation and educator feedback loops are not complete.
- Credential issuance and opportunity publication require an authorised admin; no credentials or opportunities have been seeded.
- Communities, messaging, live classrooms, offline sync, SCORM/xAPI/LTI, backup restore testing and full POPIA operational controls remain future work.
- Assessment attempt/marking workflows and lesson player remain incomplete.

## Next execution sequence

1. Verify CI on the current branch head and confirm every migration file matches the remote version ledger.
2. Bootstrap the first platform administrator only after the approved account exists; exercise all permission-scoped review queues.
3. Add automated database/RLS tests and run signup, email confirmation and role-separated staging journeys.
4. Test educator evidence upload, team invitation, version snapshots and publication review with real accounts.
5. Configure PayFast sandbox secrets/URLs, test checkout and ITN retries, execute a refund in sandbox and reconcile a statement.
6. Configure one AI provider in a non-production environment, ingest authorised curriculum material, test retrieval, Tutor/Teacher quality and safety, and measure inference cost.
7. Complete guardian verification, institution membership acceptance and child-safe communication policy before onboarding minors.
8. Implement assessment attempt/marking workflows, evidence-to-competency processing, credential issuance and verified opportunity operations.
9. Complete mobile/accessibility/security UAT, backup restore and legal review before any production-readiness decision.
