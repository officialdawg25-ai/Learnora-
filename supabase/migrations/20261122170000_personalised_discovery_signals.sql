-- Privacy-preserving recommendation signals: shared class/course counts only.
create or replace function public.discoverable_learning_connections()
returns table(user_id uuid, shared_class_count integer, shared_course_count integer)
language sql stable security definer set search_path=''
as $$
  select d.user_id,
    (select count(distinct mine.class_id)::integer
       from public.class_memberships mine
       join public.class_memberships theirs on theirs.class_id=mine.class_id
      where mine.user_id=auth.uid() and mine.status='active'
        and theirs.user_id=d.user_id and theirs.status='active') as shared_class_count,
    (select count(distinct mine.course_id)::integer
       from public.enrolments mine
       join public.enrolments theirs on theirs.course_id=mine.course_id
      where mine.learner_id=auth.uid() and mine.status in ('active','completed')
        and theirs.learner_id=d.user_id and theirs.status in ('active','completed')) as shared_course_count
  from public.learner_discovery_profiles d
  where auth.uid() is not null and d.user_id<>auth.uid() and d.discoverable=true
    and private.is_adult_discoverable(d.user_id);
$$;
revoke all on function public.discoverable_learning_connections() from public,anon;
grant execute on function public.discoverable_learning_connections() to authenticated;

create or replace function private.guard_profile_date_of_birth()
returns trigger language plpgsql set search_path=''
as $$
begin
  if auth.uid() is not null and auth.uid()=old.id and old.date_of_birth is not null
     and new.date_of_birth is distinct from old.date_of_birth then
    raise exception 'Date of birth cannot be changed through ordinary profile editing. Contact Learnora support for a correction.';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_date_of_birth on public.profiles;
create trigger guard_profile_date_of_birth before update on public.profiles
for each row execute function private.guard_profile_date_of_birth();
