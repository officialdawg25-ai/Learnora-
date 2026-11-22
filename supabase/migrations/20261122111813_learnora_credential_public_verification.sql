-- Public credential verification uses a minimal index table, not a SECURITY DEFINER view.
drop view if exists public.credential_verification_public;
create table public.credential_verification_index (
 credential_identifier text primary key references public.credentials(credential_identifier) on delete cascade,
 issuer_name text not null,
 credential_title text not null,
 credential_type text not null,
 issued_at timestamptz not null,
 status text not null check(status in ('active','revoked','expired')),
 accreditation_reference text,
 updated_at timestamptz not null default now()
);
alter table public.credential_verification_index enable row level security;
grant select on public.credential_verification_index to anon,authenticated;
revoke insert,update,delete on public.credential_verification_index from anon,authenticated;
create policy credential_verification_active_public on public.credential_verification_index
for select to anon,authenticated using(status='active');

create or replace function private.sync_credential_verification_index()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 if tg_op='DELETE' then
  delete from public.credential_verification_index where credential_identifier=old.credential_identifier;
  return old;
 end if;
 insert into public.credential_verification_index(credential_identifier,issuer_name,credential_title,credential_type,issued_at,status,accreditation_reference,updated_at)
 values(new.credential_identifier,new.issuer_name,new.credential_title,new.credential_type,new.issued_at,new.status,new.accreditation_reference,now())
 on conflict(credential_identifier) do update set
  issuer_name=excluded.issuer_name,credential_title=excluded.credential_title,credential_type=excluded.credential_type,
  issued_at=excluded.issued_at,status=excluded.status,accreditation_reference=excluded.accreditation_reference,updated_at=now();
 return new;
end;
$function$;
revoke all on function private.sync_credential_verification_index() from public,anon,authenticated;
create trigger credentials_sync_public_index
after insert or update or delete on public.credentials
for each row execute function private.sync_credential_verification_index();
