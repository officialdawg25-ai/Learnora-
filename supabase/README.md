# Supabase project notes

Project reference: gkloowmlfxfrwcxggnzl.

The initial core schema migration and the follow-up RLS hardening migration were applied to the remote project using the Supabase management connection. The second migration source is tracked in this repository. The first migration predates the repository bootstrap and must be reconciled from remote migration history using the Supabase CLI before treating this repository as the canonical migration source.

Do not apply a reconstructed schema over the live project. Pull and compare remote migrations, then commit the exact canonical SQL. Run security and performance advisors after schema changes.
