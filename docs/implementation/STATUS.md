# Learnora implementation status

Updated: 22 November 2026

## Verified environment

- Repository: `officialdawg25-ai/Learnora-`
- Working branch: `foundation/learnora-platform-v1`
- Supabase project: `gkloowmlfxfrwcxggnzl`, PostgreSQL 17, eu-west-1
- Remote migration ledger: 23 applied migrations; every migration source is now versioned under its exact remote ID.
- Public application schema: 55 tables; all 55 have RLS enabled.
- Authentication users: 0. No synthetic accounts or learner records were inserted.
- Learnora storage buckets: 1 private `learnora-verification` bucket; no public bucket.
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
- Academic workspace for learner goals, credentials and verified opportunity discovery.

## Database capabilities now present

- Educator profiles and evidence-submission metadata; verification decisions remain server-controlled.
- Academy team memberships and expanded academy authorisation.
- Immutable course snapshots, publication review records and educator analytics view.
- Orders, PayFast payment transactions, webhook idempotency records, refunds, double-entry ledger, educator earnings, payout records and subscription records.
- Settlement batches/lines and server-only reconciliation functions.
- AI conversations/messages, curriculum knowledge sources/chunks, full-text retrieval and scoped RLS. Learners may only append user-role messages; assistant messages are written server-side.
- Institution campuses, departments, classes, class memberships and course assignments.
- Guardian relationship requests, consent scopes and restricted safeguarding case records.
- Competency frameworks, competencies, evidence, mastery summaries, credentials, public credential verification index, opportunities and learner goals.
- Consolidated RLS policies and foreign-key indexes.

## Deployed server functions

| Function | JWT | Current purpose |
|---|---|---|
| `learnora-ai` | Required | Provider-independent AI gateway, scoped curriculum retrieval, tutor/teacher workflows |
| `learnora-knowledge-ingest` | Required | Authenticated educator/institution ingestion of draft learning material |
| `payfast-checkout` | Required | Creates pending course orders and sandbox checkout URLs |
| `payfast-notify` | Not required | Verifies PayFast ITN signature and server validation before posting confirmed payment |

No AI provider keys or PayFast merchant secrets have been configured. The functions are deployed but cannot complete live provider transactions or generate model responses until the relevant sandbox credentials and URLs are configured. Production PayFast mode is explicitly blocked.

## Security and verification

- Supabase security advisor: no findings.
- Supabase health advisor: no findings.
- All 54 public tables have RLS enabled.
- Performance advisor: remaining notices are unused-index informational findings on a mostly empty database. Unindexed foreign keys and multiple-permissive-policy findings were addressed; no workload-unjustified indexes were removed.
- GitHub Actions production build and dependency advisory gate passed on the current application implementation lineage; CI is rerunning on the latest branch head after source reconciliation and security updates.
- Browser/device, real-account, adversarial RLS and provider sandbox end-to-end tests have not yet been performed.
- No production deployment, merge or launch is claimed.

## Explicit limitations / blocked items

- Educator verification evidence file upload and human reviewer console are not complete; there is no private storage bucket yet.
- Academy team invitations currently target existing Learnora user UUIDs; email invitation acceptance is not complete.
- Course version snapshots are recorded automatically, but a restore/diff UI is not complete.
- Publication review requests are stored, but a trusted reviewer decision console is not complete.
- Educator analytics are descriptive enrolment/completion counts; no verified revenue or teaching-effectiveness score is displayed.
- PayFast checkout and ITN verification code is deployed for sandbox only. Credentials, sandbox test merchant, browser return experience and full ITN reconciliation testing remain.
- Refund requests are recorded; approval and PayFast refund execution require an authorised finance workflow/provider confirmation.
- Settlement matching functions exist; statement import UI and batch operations runbook remain.
- Educator payouts, marketplace settlement authority and recurring subscription lifecycle are not enabled. No third-party funds are represented as withdrawable.
- AI model provider configuration, model evaluation datasets, language benchmarks, safety regression suite and cost pricing are not configured.
- Knowledge ingestion creates private drafts; source review/publishing and licensed curriculum corpus ingestion remain.
- Guardian relationships remain pending until independent identity/authority review; legal consent wording and safeguarding operations require qualified South African legal review.
- Institution workspace is a foundational class/organisation layer, not a replacement SIS; verification, invitation acceptance, OneRoster/LTI integrations and broader reporting remain.
- Competency evidence/mastery computation, credential issuance, opportunity ingestion/verification operations and accreditation checks are not yet operational.
- Communities, messaging, live classrooms, media storage, offline sync, SCORM/xAPI/LTI, backup restore testing and full POPIA operational controls remain future work.

## Next execution sequence

1. Verify CI on the current branch head and reconcile the complete migration directory against remote history.
2. Add automated database/RLS tests and run signup, email confirmation and role-separated staging journeys.
3. Finish educator verification review, academy invitations/acceptance, version diff/restore and publication reviewer console.
4. Configure PayFast sandbox secrets/URLs, test checkout and ITN retries, add finance approval and settlement statement import workflows.
5. Configure one AI provider in a non-production environment, test source retrieval, Tutor/Teacher quality and safety, and measure inference cost.
6. Complete guardian verification, institution membership acceptance and child-safe communication policy before onboarding minors.
7. Implement assessment attempt/marking workflows, evidence-to-competency processing, credential issuance and verified opportunity operations.
8. Complete mobile/accessibility/security UAT, backup restore and legal review before any production-readiness decision.
