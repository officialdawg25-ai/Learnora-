-- Run against the Learnora Supabase project after migrations.
-- This file is read-only: the DO block raises if a required security invariant fails.
do $test$
declare
 v_total integer;
 v_rls integer;
 v_bad_grants integer;
 v_bad_functions integer;
 v_policy_count integer;
 v_bucket_count integer;
 v_migration_count integer;
begin
 select count(*),count(*) filter(where c.relrowsecurity)
 into v_total,v_rls
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r';
 if v_total=0 or v_total<>v_rls then
  raise exception 'RLS invariant failed: % public tables, % with RLS',v_total,v_rls;
 end if;

 select count(*) into v_bad_grants
 from information_schema.table_privileges
 where table_schema='public' and grantee='anon'
 and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER');
 if v_bad_grants<>0 then raise exception 'Anonymous write/administrative table grants detected: %',v_bad_grants; end if;

 if has_table_privilege('authenticated','public.assessment_attempts','insert')
  or has_table_privilege('authenticated','public.assessment_attempts','update')
  or has_table_privilege('authenticated','public.learning_progress','insert')
  or has_table_privilege('authenticated','public.learning_progress','update') then
  raise exception 'Direct client writes remain enabled for protected learning records';
 end if;

 if has_table_privilege('authenticated','public.platform_administrators','insert')
  or has_table_privilege('authenticated','public.platform_administrators','update')
  or has_table_privilege('authenticated','public.platform_administrators','delete') then
  raise exception 'Platform administrator self-assignment privilege detected';
 end if;

 select count(*) into v_policy_count from pg_policies
 where schemaname='public' and tablename='ai_messages'
 and cmd='INSERT' and with_check like '%role = ''user''%';
 if v_policy_count<>1 then raise exception 'AI message role integrity policy missing or ambiguous'; end if;

 select count(*) into v_bad_functions from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'
 and p.proname in ('record_lesson_progress','submit_assessment_attempt','grade_assessment_attempt')
 and p.prosecdef;
 if v_bad_functions<>0 then raise exception 'Exposed learning RPC wrappers must be SECURITY INVOKER'; end if;

 select count(*) into v_bad_functions from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private'
 and p.proname in ('record_lesson_progress','submit_assessment_attempt','grade_assessment_attempt')
 and not p.prosecdef;
 if v_bad_functions<>0 then raise exception 'Private learning workflow implementations must be SECURITY DEFINER'; end if;

 if has_table_privilege('anon','public.assessment_question_keys','select') then
  raise exception 'Anonymous answer-key access detected';
 end if;

 select count(*) into v_bucket_count from storage.buckets
 where id='learnora-verification' and public=false and file_size_limit<=10485760;
 if v_bucket_count<>1 then raise exception 'Private educator verification bucket configuration missing'; end if;

 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='credential_verification_index' and column_name='recipient_user_id') then
  raise exception 'Public credential verification index exposes recipient identity';
 end if;

 select count(*) into v_migration_count from supabase_migrations.schema_migrations;
 if v_migration_count<34 then raise exception 'Remote migration ledger unexpectedly short: %',v_migration_count; end if;

 raise notice 'Learnora security invariants passed: % public tables with RLS, % migrations.',v_rls,v_migration_count;
end
$test$;
