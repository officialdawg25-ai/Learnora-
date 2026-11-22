# Learnora

**Where Potential Becomes Possibility.**

Learnora is an integrated educational infrastructure and intelligence ecosystem, beginning in South Africa.

## Current status

The repository is being established against an existing Supabase project. See the [verified Phase 0 audit](docs/audit/phase-0.md) and [target architecture](docs/architecture/target-architecture.md). The full product is not yet complete; functionality is delivered incrementally and marked complete only after verification.

## Technology

- React, TypeScript and Vite
- Supabase Auth, PostgreSQL, RLS and Storage
- Provider-independent AI gateway (planned)
- PayFast (planned; no live payment configuration)
- PWA and offline capabilities (phased)

## Local development

1. Install Node.js 20 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set the Supabase project URL and publishable/anon key.
5. Run `npm run dev`.

Never put a Supabase service-role key, AI provider secret or payment secret in a browser environment variable.

## Engineering rules

Inspect before modifying. Preserve the existing schema and RLS. No fake data, fabricated metrics or fake integrations. Server-side authorization is authoritative. No production payment activation or destructive migration without explicit approval. Report VERIFIED, PARTIAL, INFERRED, PROPOSED and BLOCKED accurately.
