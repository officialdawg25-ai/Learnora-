-- Reuse the existing private.guard_user_role_update() trigger for educator verification gating.
-- Remove the duplicate Phase 1 trigger introduced before the existing guard was discovered.
drop trigger if exists user_roles_require_verified_educator on public.user_roles;
drop function if exists private.require_verified_educator_before_activation();
