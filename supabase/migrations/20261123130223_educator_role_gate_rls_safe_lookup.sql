-- The role update trigger must read private educator verification state even when the reviewer cannot select that profile under RLS.
-- Keep the existing trigger and checks, but execute the internal lookup as its owner.
create or replace function private.guard_user_role_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.user_id is distinct from old.user_id or new.role is distinct from old.role then
    raise exception 'Account identity and role cannot be changed through a role status update.';
  end if;

  if new.role = 'educator' and new.status = 'active' and not exists (
    select 1
    from public.educator_profiles ep
    where ep.user_id = new.user_id
      and ep.verification_status = 'verified'
  ) then
    raise exception 'Educator role requires verified educator credentials.';
  end if;

  if new.role = 'platform_admin' and new.status = 'active' and not exists (
    select 1
    from public.platform_administrators pa
    where pa.user_id = new.user_id
      and pa.status = 'active'
  ) then
    raise exception 'Platform administrator access requires a separate active administrator assignment.';
  end if;

  return new;
end;
$function$;

revoke all on function private.guard_user_role_update() from public, anon, authenticated;
