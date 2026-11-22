# Learnora role and permission matrix

Status: implementation baseline, 2026-11-22
Branch: `staging/learnora-platform-v1`

This matrix records the frontend workspace gates added in the current staging work and the existing database policy boundaries inspected. It is not a substitute for a complete route-by-route adversarial test.

## Canonical role resolution

- Active roles are loaded from `public.user_roles` for the authenticated `auth.uid()`, filtered to `status = 'active'`.
- Platform administration is independently resolved from an active row in `public.platform_administrators`.
- Browser-supplied `signup_intent` / user metadata is not used to grant a workspace.
- The frontend hides navigation and refuses to render a workspace unless the corresponding active role is present.
- Supabase RLS and server-side checks remain authoritative. Frontend gates are not the security boundary.

## Workspace access

| Workspace / view | Learner | Parent / Guardian | Educator | Institution | Platform administrator |
|---|---:|---:|---:|---:|---:|
| Course discovery | Yes | No | No | No | No |
| My learning / study plan / practice / resources / opportunities / progress | Yes | No | No | No | No |
| Learnora AI | Yes | No | No | No | No |
| Academic record | Yes | No | Educator workspace only | No | No |
| Family workspace | Yes (learner side) | Yes | No | No | No |
| Invitations | Yes | Yes | Yes | Yes | No |
| Educator studio | No | No | Yes | No | No |
| Institution workspace | No | No | No | Yes | No |
| Platform administration | No | No | No | No | Yes |

Users with multiple active roles may see the corresponding workspaces. No role is inferred from a registration selection.

## Database security evidence inspected

| Data domain | Existing database control observed |
|---|---|
| User roles | User can select own role rows; active platform administrators can update role records. No ordinary self-service role elevation policy was observed. |
| Platform administration | Dedicated `platform_administrators` table; active admin check is separate from ordinary role metadata. |
| Educator directory | Public profile SELECT requires `public_profile = true` and `verification_status = 'verified'`; self profile remains visible to owner. |
| Learner directory | SELECT allows self or discoverable adult profile according to `private.is_adult_discoverable`; minors are not indiscriminately exposed. |
| Institution directory | Public SELECT requires `public_listing` and `private.is_active_public_org`; manager operations require organisation membership. |
| Learning spaces | Active public spaces, owners and active members can read; joining is constrained to public active spaces and self-membership. |
| Learning-space posts | Read and create require active membership or ownership; author/owner controls update/delete. |
| Live classes | SELECT requires class membership, class staff or active platform administrator; create/update requires class staff and educator ownership. |
| Guardian relationships | SELECT is limited to relationship participants; guardian-side creation is pending and consent/verification fields are required. |
| Guardian invitations | Learner can read invitations they issued; secure invitation creation and redemption remain governed by the existing guardian workflow. |
| Notifications | SELECT is restricted to the recipient user. |

## Known implementation gaps

- The learner navigation still exposes only the currently implemented learner destinations; the full requested 17-destination learner information architecture is not complete.
- Discover remains primarily a published-course catalogue. Dedicated educator, institution, community, study-group and opted-in learner discovery rails are still required.
- Live-class listing and a secure join-token/conferencing flow have not been end-to-end verified.
- The registration flow currently stores account intent as user metadata; a secure, server-controlled role request / approval flow is still needed before new accounts can receive active learner, parent, educator or institution roles.
- Parent/guardian relationship activation remains blocked until the approved consent version and verification process are configured and legally reviewed.
- Direct-route and adversarial role-isolation tests have not yet been executed.
