insert into public.user_roles(user_id,role,status,source)
select distinct gr.guardian_user_id,'parent_guardian','active','verified_legacy'
from public.guardian_relationships gr
where gr.status in ('pending','active') and gr.revoked_at is null
on conflict(user_id,role) do nothing;

delete from public.user_roles ur
where ur.role='learner' and ur.source='verified_legacy'
and exists(select 1 from public.guardian_relationships gr where gr.guardian_user_id=ur.user_id and gr.status in ('pending','active') and gr.revoked_at is null);
