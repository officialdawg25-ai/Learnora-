# Learnora implementation audit
**Checked:** 22 November 2026  
**Repository:** `officialdawg25-ai/Learnora-`  
**Branch:** `staging/learnora-platform-v1`  
**Supabase project:** `gkloowmlfxfrwcxggnzl` (PostgreSQL 17, eu-west-1)

## VERIFIED existing infrastructure
- React 19 + TypeScript + Vite application with Supabase Auth.
- 56 public database tables; all 56 have Row Level Security enabled.
- 37 remote Supabase migrations.
- Existing learning catalogue and delivery: academies, courses, modules, lessons, enrolments, learning progress, assessments and assessment attempts.
- Existing educator profiles and verification submissions.
- Existing institution model: organisations, memberships, campuses, departments, classes, class memberships and course assignments.
- Existing guardian relationship table with pending/active/rejected workflow and scope-aware access through `private.guardian_has_scope`.
- Existing safeguarding, competency evidence/mastery, credentials and learning-opportunity domains.
- Existing PayFast checkout and notification Edge Functions, plus AI, knowledge-ingestion and platform-administration functions.
- Existing React workspaces for family access, academic intelligence, educator operations, institution operations, invitations, platform administration, learning player and Learnora AI.
- Existing records are sparse: one profile row and six ledger-account rows were present during this audit. Empty academic tables were left intact; no sample records were inserted.

## IMPLEMENTED in this change set
- Reworked the public landing-page hero around the connected education proposition.
- Added a four-role ecosystem section for parents/guardians, learners, educators and institutions.
- Added a restrained institutional design layer: ink/navy, warm neutral surfaces, muted blue-grey accents, precise borders and reduced decorative effects.
- Added account-type selection to signup.
- Stored the selected account type as `signup_intent` in Supabase Auth user metadata and routed successful sign-ins to the matching initial workspace.
- Explicitly treat `signup_intent` as onboarding preference only. It is user-editable metadata and is not used for authorization.
- Reworked the Family workspace into a parent 360° overview with real counts from permitted learning-progress and assessment scopes, masked learner/guardian identifiers, outgoing connection status, and learner-side visibility of incoming requests.
- Added clear copy that pending relationships do not grant learner-record access.

## PARTIAL / BLOCKED
- Parent-to-learner request creation currently uses the existing learner account UUID workflow. A privacy-preserving account discovery/invitation flow is still needed.
- Learners can see incoming guardian requests, but learner self-service approve/reject and explicit learner consent are not implemented. Existing activation is controlled by the privileged guardian-review workflow and requires independently verified authority evidence plus the configured approved consent version.
- Parent 360° currently shows authorised record counts, not a complete named-child profile, subject-by-subject report, educator messaging or attendance timeline. Those require further data contracts and UI integration.
- Signup role selection is not a trusted role grant. Educator and institution capabilities must continue to be granted only through verified educator/institution membership workflows; platform administration remains separately assigned.
- The connected Supabase project is shared with the staging frontend. No schema changes or live data mutations were made in this UX pass.
- PayFast functions exist, but this change did not run payment end-to-end tests or enable live payments.
- No production deployment or production-branch merge was performed.

## Security and health observations
- Supabase security advisor reported one warning: leaked-password protection is disabled. Enable it in Supabase Auth settings before production launch: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Supabase health advisor returned no findings.
- Performance advisor reported unused-index informational findings. Do not remove indexes based only on a fresh project's low activity; review after representative production usage.
- The inspected RLS policies allow a learner and guardian to see their relationship row, but only a guardian can insert a pending relationship. Active academic data access is scope-gated. The platform admin Edge Function performs privileged guardian review.

## Verification
- GitHub Actions workflow: `Learnora CI`, run 518.
- Build step `npm run build`: **SUCCESS**.
- Dependency advisory step: **SUCCESS**.
- Browser-based real-account tests, learner consent tests, and mobile visual inspection remain outstanding.

## Next implementation priorities
1. Implement a secure learner discovery invitation flow without exposing account existence to unauthorised callers.
2. Add learner-side consent/response and guardian revocation workflows with database-enforced permissions and audit events.
3. Expand Parent 360° into real per-child subject reports, educator feedback, attendance (where supplied), notifications and authorised messaging.
4. Add role-aware navigation based on verified capabilities, not signup metadata.
5. Complete real-account journey testing and mobile visual review.
6. Enable leaked-password protection and complete safeguarding/POPIA legal review before production.
