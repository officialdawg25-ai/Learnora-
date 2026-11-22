# Learnora

**Where Potential Becomes Possibility.**

Learnora is an education, intelligence and learning ecosystem being developed for South Africa, with an architecture intended to support broader markets.

## Implemented foundation

- React/Vite application foundation and responsive learner/educator experiences.
- Supabase email/password authentication and profile bootstrap.
- Published course discovery and subject filtering.
- Free-course enrolment.
- Educator academy creation.
- Draft course creation.
- Initial PostgreSQL learning schema and RLS policies.

This is not yet the complete 360-degree product. Payments, AI services, institutional administration, guardian access, community messaging, live classrooms, credentials and production safeguarding workflows remain separate implementation phases.

## Local development

1. Copy .env.example to .env.local.
2. Set VITE_SUPABASE_URL to the Learnora project URL.
3. Set VITE_SUPABASE_ANON_KEY to the project's publishable/anon key. Never use a service-role or secret key in a browser.
4. Run npm install.
5. Run npm run dev.
6. Verify with npm run build.

## Supabase

Project reference: gkloowmlfxfrwcxggnzl (PostgreSQL 17).

The core schema and RLS foundation, followed by privilege hardening and public course discovery policies, have been applied to the linked Supabase project. The initial foundation migration was applied remotely before this branch was populated; reconcile and pull the remote migration history into the repository with the Supabase CLI before production release.

## Product principles

- One identity system with contextual memberships.
- Educators remain accountable for teaching and high-impact academic decisions.
- AI is assistive and evaluated, not guaranteed truth.
- No fabricated educators, learners, testimonials, qualifications or metrics.
- Paid enrolment stays disabled until verified checkout exists.
- Minors require age-appropriate onboarding, guardian consent where applicable and safeguarding controls before restricted features are enabled.

## Current limitations

- Educator studio creates draft academies and courses; module/lesson authoring and publishing are not yet implemented.
- Learner view discovers and enrols in free courses; lesson player and assessment workflows remain to be implemented.
- No AI provider is configured or called by the frontend.
- No PayFast checkout or educator payout is enabled.
- The database schema is a foundation, not a claim of POPIA compliance or production launch readiness.
