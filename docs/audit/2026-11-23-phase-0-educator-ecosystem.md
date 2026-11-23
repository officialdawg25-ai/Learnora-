# Learnora — Phase 0 audit and Phase 1 baseline

**Audit date:** 23 November 2026  
**Repository:** `officialdawg25-ai/Learnora-`  
**Implementation branch:** `staging/learnora-platform-v1`  
**Staging Pages project:** `learnora-staging`  
**Supabase project:** `gkloowmlfxfrwcxggnzl` (PostgreSQL 17, eu-west-1)

## Phase 0 — VERIFIED findings

- The repository default branch `main` is effectively a README plus a minimal migration tree; it is not the current application base.
- `staging/learnora-platform-v1` is the designated Cloudflare Pages production branch for the separate `learnora-staging` project. Production deployments are disabled for this Pages project.
- The staging branch contains the React 19, TypeScript and Vite application, official SVG mark, learner/parent/educator/institution/admin workspaces, educator application, course builder, assessment builder, family messaging and live-class scheduler.
- Supabase is ACTIVE_HEALTHY on PostgreSQL 17.
- Before this Phase 1 migration, the public schema had 82 base tables and all 82 had RLS enabled. The Phase 1 audit-event table is also RLS-enabled.
- The database had 69 applied migrations before this Phase 1 work. Two Phase 1 migrations are now applied, bringing the remote ledger to 71.
- Four Auth users, one educator profile, zero educator verification submissions, zero live-class sessions and zero active platform administrators were present at audit time. No account IDs are reproduced here.
- Existing private storage buckets: `learnora-verification`, `learnora-family-documents`, and `learnora-profile-media`.
- Existing Edge Functions: `learnora-ai`, `learnora-knowledge-ingest`, `payfast-checkout`, `payfast-notify`, and `learnora-admin`.
- Existing verification submission, educator profile, role approval and institution membership systems were reused; no second identity or role system was introduced.
- The existing educator verification status is protected by database triggers; the educator cannot self-approve by changing their profile.
- The existing platform administrator table has no active assignments. The privileged review UI cannot be exercised until a properly authorised administrator is bootstrapped through the documented process.

## Phase 0 — PARTIAL / BLOCKED findings

- **Migration reconciliation — BLOCKED:** the staging repository contains 67 migration files while the remote ledger contained 69 applied versions. Multiple migration filenames/versions differ from the remote ledger. The new Phase 1 migration was applied through Supabase and its exact remote version is recorded below, but the older drift still needs a deliberate reconciliation before any CLI migration push.
- **Cloudflare R2 — BLOCKED:** Cloudflare API reports that R2 must be enabled in the account dashboard before bucket operations are available.
- **Cloudflare Stream — BLOCKED:** Cloudflare API reports Stream is not enabled for the connected account.
- **Live conferencing — PARTIAL:** the current scheduler stores class sessions and optional HTTPS meeting URLs; native provider token issuance and video rooms are not configured.
- **External identity/SACE/SAQA verification — PARTIAL:** no authorised SACE, SAQA or identity-provider API integration was confirmed. Manual evidence review remains the available path.
- **Real-account adversarial tests and Android visual acceptance — BLOCKED:** no authorised test identities or admin assignment were supplied for end-to-end role-based verification.

## Phase 1 — IMPLEMENTED database foundation

Migrations: `20261123125318_educator_trust_phase1_foundation` and `20261123125850_educator_trust_remove_duplicate_role_gate`

- Added self-declared professional category, professional country code and teaching philosophy to the existing `educator_profiles` table.
- Added issuer country, reviewer verification method/source/reference and validity/review dates to the existing `educator_verification_submissions` table.
- Added `educator_verification_events` as a private, RLS-protected, append-only event history for submissions and reviewer decisions.
- Confirmed the existing `private.guard_user_role_update()` trigger already prevents educator role activation unless the educator profile is verified. A duplicate Phase 1 trigger was removed in a follow-up migration so Learnora retains one canonical gate.
- Kept the existing Supabase Auth identity, role model, verification tables and private evidence bucket.
- The new table has RLS enabled; authenticated users can read only their own verification events. Browser roles cannot insert, update or delete verification events.
- A database-level activation attempt against the existing pending, unverified educator request was rejected by the pre-existing role guard; no role was activated.

## Security and compliance notes

- The category is self-declared and is not itself a credential badge.
- The verification method/source fields are reviewer-controlled metadata; an educator cannot claim independent verification.
- No SACE or SAQA integration is claimed.
- The role-activation trigger is a technical gate, not a safeguarding clearance or POPIA compliance certification.
- The existing leaked-password protection warning remains outstanding.
- Retention periods and legal basis for identity/credential evidence require South African legal review.

## Evidence classification

- **VERIFIED:** repository structure, branch configuration, database schema, RLS state, migration ledger, storage buckets, Edge Function inventory, provider enablement responses, new migration success and schema verification query.
- **PARTIAL:** educator application, educator operations, reviewer queue and live-session scheduling.
- **BLOCKED:** R2, Stream, native LiveKit-equivalent conferencing, authorised identity registry APIs, active admin UAT, adversarial multi-account tests and production launch.
