# Learnora role-aware redesign — implementation audit

Date: 2026-11-22
Target branch: `staging/learnora-platform-v1`
Supabase project: `gkloowmlfxfrwcxggnzl`
Scope: staging only. Do not merge to `main` or deploy production without explicit authorization.

## Verified repository and platform state

- React 19, TypeScript 5.8 and Vite 6 application.
- Supabase JS 2.58.
- Existing public landing and authentication flow.
- Existing learner, family, educator, institution, academic, invitation and platform-admin components.
- Existing learning player, course builder, educator operations, Learnora AI and institution workspace.
- Existing PayFast checkout and notification Edge Functions.
- Existing learner discovery profile, educator public profile, institution directory, learning spaces, memberships, posts, live-class sessions, guardian relationships and guardian invitations.

## Verified database state

- Supabase project status: ACTIVE_HEALTHY.
- PostgreSQL 17.
- 63 public base tables inspected; all 63 have RLS enabled.
- Existing canonical role table: `public.user_roles`.
- Existing platform administrator table: `public.platform_administrators`.
- Existing discovery tables: `learner_discovery_profiles`, `educator_profiles`, `institution_directory_profiles`, `courses`, `learning_spaces`.
- Existing live-class table: `live_class_sessions`; SELECT is restricted to class members, class staff or active platform administrators.
- Existing guardian tables: `guardian_relationships`, `guardian_connection_invites`, and `guardian_relationship_events`.
- Learner discovery policy permits self visibility and discoverable adult profiles; it does not expose all learners indiscriminately.
- Educator public profiles are visible only when public and verified.
- Institution directory rows require public listing and an active public organisation.
- Learning-space membership and post policies restrict participation to members/owners.
- Guardian relationship activation is constrained by verification and consent fields. Existing implementation notes that legal consent-version approval remains outstanding.

## Verified gaps from the current learner UI

The current learner component exposes seven sections: Overview, My Learning, Study Plan, Practice & Tests, Resource Library, Opportunities, and Progress & Awards.

The requested learner information architecture additionally requires dedicated destinations for Live Classes, Academic Record, Family Access, Invitations, Learnora AI, Communities & Study Groups, Learning Calendar, Notifications, and Profile & Settings. Discover is currently a general course catalogue in the top-level application rather than a personalized multi-category discovery workspace.

The top-level authenticated navigation currently includes learner, parent, educator, institution and administrator destinations together. Frontend role separation therefore needs additional work; RLS remains the authoritative boundary.

## Changes made in this staging commit

- Removed external Google font imports from the portal stylesheet.
- Set the global typeface and display typeface tokens to Arial/Helvetica/sans-serif.
- No database schema, RLS policy, authentication metadata, production setting or live learner data was changed.

## Required next implementation and validation

1. Resolve active roles from `user_roles` and the dedicated administrator assignment table; do not authorize from browser-supplied signup metadata.
2. Make navigation and direct-view rendering role-aware while retaining server/RLS checks.
3. Expand the learner experience into the full requested screen map.
4. Implement the Discover rails using existing verified/public profile policies and database-side pagination.
5. Connect existing FamilyWorkspace and InvitationsWorkspace to learner-specific views without weakening guardian verification or consent.
6. Add the learner live-class view using class membership and session RLS. Do not expose meeting credentials until a secure join-token flow is verified.
7. Add calendar aggregation and profile/privacy controls.
8. Run TypeScript/build, browser/device, role-isolation and adversarial RLS tests.
9. Deploy only to an isolated Cloudflare preview.

## Evidence status

- VERIFIED: repository metadata, branch existence, application files, Supabase project status, public table inventory, RLS-enabled state, selected policies and schema.
- PARTIAL: current role-aware architecture and existing guardian/live-class workflows.
- BLOCKED: full end-to-end verification without real-account browser tests, approved guardian consent language, and confirmed secure conferencing token issuance.
- NOT CLAIMED: production readiness, complete role isolation, fully operational live conferencing, or legal approval.
