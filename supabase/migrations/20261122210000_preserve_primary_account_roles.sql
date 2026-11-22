-- Legacy profiles default to learner only when no non-learner account intent or verified role exists.
delete from public.user_roles ur
using auth.users au
where au.id=ur.user_id
  and ur.role='learner'
  and ur.source='verified_legacy'
  and (
    au.raw_user_meta_data->>'signup_intent' in ('parent','educator','institution')
    or exists(select 1 from public.guardian_relationships gr where gr.guardian_user_id=ur.user_id and gr.status='active' and gr.revoked_at is null)
    or exists(select 1 from public.educator_profiles ep where ep.user_id=ur.user_id and ep.verification_status='verified')
    or exists(select 1 from public.organisation_memberships om where om.user_id=ur.user_id and om.status='active' and om.role in ('owner','admin','academic_manager','department_head'))
    or exists(select 1 from public.platform_administrators pa where pa.user_id=ur.user_id and pa.status='active')
  );
