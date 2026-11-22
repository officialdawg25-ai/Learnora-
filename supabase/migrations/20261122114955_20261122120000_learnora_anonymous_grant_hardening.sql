-- Anonymous users only need the explicitly public discovery and credential verification surfaces.
-- RLS remains enabled; this migration also removes unnecessary table-level capabilities.
revoke all privileges on all tables in schema public from anon;
grant select on table public.academies, public.courses, public.credential_verification_index to anon;

revoke all privileges on all sequences in schema public from anon;

-- Prevent future objects created by the migration owner from inheriting broad anon grants.
alter default privileges in schema public revoke all privileges on tables from anon;
alter default privileges in schema public revoke all privileges on sequences from anon;
