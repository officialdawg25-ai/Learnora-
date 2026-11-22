# Learnora provider configuration and operational gates

This document records server-side configuration required by the deployed Edge Functions. Never put provider secrets in Vite environment variables or browser code.

## Supabase Edge Function secrets

Configure secrets through the Supabase project secret manager. Do not commit values.

### Shared runtime
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, never expose to the browser.

### Learnora AI
- `LEARNORA_AI_PROVIDER`: `openai`, `openai_compatible`, `anthropic`, or `gemini`
- `LEARNORA_AI_MODEL`: provider model identifier
- `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` as appropriate
- `LEARNORA_AI_BASE_URL`: optional OpenAI-compatible API base URL; defaults to OpenAI's API.
- `LEARNORA_CHILD_AI_CONSENT_VERSION`: exact, legally approved consent version required before an under-18 or unknown-age account can use Learnora Tutor. Leave unset until South African legal/safeguarding review is complete. When set, the learner must also have an active guardian relationship with the same consent version and the `ai_tutor` consent scope.

AI is unavailable until one provider and model are configured. The function returns a clear 503 response rather than silently substituting a fake answer. The AI gateway currently supports tutor and teacher capabilities, scoped full-text retrieval, user-owned conversations and a basic per-user request limit. Unknown-age accounts are treated as minors. Under-18 Tutor access is denied unless the approved consent version and active guardian scope are present; the current guardian request UI does not yet request `ai_tutor`, so child AI remains blocked. Teacher Intelligence requires an adult account with verified educator status. The gateway does not yet have a validated CAPS corpus, model evaluation benchmark or measured provider pricing.

### PayFast sandbox only
- `PAYFAST_MODE=sandbox` — any other value is rejected by the current checkout and notification functions.
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_RETURN_URL`: approved staging application return page.
- `PAYFAST_CANCEL_URL`: approved staging application cancel page.
- `PAYFAST_NOTIFY_URL`: `https://gkloowmlfxfrwcxggnzl.supabase.co/functions/v1/payfast-notify`

The merchant key is not embedded in the browser or checkout redirect. The notification function verifies the ITN signature and calls PayFast's sandbox validation endpoint before invoking the database payment-posting function. Pending orders are unique per learner/course and each order permits only one active payment attempt; repeated checkout requests reuse the pending order and active attempt.

Do not switch to production mode. Production payments require explicit approval, provider review, legal review of marketplace funds handling, reconciliation procedures, monitoring and successful sandbox acceptance tests.

## Deployed Edge Functions

| Function | JWT verification | Role |
|---|---|---|
| `learnora-ai` | Required | AI Tutor and Teacher Intelligence |
| `learnora-knowledge-ingest` | Required | Ingest authorised learning material as a private draft |
| `payfast-checkout` | Required | Create a pending course order and sandbox checkout URL |
| `payfast-notify` | Disabled at gateway | Verify PayFast server notifications itself; never trust the caller |
| `learnora-admin` | Required | Permission-scoped platform review and governance workflows |

The webhook endpoint has JWT verification disabled because PayFast cannot supply a Learnora user JWT. Its own signature and server-validation checks are mandatory.

The `learnora-admin` function requires a valid user JWT and an active permission record in `platform_administrators`. No administrator is pre-seeded. Follow [the platform administrator bootstrap procedure](./platform-admin-bootstrap.md) only after independent account verification.

## Knowledge source publishing

The ingestion endpoint accepts text content (maximum 200,000 characters per request), splits it into chunks and stores a draft source. Draft content is not available to learner AI retrieval. A trusted source-review/publishing workflow is still required. Only ingest material Learnora or the submitting institution is authorised to use.

A private `learnora-verification` storage bucket is configured. Educator evidence uploads are path-scoped and not publicly accessible. The retention schedule, reviewer operating procedure and legal basis for retaining credential evidence still require approval; do not use this bucket for general learner identity documents.

## Financial state definitions

- PayFast ITN validated and payment marked `confirmed`: payment provider confirmation, not bank settlement.
- Reconciled statement line and payment marked `settled`: matched to an imported settlement record.
- Educator earnings: not yet available for withdrawal. Marketplace settlement and payout authority must be validated before enabling payouts.
- Refund request: recorded for review; it is not proof that PayFast has returned funds.
- Refund completed: only set by a trusted server-side workflow after provider confirmation.

## Pre-activation checklist

1. Configure staging URLs and sandbox secrets only.
2. Test invalid signatures, altered amounts, wrong merchant IDs, invalid PayFast validation responses and duplicate ITNs.
3. Confirm duplicate callbacks cannot duplicate enrolments or ledger journals.
4. Test a refund request and manual finance approval/reconciliation workflow.
5. Verify no secrets appear in frontend bundles, logs or client network responses.
6. Confirm a payment failure never grants paid course access.
7. Keep educator payout and recurring subscriptions disabled until provider and legal arrangements are approved.

## Platform administrator bootstrap

The admin Edge Function is active, but the platform administrator table is intentionally empty. No account is automatically promoted. Follow [the platform administrator bootstrap procedure](./platform-admin-bootstrap.md) only after an approved account exists and its authority is independently verified.
