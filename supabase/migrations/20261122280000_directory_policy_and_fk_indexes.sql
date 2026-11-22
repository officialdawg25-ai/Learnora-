-- Combine public and institution-manager directory access in one SELECT policy.
drop policy if exists institution_directory_public_select on public.institution_directory_profiles;
drop policy if exists institution_directory_manager_select on public.institution_directory_profiles;
drop policy if exists institution_directory_select_public_or_manager on public.institution_directory_profiles;
create policy institution_directory_select_public_or_manager on public.institution_directory_profiles for select to authenticated
using(
 (public_listing and private.is_active_public_org(organisation_id))
 or private.has_active_membership(organisation_id,array['owner','admin'])
);

-- Cover foreign keys used in membership, timeline and relationship queries.
create index if not exists learning_space_memberships_user_idx on public.learning_space_memberships(user_id);
create index if not exists learning_space_posts_author_idx on public.learning_space_posts(author_user_id);
create index if not exists learning_spaces_owner_idx on public.learning_spaces(owner_user_id);
create index if not exists live_class_sessions_course_idx on public.live_class_sessions(course_id);
create index if not exists live_class_sessions_creator_idx on public.live_class_sessions(created_by);
create index if not exists live_class_sessions_educator_idx on public.live_class_sessions(educator_user_id);
create index if not exists user_notifications_actor_idx on public.user_notifications(actor_user_id);
create index if not exists user_roles_reviewed_by_idx on public.user_roles(reviewed_by);
