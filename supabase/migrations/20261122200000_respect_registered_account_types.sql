-- Avoid turning existing parent, educator and institution accounts into learner accounts
-- solely because their profiles existed before the role table was introduced.
delete from public.user_roles ur
using auth.users au
where au.id=ur.user_id
  and ur.role='learner'
  and ur.source='verified_legacy'
  and au.raw_user_meta_data->>'signup_intent' in ('parent','educator','institution');
