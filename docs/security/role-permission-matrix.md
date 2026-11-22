# Learnora role and permission matrix

Status: integrated implementation baseline, 2026-11-22
Target branch: `staging/learnora-platform-v1`

## Role resolution and account creation

| Role | Self-request | Initial status | Additional authorization |
|---|---|---|---|
| Learner | Yes | Active | Age-appropriate safeguards and privacy settings |
| Parent / Guardian | Yes | Active account role only | Guardian relationship, learner consent and independent authority verification required for child records |
| Educator | Yes | Pending | Educator profile and credential verification before activation |
| Institution | Yes | Pending | Institution application and authorized review |
| Platform administrator | No | Not self-requestable | Separate active administrator assignment |

Registration metadata is an onboarding intent only. Authorization comes from the authenticated identity's active `user_roles` row and, for platform administration, the separate `platform_administrators` assignment. Multiple active roles are supported where explicitly granted.

## Workspace access

| Workspace | Learner | Parent / Guardian | Educator | Institution | Platform administrator |
|---|---:|---:|---:|---:|---:|
| Overview / Discover / My Learning | Yes | No | No | No | No |
| Study Plan / Practice / Resources | Yes | No | No | No | No |
| Live Classes / Opportunities / Progress | Yes | No | No | No | No |
| Academic Record | Yes | Relationship-scoped child records | Educator scope | Institution scope | Administrative scope |
| Family Access | Learner-side connection controls | Guardian-side connection controls | No | No | Review only where separately authorized |
| Invitations | Relevant invitations | Relevant invitations | Relevant invitations | Relevant invitations | Administrative review |
| Communities & Study Groups | Yes | No | Role-specific spaces | No | Oversight |
| Learning Calendar / Notifications / Profile Settings | Own records | Own records | Own records | Own records | Own records |
| Learnora AI | Yes | No | Existing educator context only where enabled | No | No |
| Educator Studio / Applications | No | No | Yes / pending application | No | Review |
| Institution Workspace | No | No | No | Yes after approval | Review |
| Platform Administration / Role Applications | No | No | No | No | Yes |

The UI hides navigation and guards workspace rendering, but database RLS and server-side functions remain the authoritative security boundary.

## Verified database controls

| Domain | Observed control |
|---|---|
| `user_roles` | Users can read their own roles; active administrators can review/update role status; allowlisted role requests are server-validated |
| Platform administration | Separate active assignment in `platform_administrators` |
| Educator discovery | Public profile and verified status required |
| Learner discovery | Self or opted-in discoverable adult profiles only |
| Institution discovery | Public listing and active organisation required |
| Learning spaces | Active public spaces, owners and active members |
| Discussions | Posts restricted to members/owners; author/owner mutation controls |
| Live classes | Class member/staff or active administrator SELECT; class-staff creation/update |
| Guardian relationships | Participant visibility; role-checked requests; learner acknowledgement separate from verification |
| Notifications | Recipient-only SELECT |

## Known limits

- Live class join currently depends on a supplied HTTPS meeting URL; secure conferencing token issuance and full video integration are not verified.
- Guardian activation remains dependent on approved consent configuration and independent evidence review.
- Real-account, adversarial RLS, direct-route and Android browser testing remain outstanding.
- Profile settings currently cover only implemented profile fields; full privacy and communication preference controls need further work.
