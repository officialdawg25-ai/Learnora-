-- Capture a self-declared date of birth at signup for age-appropriate experience routing.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_dob date;
begin
  begin
    v_dob := nullif(new.raw_user_meta_data ->> 'date_of_birth','')::date;
  exception when others then
    v_dob := null;
  end;
  if v_dob is not null and v_dob > current_date then v_dob := null; end if;
  insert into public.profiles (id,display_name,date_of_birth)
  values (new.id,nullif(new.raw_user_meta_data ->> 'display_name',''),v_dob)
  on conflict (id) do nothing;
  return new;
end;
$function$;
revoke all on function private.handle_new_user() from public,anon,authenticated;
