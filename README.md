# Learnora

**Where Potential Becomes Possibility.**

Learnora is an education, intelligence and learning ecosystem being developed for South Africa, with an architecture intended to support broader markets.

## Current delivery status

- The integrated platform foundation has been merged into `staging/learnora-platform-v1`.
- Staging preview: https://20b8d484.learnora-staging.pages.dev
- GitHub pull request: https://github.com/officialdawg25-ai/Learnora-/pull/1
- GitHub Actions build and dependency advisory gate passed on the staging merge commit.
- Cloudflare Pages build and deployment completed successfully.
- The Cloudflare Pages project is configured with production deployments disabled. The repository `main` branch has not been changed.

This is a staging release for controlled review and user acceptance testing. It is not a production launch or a claim that every planned Learnora capability is complete.

## Platform foundation

The current implementation includes learner discovery and enrolment, a learner learning space and lesson player, educator academy/course authoring, assessment authoring and marking, course version snapshots, educator verification and private evidence upload, academy teams and invitations, publication review, educator analytics, Learnora AI Tutor/Teacher interfaces, guardian relationship requests, institution/class workspaces, competency records, credentials, opportunities, PayFast sandbox checkout foundations, financial ledger and reconciliation foundations, safeguarding records, and permission-gated platform administration.

See [implementation status](docs/implementation/STATUS.md) for verified scope, environment counts, security posture and remaining limitations.

## Staging environment boundary

The staging website currently uses the existing Learnora Supabase project:
- Project reference: `gkloowmlfxfrwcxggnzl`
- API URL: `https://gkloowmlfxfrwcxggnzl.supabase.co`

A separate Supabase development branch has not been created because branch creation requires explicit cost approval. Until an isolated staging database is approved, staging registrations and test activity will write to the shared Learnora Supabase project. Do not enter real learner records, identity documents or sensitive student information during staging tests.

Cloudflare Pages project: `learnora-staging`
- Production branch: `main`
- Production deployments: disabled
- Preview deployments: only `staging/learnora-platform-v1`
- Build command: `npm install && npm run build`
- Output directory: `dist`

## Local development

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` to the Learnora project URL.
3. Set `VITE_SUPABASE_ANON_KEY` to the project's publishable/anon key. Never use a service-role or secret key in a browser.
4. Run `npm install`.
5. Run `npm run dev`.
6. Verify with `npm run build`.

## Supabase

Project reference: `gkloowmlfxfrwcxggnzl` (PostgreSQL 17, eu-west-1).

The repository contains all 36 applied migrations under their exact remote migration IDs. All 56 public application tables have RLS enabled. The project has no seeded Auth users or platform administrators. Five Edge Functions are deployed; AI provider credentials and PayFast merchant secrets are not configured.

## Production-readiness gates

Before production release, complete real-account/browser/device UAT, adversarial RLS and tenant-isolation tests, isolated staging database validation, AI provider configuration and evaluations, PayFast sandbox end-to-end verification, legal review of guardian/child consent and POPIA controls, first-admin bootstrap, backups/restore testing, and operational review of refund, reconciliation, payout and incident procedures.

## Product principles

- One identity system with contextual memberships.
- Educators remain accountable for teaching and high-impact academic decisions.
- AI is assistive and evaluated, not guaranteed truth.
- No fabricated educators, learners, testimonials, qualifications or metrics.
- Paid enrolment stays disabled until verified checkout and operational controls are complete.
- Minors require age-appropriate onboarding, guardian consent where applicable and safeguarding controls before restricted features are enabled.
