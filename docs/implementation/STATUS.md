# Learnora implementation status

Updated: 22 November 2026

## Verified environment

- Repository: `officialdawg25-ai/Learnora-`
- Staging branch: `staging/learnora-platform-v1`
- Supabase project: `gkloowmlfxfrwcxggnzl`, PostgreSQL 17, eu-west-1
- Remote migration ledger: 37 applied migrations; every migration source is versioned under its exact remote ID.
- Public application schema: 56 tables; all 56 have RLS enabled.
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
- Module and text/activity lesson authoring, immutable version history and snapshot preview.
- Learner lesson player with explicit completion events, objective assessment submission and written-answer review.
- Educator assessment studio for multiple-choice, numeric, short-answer and long-answer questions, private answer keys and manual grading with feedback.
- Secure academy/class invitation inbox and acceptance workflow.
- Learner order history, PayFast return-state verification and refund request submission.
- Educator curriculum knowledge ingestion into private draft sources.
- Educator profile, private credential evidence upload, verification submission metadata, academy team invitations, course publication review submission and descriptive course analytics.
- Learnora AI navigation with Tutor and Teacher Intelligence modes; server-side access requires verified educator status for Teacher Intelligence and blocks under-18/unknown-age Tutor accounts until approved guardian consent is configured.
- Family/guardian relationship request workspace with consent scopes and pending status.
- Institution workspace for organisation setup, classes, class membership invitations, course allocation, aggregate class reporting and external institutional verification references with an authorised review queue.
- Academic workspace for learner goals, credentials and opportunity discovery.
- Permission-gated platform administration navigation and review dashboard. It becomes available only after an authorised platform administrator is assigned.

## Database capabilities now present

- Educator profiles and private evidence-submission metadata; verification decisions remain server-controlled.
- Academy team memberships and expanded academy authorisation.
- Immutable course snapshots, publication review records and educator analytics view. Educator, institution and course publication decisions are now recorded atomically with their associated profile/organisation/course state changes.
- Learner lesson-progress RPC, assessment attempt submission, deterministic objective auto-marking and educator grading RPCs. Learner answer submissions are checked against the published assessment's question identifiers; answer keys remain private.
- Orders, PayFast payment transactions, webhook idempotency records, refunds, double-entry ledger, educator earnings, payout records and subscription records. Pending orders are unique per learner/course, and each order can have only one active payment attempt.
- Settlement batches/lines and server-only reconciliation functions.
- AI conversations/messages, curriculum knowledge sources/chunks, full-text retrieval and scoped RLS. Learners may only append user-role messages; assistant messages are written server-side.
- Institution campuses, departments, classes, class memberships, course assignments and institutional verification submissions with atomic reviewer decisions.
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

- Supabase security and health advisors: no findings.
- Anonymous academy discovery now has a dedicated published-only policy; member/owner academy visibility is restricted to authenticated users. This removed the public landing-page `academy_memberships` permission error. Privileged learning-write routines were moved into the non-exposed `private` schema; public RPC entry points now use `SECURITY INVOKER`. The private routines retain explicit authentication, enrolment or academy-manager checks and an empty search path. Adversarial tests remain required before production.
- All 56 public tables have RLS enabled. Anonymous table privileges are restricted to `SELECT` on `academies`, `courses` and `credential_verification_index` only.
- Private verification storage allows an authenticated educator to upload/read only within their own user-ID folder; no public object access.
- Platform administrator records cannot be created or edited by ordinary client roles. The first administrator must be assigned by an authorised project operator using the documented bootstrap process.
- Guardian activation requires a verified authority reference and an exact server-configured approved consent version. The current UI submits a draft consent version, so activation remains blocked pending legal approval.
- Performance advisor: remaining notices are unused-index informational findings on a mostly empty database. Unindexed foreign keys and multiple-permissive-policy findings were addressed; no workload-unjustified indexes were removed.
- GitHub Actions build and dependency advisory gate passed on staging merge commit `24d612229a7cdf52b3a8f848545bf06b16595daf` (run `45021733458`). The Cloudflare Pages preview build also passed and deployed successfully.
- Browser/device, real-account, adversarial RLS and provider sandbox end-to-end tests have not yet been performed.
- Staging merge completed via PR #1 into `staging/learnora-platform-v1`; `main` remains unchanged at `028ae23ea6f33403152bee2fe4cd1bcb6da86041`.
- Cloudflare Pages staging preview: `https://e58692cd.learnora-staging.pages.dev` (deployment `e58692cd-829b-403b-8ad4-64d37a348985`, all stages successful). The `learnora-staging` project has `production_deployments_enabled=false`; its only preview branch is `staging/learnora-platform-v1`; no production deployment exists.
- The staging frontend currently points to the primary Learnora Supabase project. No separate Supabase development branch was created because Supabase requires explicit cost approval for branch creation. Staging sign-ups and test records therefore write to the shared project; avoid real learner/student data until an isolated staging database is approved.
- No production merge, production deployment, live payment processing or public launch has occurred.

## Explicit limitations / blocked items

- No platform administrator has been assigned because there are no Auth users. The admin dashboard and Edge Function are implemented but cannot be exercised until an approved administrator is bootstrapped.
- Educator evidence upload is private and reviewer queues exist; real reviewer testing and appeals/suspension procedures remain.
- Academy team and institution class invitations can be accepted by the invited authenticated user without changing their assigned role or tenant. Email delivery and invitations for people who have not registered remain incomplete.
- Course version snapshots are recorded automatically, but a restore/diff UI is not complete.
- Publication review requests and admin decisions are stored; real reviewer testing remains.
- Educator analytics are descriptive enrolment/completion counts; no verified revenue or teaching-effectiveness score is displayed.
- PayFast checkout and ITN verification code is deployed for sandbox only. Credentials, sandbox test merchant, browser return experience and full ITN reconciliation testing remain.
- Refund requests and approval are recorded; actual PayFast refund execution and provider-confirmed completion remain.
- Settlement matching functions exist; statement import UI and batch operations runbook remain.
- Educator payouts, marketplace settlement authority and recurring subscription lifecycle are not enabled. No third-party funds are represented as withdrawable.
- AI model provider configuration, model evaluation datasets, language benchmarks, safety regression suite and measured cost controls are not configured. Under-18/unknown-age Tutor access remains blocked because the approved child-consent version and `ai_tutor` guardian scope are not configured.
- Knowledge ingestion creates private drafts; source review/publishing is available to an authorised admin, but licensed curriculum corpus ingestion and content quality evaluation remain.
- Guardian relationships remain pending until independent identity/authority review; legal consent wording and safeguarding operations require qualified South African legal review.
- Institution workspace is a foundational class/organisation layer, not a replacement SIS; email-based invitation delivery, OneRoster/LTI integrations and broader reporting remain.
- Competency evidence review is implemented, but automated evidence processing/mastery calculation and educator feedback loops are not complete.
- Credential issuance and opportunity publication require an authorised admin; no credentials or opportunities have been seeded.
- Communities, messaging, live classrooms, offline sync, SCORM/xAPI/LTI, backup restore testing and full POPIA operational controls remain future work.
- A learner lesson player, lesson completion recording, multiple-choice assessment attempts, deterministic objective marking and educator grading RPCs are implemented. Learner-facing attempt history is now displayed. Educator-facing review and manual grading for subjective responses are implemented. File-upload questions, rubric-based grading, competency mapping and richer mastery/progress feedback remain incomplete.

## Next execution sequence

1. Verify CI on the current branch head and confirm every migration file matches the remote version ledger.
2. Bootstrap the first platform administrator only after the approved account exists; exercise all permission-scoped review queues.
3. Add automated database/RLS tests and run signup, email confirmation and role-separated staging journeys.
4. Test educator evidence upload, team invitation, version snapshots and publication review with real accounts.
5. Configure PayFast sandbox secrets/URLs, test checkout and ITN retries, execute a refund in sandbox and reconcile a statement.
6. Configure one AI provider in a non-production environment, ingest authorised curriculum material, test retrieval, Tutor/Teacher quality and safety, and measure inference cost.
7. Complete guardian verification, institution membership end-to-end testing, email invitation delivery and child-safe communication policy before onboarding minors.
8. Expand assessments with file-upload questions, rubric-based grading and competency mapping; implement evidence-to-mastery automation, credential issuance and verified opportunity operations.
9. Complete mobile/accessibility/security UAT, backup restore and legal review before any production-readiness decision.
