# Learnora role-aware redesign — implementation audit

Date: 2026-11-22
Integrated target: `staging/learnora-platform-v1`
Preview source: `preview/role-aware-learner-ecosystem`
Supabase project: `gkloowmlfxfrwcxggnzl`
Scope: staging and isolated preview only. Production deployments remain disabled.

## Verified foundation

- React 19, TypeScript 5.8, Vite 6 and Supabase JS 2.58.
- Existing landing, authentication, course enrolment, learning player, educator course builder, PayFast checkout and notification functions.
- Supabase project ACTIVE_HEALTHY on PostgreSQL 17.
- 63 public base tables inspected; all 63 have RLS enabled.
- 52 migration records currently appear in the connected Supabase migration history. The migration history contains duplicate `learner_discovery_role_gate` names under different version IDs; reconcile migration history before the next CLI-based migration push.
- Canonical roles are stored in `public.user_roles`; platform administrator assignment remains separate in `public.platform_administrators`.
- Existing course, academic, educator, institution, learner-discovery, community, live-class, guardian and notification structures are reused.

## Implemented

### Role-aware application
- Active roles resolve from the authenticated user's `user_roles` rows.
- Platform administrator access resolves separately from an active `platform_administrators` assignment.
- Registration intent only selects an allowlisted role request; it is not itself an authorization grant.
- Learner and parent/guardian account roles can be requested; educator and institution roles remain pending until authorized review.
- Multiple active roles can be switched only when the user holds those roles.
- Navigation and workspace rendering are filtered by active role.
- Role applications and educator verification are represented separately from active access.

### Learner information architecture
Dedicated learner destinations are implemented for Overview, Discover, My Learning, Study Plan, Practice & Tests, Resource Library, Live Classes, Opportunities, Progress & Awards, Academic Record, Family Access, Invitations, Learnora AI, Communities & Study Groups, Learning Calendar, Notifications, and Profile & Settings.

### Discover
- Separate discovery rails for verified public educators, publicly listed active institutions, published courses, public learning spaces and opted-in discoverable learner profiles.
- Search and category filtering.
- Recommendations use available shared class/course signals and subject/interest overlap.
- Learner directory access is restricted by RLS to active learner profiles and adult opt-in discoverability; the UI does not load the full user database.
- Educator and institution discovery use existing verification and public-listing controls.

### Family Access
- Separate learner-side and parent/guardian-side experiences.
- Learner-issued invitation codes are one-time, hashed, scoped and expire after 72 hours.
- Parent/guardian role is checked in database functions before redemption or direct connection requests.
- Learner acknowledgement is distinct from independent guardian-authority verification.
- Access is relationship- and consent-scoped, with revocation controls.
- Current database inspection found no guardian relationship or invitation rows.

### Live Classes
- Learner session reads are restricted by existing class-membership RLS.
- Educators can schedule and manage sessions through their educator workspace.
- Session status and time windows are represented in the learner workspace.
- Join is offered only when the session is live and an HTTPS meeting URL is supplied.
- Secure conferencing token issuance, LiveKit room creation, full video/audio, attendance and screen-sharing flows are not verified.

### Other workspaces
- Educator application and credential submission.
- Educator live-class scheduling.
- Administrator role-application review.
- Parent/guardian family workspace.
- Institution workspace.
- Learner calendar, notifications and profile utility screens.

## Design

- Arial/Helvetica/sans-serif is the global typeface and display typography token.
- External Google font import has been removed from the integrated stylesheet.
- Existing responsive styles and role-specific workspaces are retained.

## Database security

Observed controls include verified educator public profiles, public institution listings, adult opt-in learner discovery, active-learner discovery role gates, member-only learning-space discussions, class-member live-session visibility, recipient-only notifications and relationship-participant guardian visibility.

The public role-request RPC is SECURITY INVOKER. Privileged shared-class/course recommendation aggregation is isolated behind a private SECURITY DEFINER function and exposed through a restricted invoker wrapper. Guardian request/response functions check active parent/guardian or learner roles.

No production schema or production deployment setting was changed. The role-aware and discovery migrations are present in the repository and the connected staging database has corresponding role/discovery/guardian migration records.

## Build, deployment and advisory evidence

- Cloudflare Pages build for integrated staging commit `e5dd4e1ab645fa5874675e49d455e3c61c1fbc78` passed `tsc --noEmit` and `vite build`; 1,668 modules transformed and assets deployed successfully.
- Verified isolated preview: https://05f1f6d6.learnora-staging.pages.dev
- Cloudflare Pages project `learnora-staging` has production deployments disabled; the staging-branch production trigger was skipped and no production deployment was performed.
- The build reports a non-blocking main JavaScript chunk warning (548.46 kB minified).
- Supabase security advisor: one warning — leaked-password protection is disabled. Enable it in Supabase Auth settings after reviewing sign-in impact: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Supabase performance advisor: eight unindexed foreign keys, 97 currently unused indexes and one multiple-permissive-SELECT-policy warning on `institution_directory_profiles`. No health advisories were returned.
- Migration history currently contains 52 records and two entries named `learner_discovery_role_gate` under different version IDs. Reconcile this history before the next CLI-based migration push; do not blindly reset or delete migration records.

## Remaining validation

- Real-account signup, role request, approval, rejection and multi-role switching.
- Direct-route and adversarial RLS tests across every role.
- Guardian invite, learner consent, independent verification and revocation end-to-end tests.
- Secure live-class token issuance, video/audio, attendance and screen sharing.
- Desktop, tablet and Android visual inspection, accessibility and reduced-motion checks.
- Guardian consent language and POPIA/child-safeguarding review.
- Full privacy and communication preference controls beyond the currently implemented profile fields.

## Evidence labels

- VERIFIED: repository implementation, selected RLS policies, 63-table RLS state, migration inventory, successful Cloudflare build and preview deployment.
- PARTIAL: live-class joining, family verification lifecycle, role approval lifecycle, full profile privacy controls.
- BLOCKED: legal approval for guardian consent activation; secure conferencing token integration; real-account and adversarial browser tests.
- NOT CLAIMED: production readiness, full legal compliance, or end-to-end tested real-user access.
