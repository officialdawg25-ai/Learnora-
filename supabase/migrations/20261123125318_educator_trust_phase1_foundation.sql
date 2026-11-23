-- Phase 1: educator professional identity, verification evidence metadata and audit controls.
alter table public.educator_profiles
  add column if not exists professional_category text,
  add column if not exists professional_country_code char(2) not null default 'ZA',
  add column if not exists teaching_philosophy text;

alter table public.educator_profiles
  drop constraint if exists educator_profiles_professional_category_check;
alter table public.educator_profiles
  add constraint educator_profiles_professional_category_check
  check (professional_category is null or professional_category in (
    'registered_educator',
    'provisionally_registered_educator',
    'student_educator',
    'private_tutor',
    'subject_specialist',
    'learning_facilitator',
    'institution_affiliated_educator',
    'international_educator'
  ));

alter table public.educator_verification_submissions
  add column if not exists issuer_country_code char(2),
  add column if not exists verification_method text,
  add column if not exists verification_source text,
  add column if not exists verification_reference text,
  add column if not exists valid_from date,
  add column if not exists expires_at date,
  add column if not exists review_due_at date;

alter table public.educator_verification_submissions
  drop constraint if exists educator_verification_submissions_method_check;
alter table public.educator_verification_submissions
  add constraint educator_verification_submissions_method_check
  check (verification_method is null or verification_method in (
    'manual_document_review',
    'authoritative_registry',
    'institution_confirmation',
    'provider_identity_check',
    'qualification_evaluation'
  ));

create index if not exists educator_verification_queue_idx
  on public.educator_verification_submissions(status, submitted_at);
create index if not exists educator_verification_owner_history_idx
  on public.educator_verification_submissions(educator_user_id, submitted_at desc);

create table if not exists public.educator_verification_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.educator_verification_submissions(id) on delete restrict,
  educator_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('submitted','reviewed','evidence_updated','status_changed')),
  previous_status text,
  new_status text,
  notes text,
  verification_method text,
  verification_source text,
  verification_reference text,
  created_at timestamptz not null default now()
);
create index if not exists educator_verification_events_owner_idx
  on public.educator_verification_events(educator_user_id, created_at desc);
alter table public.educator_verification_events enable row level security;
grant select on public.educator_verification_events to authenticated;
grant all on public.educator_verification_events to service_role;
revoke insert, update, delete, truncate on public.educator_verification_events from anon, authenticated;
drop policy if exists educator_verification_events_select_owner on public.educator_verification_events;
create policy educator_verification_events_select_owner
  on public.educator_verification_events
  for select to authenticated
  using (educator_user_id = (select auth.uid()));

create or replace function private.record_educator_verification_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.educator_verification_events (
      submission_id, educator_user_id, actor_user_id, event_type,
      previous_status, new_status, notes, verification_method,
      verification_source, verification_reference
    ) values (
      new.id, new.educator_user_id, auth.uid(), 'submitted',
      null, new.status, null, new.verification_method,
      new.verification_source, new.verification_reference
    );
    return new;
  end if;

  if new.status is distinct from old.status
     or new.reviewer_user_id is distinct from old.reviewer_user_id
     or new.reviewer_notes is distinct from old.reviewer_notes
     or new.verification_method is distinct from old.verification_method
     or new.verification_source is distinct from old.verification_source
     or new.verification_reference is distinct from old.verification_reference then
    v_actor := coalesce(auth.uid(), new.reviewer_user_id);
    insert into public.educator_verification_events (
      submission_id, educator_user_id, actor_user_id, event_type,
      previous_status, new_status, notes, verification_method,
      verification_source, verification_reference
    ) values (
      new.id, new.educator_user_id, v_actor,
      case when new.status is distinct from old.status then 'status_changed' else 'reviewed' end,
      old.status, new.status, left(coalesce(new.reviewer_notes, ''), 4000),
      new.verification_method, new.verification_source, new.verification_reference
    );
  end if;
  return new;
end;
$function$;
revoke all on function private.record_educator_verification_event() from public, anon, authenticated;
drop trigger if exists educator_verification_event_log on public.educator_verification_submissions;
create trigger educator_verification_event_log
  after insert or update on public.educator_verification_submissions
  for each row execute function private.record_educator_verification_event();

create or replace function private.require_verified_educator_before_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_previous_status text;
begin
  if tg_op = 'UPDATE' then
    v_previous_status := old.status;
  end if;

  if new.role = 'educator'
     and new.status = 'active'
     and (tg_op = 'INSERT' or v_previous_status is distinct from 'active') then
    if not exists (
      select 1
      from public.educator_profiles ep
      where ep.user_id = new.user_id
        and ep.verification_status = 'verified'
    ) then
      raise exception 'Educator access requires an approved professional verification record.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.require_verified_educator_before_activation() from public, anon, authenticated;
drop trigger if exists user_roles_require_verified_educator on public.user_roles;
create trigger user_roles_require_verified_educator
  before insert or update of role, status on public.user_roles
  for each row execute function private.require_verified_educator_before_activation();
