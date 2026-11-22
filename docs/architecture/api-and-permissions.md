# Learnora API and permission specification

## 1. API conventions

Privileged operations use Supabase Edge Functions or a separately justified server runtime. Browser code may use Supabase Auth and RLS-protected reads/writes for low-risk operations, but it never decides the actor's permissions.

**Request conventions**
- JSON request bodies with explicit versioned schemas.
- Derive `actor_user_id` from verified Supabase JWT; ignore user IDs/roles in the payload for authorization.
- Validate UUIDs, enum values, length, amount/currency and file metadata before database work.
- Use an `Idempotency-Key` for checkout, enrolment, assessment submission and payment event processing where retries can duplicate effects.
- Use cursor pagination; impose a server maximum page size.
- Use request IDs for tracing and redact credentials, payment data and learner content from logs.

**Response envelope**
```json
{
  "data": {},
  "error": null,
  "meta": { "request_id": "server-generated", "next_cursor": null }
}
```

Error shape:
```json
{
  "data": null,
  "error": { "code": "FORBIDDEN", "message": "You do not have access to this resource." },
  "meta": { "request_id": "server-generated" }
}
```

Do not return SQL text, provider secrets, internal stack traces or cross-tenant resource existence details.

## 2. Initial and planned function contracts

| Function | Input | Output | Authorization | Limits/idempotency |
|---|---|---|---|---|
| `course-discovery` | `query?, subject?, level?, language?, cursor?` | Published course cards and next cursor | Public catalogue fields only | Max 30 per page; anonymous/IP and authenticated/user rate limits |
| `enrol-course` | `course_id`, idempotency key | Enrolment ID and current state | Authenticated learner; free course or verified entitlement | One active enrolment per learner/course |
| `record-learning-event` | `lesson_id`, event type, bounded evidence | Accepted event ID and progress state | Authenticated, active enrolment | Per-user event rate; dedupe event UUID |
| `submit-assessment` | `assessment_id`, answers, attempt key | Attempt ID, objective score if available, pending review status | Authenticated learner, published assessment, active enrolment | Attempt count/time limit enforced server-side |
| `educator-verification` | Evidence metadata + private object reference | Case ID and state | Authenticated educator; private upload path | Upload size/type quotas; reviewer action audited |
| `publish-course` | `course_id`, version, publication request | Publication state and version | Academy manager/reviewer policy | Validate prerequisites and content completeness |
| `learnora-ai` | capability, message, scoped resource IDs, locale | Structured answer, citations, safety metadata, usage estimate | Authenticated; context broker applies RLS scope | Per-user/tenant budget, tokens and concurrency |
| `payfast-itn` | Provider payload/signature | Acknowledgement only after verification | Provider verification, not user JWT | Provider transaction ID unique |
| `reconcile-payments` | Date window, provider account ref | Reconciliation batch and differences | Finance/service role | Serialized per settlement window |
| `refund-payment` | Payment ID, amount, reason | Refund state and ledger journal ID | Finance policy and provider support | Idempotent refund request |
| `request-educator-payout` | Amount, currency, destination reference | Pending payout request | Verified educator; available settled balance | Limit/hold/approval policy |
| `issue-credential` | Recipient, programme, evidence references | Credential ID and verification URI | Authorized issuer | Unique credential ID; audited |
| `moderation-case` | Resource, reason, description | Case ID and review state | Authenticated reporter; moderator case scope | Abuse/spam rate limits |

## 3. Standard authorization sequence

1. Verify JWT and token expiry.
2. Load actor identity from JWT subject.
3. Resolve target resource from database.
4. Resolve active membership, role, guardian relationship or roster assignment.
5. Check action-specific permission.
6. Validate resource state (published, active, paid/settled, not suspended).
7. Perform transaction with idempotency and audit record.
8. Return minimum required response.

No role supplied in a request body or editable user metadata can grant privileges.

## 4. Permission matrix

Legend: **Own** = own record; **Assigned** = explicitly assigned scope; **Tenant** = current institution/organisation only; **Review** = explicit moderation/verification case; **Platform** = platform-wide admin scope with audit; **—** = no default access.

| Resource/action | Anonymous | Learner | Educator | Academy owner | Guardian | Institution admin | Finance | Moderator/platform |
|---|---|---|---|---|---|---|---|---|
| Public academy/course metadata | Published | Published | Published | Own + published | Published | Published | — | Platform |
| Draft academy/course | — | — | Assigned | Own | — | Tenant if assigned | — | Review |
| Learner profile | — | Own | Minimum assigned | Minimum academy | Linked/consented | Tenant/assigned | — | Review |
| Enrolment | — | Own | Assigned read | Own academy read | Linked/consented | Tenant/assigned | Billing metadata | Platform |
| Lesson content | Preview/public | Entitled | Assigned | Own academy | — | Tenant/assigned | — | Platform |
| Progress/assessment result | — | Own | Assigned teaching scope | Own academy | Linked/consented | Tenant/academic scope | — | Review |
| Assessment answer keys | — | — | Author if assigned | Own academy | — | No default | — | Platform review |
| Educator verification files | — | — | Own submission | — | — | — | — | Review |
| Financial ledger | — | — | Own statement read | Own academy statement | — | Tenant summary | Tenant/platform assigned | Platform |
| Payout state | — | — | Own read/request | Own academy if payee | — | — | Assigned | Platform |
| Private community | — | Membership | Assigned/moderated | Own academy | Policy-specific | Tenant membership | — | Review |
| Messages | — | Permitted peers | Assigned learners, safeguards | Academy-scoped | Guardian controls | Tenant policy | — | Review |
| Moderation cases | — | Own report | Own report | Own academy cases | Own report | Tenant scope | — | Review |
| Institution configuration | — | — | Assigned role | — | — | Tenant | Billing scope | Platform |
| AI conversation | — | Own | Own | Own | Linked summary only | Aggregate/assigned | Cost aggregates | Platform audit |

This matrix is a target policy map. It does not grant any permission by itself; database policies and server checks must implement it.

## 5. Error codes

Use stable, non-sensitive codes:
- `UNAUTHENTICATED` — missing/expired token.
- `FORBIDDEN` — actor lacks access.
- `NOT_FOUND` — resource missing or intentionally concealed.
- `VALIDATION_ERROR` — invalid payload.
- `CONFLICT` — duplicate or invalid state transition.
- `ENTITLEMENT_REQUIRED` — paid/approved access missing.
- `RATE_LIMITED` — quota exceeded.
- `PROVIDER_UNAVAILABLE` — optional integration unavailable.
- `PAYMENT_NOT_VERIFIED` — provider proof incomplete.
- `INTEGRITY_ERROR` — ledger/evidence invariant failed.
- `INTERNAL_ERROR` — generic safe failure with request ID.

## 6. Rate, privacy and audit controls

- Public discovery: pagination, query length caps and anonymous abuse controls.
- Authentication: provider limits, password policy and email confirmation.
- AI: per-user and per-tenant budgets, maximum context, concurrency and output length.
- Uploads: private bucket, signed upload, MIME/size allowlist, malware scan and content rights metadata.
- Messaging: recipient eligibility, age policy, block/report, send rate and audit.
- Payments: provider verification, unique transaction/event IDs, replay defense and reconciliation.
- Admin: reason codes, case scope, step-up authentication where available and immutable audit trail.
