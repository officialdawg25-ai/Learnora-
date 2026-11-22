# Supabase project notes

Project reference: `gkloowmlfxfrwcxggnzl` (Learnora).

The remote Supabase migration ledger was inspected directly. All 31 applied Learnora migrations now have corresponding SQL files in this repository using the exact remote version and migration name. The first two migrations, which predated repository bootstrap, were recovered from `supabase_migrations.schema_migrations.statements` and committed rather than recreated.

## Applied migration history

- 20261122103407 — learnora_core_learning_foundation
- 20261122103505 — learnora_rls_hardening_and_auth_profiles
- 20261122104247 — learnora_public_discovery_and_privilege_restrictions
- 20261122104407 — learnora_index_and_academy_tenancy_fix
- 20261122104911 — learnora_assessment_key_and_progress_integrity
- 20261122104924 — learnora_course_visibility_and_assessment_key_grants
- 20261122105740 — learnora_least_privilege_grants
- 20261122110656 — learnora_educator_operations
- 20261122110918 — learnora_commercial_ledger
- 20261122110947 — learnora_ai_knowledge
- 20261122111114 — learnora_payfast_verification
- 20261122111343 — learnora_institutions_safeguarding
- 20261122111422 — learnora_academic_intelligence
- 20261122111459 — learnora_refunds_reconciliation
- 20261122111558 — learnora_public_api_hardening
- 20261122111620 — learnora_knowledge_ingestion
- 20261122111813 — learnora_credential_public_verification
- 20261122111925 — learnora_academy_team_analytics_rls
- 20261122112132 — learnora_performance_policy_consolidation
- 20261122112552 — learnora_ai_message_integrity
- 20261122112646 — learnora_age_appropriate_signup
- 20261122112826 — learnora_private_verification_storage
- 20261122112914 — learnora_platform_governance
- 20261122113628 — learnora_platform_admin_fk_index
- 20261122114018 — learnora_invitation_acceptance
- 20261122114147 — learnora_invitation_discovery
- 20261122114827 — learnora_learning_progress_assessment_engine
- 20261122114955 — 20261122120000_learnora_anonymous_grant_hardening
- 20261122115156 — learnora_assessment_submission_key_validation
- 20261122115411 — learnora_assessment_null_payload_guard
- 20261122115759 — learnora_private_learning_workflows
- 20261122120542 — learnora_institution_verification_review
- 20261122120613 — learnora_checkout_concurrency_guards

## Security and operating notes

- RLS is enabled on all 56 current public application tables. Anonymous table privileges are restricted to SELECT on `academies`, `courses` and `credential_verification_index` only.
- Anonymous access is limited to explicitly public discovery and the minimal public credential verification index.
- Financial journals, webhook events, settlement imports, safeguarding cases and credential verification index writes are server-controlled.
- Payment callbacks are not treated as proof of bank settlement. PayFast payment confirmation and statement reconciliation are separate states.
- Pending orders are unique per learner/course, and each order can have only one active payment attempt. Checkout reuses an existing pending order/payment attempt under concurrent requests.
- The PayFast Edge Functions are sandbox-only; production checkout is deliberately disabled. The `learnora-admin` function is JWT-protected and requires an explicit active permission record; no platform administrator has been assigned.
- Five Edge Functions are deployed: Learnora AI, knowledge ingestion, PayFast checkout, PayFast notification and platform administration. Their source files are versioned under `supabase/functions`.
- AI is provider-independent at the application gateway, but a provider/model/key must be configured before responses can be generated.
- One private `learnora-verification` storage bucket is configured for educator evidence; no test users or demo records have been created. Date of birth is collected at signup for age-aware feature routing; unknown age is treated conservatively by AI services.
- Health and security advisors returned no findings after moving privileged learning-write functions into the non-exposed `private` schema and retaining `SECURITY INVOKER` public RPC wrappers. Adversarial tests remain required before production. Performance advisor findings are informational unused-index notices on a largely empty database; indexes were not removed without workload evidence.

Before using Supabase CLI against another environment, compare `supabase migration list --remote` with these files. Do not blindly reapply migrations already present remotely.
