# Learnora role-aware redesign — implementation audit

Date: 2026-11-22
Integration target: `staging/learnora-platform-v1`
Source implementation: `preview/role-aware-learner-ecosystem`
Supabase project: `gkloowmlfxfrwcxggnzl`
Scope: staging and isolated preview only. `main` and production deployment settings are not targeted.

## Verified foundation

- React 19, TypeScript 5.8, Vite 6 and Supabase JS 2.58.
- Existing landing, email/password authentication, course enrolment, learning player, educator course builder, PayFast checkout and notification functions.
- Supabase project is ACTIVE_HEALTHY on PostgreSQL 17.
- 63 public base tables inspected; all 63 have RLS enabled.
- 48 migrations are recorded in the connected Supabase migration history at the time of inspection.
- Canonical role records are in `public.user_roles`; platform administrator assignment is separately represented by `public.platform_administrators`.
- Existing role, guardian, educator, institution, learner-discovery, community, live-class, course, academic and notification tables are reused rather than duplicated.

## Implemented in the integrated staging source

### Role-aware application
- Active roles are resolved from authenticated `user_roles` rows.
- Platform administrator access is independently checked against `platform_administrators`.
- Registration intent is used only to request an allowlisted role through `request_learnora_role`; it is not itself an authorization grant.
- Learner and parent/guardian roles are self-requestable; educator and institution requests remain pending until review.
- The application supports switching only between roles that are active for the signed-in identity.
- Navigation and workspace rendering are constrained by the active role.
- Platform administration remains separately assigned.

### Learner information architecture
The learner application now has dedicated destinations for Overview, Discover, My Learning, Study Plan, Practice & Tests, Resource Library, Live Classes, Opportunities, Progress & Awards, Academic Record, Family Access, Invitations, Learnora AI, Communities & Study Groups, Learning Calendar, Notifications, and Profile & Settings.

### Discover
- Separate discovery rails for verified public educator profiles, publicly listed active institutions, published courses, public learning spaces and opted-in discoverable learner profiles.
- Search and category filtering.
- Learner recommendations use actual shared class/course signals and profile subjects/interests.
- Database RLS limits learner discovery to self or discoverable adult profiles; the client does not download the full user directory.
- Educator and institution directories use existing verification/public-listing controls.

### Family Access
- Separate learner-side and parent/guardian-side experiences.
- Learner-issued one-time invitation codes are hashed, scoped and expire after 72 hours.
- Parent/guardian role is checked by the database workflow before redemption or direct requests.
- Learner acknowledgement is distinct from independent guardian verification.
- Protected access remains relationship- and consent-scoped.
- Current staging database inspection found no guardian relationship or invitation records.

### Live Classes
- Learner class sessions are selected through existing class-membership RLS.
- Educators can schedule and manage sessions through the educator workspace.
- Session status and time windows are represented in the learner workspace.
- Join action is shown only for a live session with a supplied HTTPS meeting URL.
- This is not evidence of a secure LiveKit/token-based conferencing integration; that remains partial.

### Other role workspaces
- Educator application and credential submission.
- Educator live-class scheduling.
- Administrator role-application review.
- Parent/guardian family workspace.
- Institution workspace.
- Learner calendar, notification and profile utility screens.

## Design

- Global typeface and display typography token use Arial/Helvetica/sans-serif.
- External Google font import removed.
- Existing responsive styles and new learner/role workspaces are retained.

## Database and migration notes

- Existing RLS policies inspected include verified educator profile visibility, adult opt-in learner discovery, public institution listing, member-only learning-space discussions, class-member live-session visibility, recipient-only notifications and relationship-participant guardian visibility.
- Role request and discoverable-connection RPCs are present in the database; the public role-request function is SECURITY INVOKER, and the privileged connection aggregation is isolated behind a private function.
- The preview branch includes two final guardian-role migration files. Equivalent role-checking guardian function definitions were already observed in the database; the parent-role backfill migration has not been separately validated as applied. No new migration was executed during this integration step.
- Guardian activation still requires an approved consent version and independent authority verification. Legal approval and production configuration are not claimed.

## Build and deployment evidence

- Cloudflare Pages build for preview commit `dd4160b491a8f11608c51a5482c421f091c952c8` completed successfully: TypeScript check passed, Vite transformed 1,668 modules, and deployment completed.
- Verified preview: https://025ca140.learnora-staging.pages.dev
- Cloudflare Pages project `learnora-staging` has production deployments disabled.
- The production-branch deployment trigger is skipped by configuration; no production deployment was performed.

## Remaining validation

- Real-account signup and role-application lifecycle tests.
- Direct-route and adversarial role-isolation tests across all roles.
- End-to-end guardian invite, learner consent, independent verification and revocation tests.
- Live-class token issuance, video/audio and attendance integration.
- Desktop, tablet and Android visual inspection, accessibility and reduced-motion checks.
- Guardian consent language and POPIA/child-safeguarding review.
- The Vite build reports a non-blocking bundle-size warning for the main JavaScript chunk.

## Evidence labels

- VERIFIED: repository files, role and navigation implementation, selected database schema/policies, migration inventory, Cloudflare build and deployment status.
- PARTIAL: live-class joining, profile privacy controls, family verification and role-application lifecycle.
- BLOCKED: legal approval for guardian consent activation; secure conferencing token integration; real-account and adversarial browser testing.
- NOT CLAIMED: production readiness, full legal compliance, successful end-to-end signup, or tested real-user access.
