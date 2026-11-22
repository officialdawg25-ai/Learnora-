-- Learnora Parent & Family 360: additive, relationship-scoped records.
-- Existing Auth, profiles, roles and guardian_relationships remain canonical.
create schema if not exists private;

create table if not exists public.learner_login_usernames (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_normalized text not null unique,
  login_email text not null unique,
  issued_by_parent uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint learner_username_format check (username_normalized ~ '^[a-z0-9][a-z0-9._-]{2,29}$')
);
alter table public.learner_login_usernames enable row level security;
revoke all on public.learner_login_usernames from anon, authenticated;
grant all on public.learner_login_usernames to service_role;

create table if not exists public.family_learner_details (
  learner_user_id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid null references public.organisations(id) on delete set null,
  grade_label text,
  class_label text,
  academic_year integer,
  preferred_language text not null default 'en',
  created_by_parent uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.family_learner_details enable row level security;

create or replace function private.is_verified_guardian(p_learner_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists (
  select 1 from public.guardian_relationships g
  where g.guardian_user_id=auth.uid() and g.learner_user_id=p_learner_id
   and g.status='active' and g.learner_consent_status='approved' and g.revoked_at is null
 );
$$;
revoke all on function private.is_verified_guardian(uuid) from public,anon;
grant execute on function private.is_verified_guardian(uuid) to authenticated;

create table if not exists public.family_attendance_records (
 id uuid primary key default gen_random_uuid(),
 learner_user_id uuid not null references auth.users(id) on delete cascade,
 institution_id uuid references public.organisations(id) on delete set null,
 attendance_date date not null,
 attendance_status text not null check(attendance_status in ('present','absent','late','excused')),
 arrival_time time,
 explanation text,
 recorded_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(learner_user_id,attendance_date)
);
alter table public.family_attendance_records enable row level security;
create policy family_attendance_parent_read on public.family_attendance_records for select to authenticated using(private.is_verified_guardian(learner_user_id));

create table if not exists public.family_tuition_invoices (
 id uuid primary key default gen_random_uuid(),
 learner_user_id uuid not null references auth.users(id) on delete cascade,
 institution_id uuid references public.organisations(id) on delete set null,
 invoice_number text not null unique,
 description text not null,
 currency char(3) not null default 'ZAR' check(currency='ZAR'),
 total_minor bigint not null check(total_minor>=0),
 amount_paid_minor bigint not null default 0 check(amount_paid_minor>=0 and amount_paid_minor<=total_minor),
 due_date date,
 status text not null default 'issued' check(status in ('draft','issued','partially_paid','paid','overdue','void')),
 issued_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.family_tuition_invoices enable row level security;
create policy family_invoice_parent_read on public.family_tuition_invoices for select to authenticated using(private.is_verified_guardian(learner_user_id));

create table if not exists public.family_tuition_invoice_items (
 id uuid primary key default gen_random_uuid(),
 invoice_id uuid not null references public.family_tuition_invoices(id) on delete cascade,
 description text not null,
 quantity numeric(10,2) not null default 1 check(quantity>0),
 unit_amount_minor bigint not null check(unit_amount_minor>=0),
 line_total_minor bigint not null check(line_total_minor>=0),
 created_at timestamptz not null default now()
);
alter table public.family_tuition_invoice_items enable row level security;
create policy family_invoice_items_parent_read on public.family_tuition_invoice_items for select to authenticated using(
 exists(select 1 from public.family_tuition_invoices i where i.id=invoice_id and private.is_verified_guardian(i.learner_user_id))
);

create table if not exists public.family_tuition_payments (
 id uuid primary key default gen_random_uuid(),
 invoice_id uuid not null references public.family_tuition_invoices(id),
 payer_user_id uuid not null references auth.users(id),
 provider text not null default 'payfast',
 provider_reference text unique,
 amount_minor bigint not null check(amount_minor>0),
 currency char(3) not null default 'ZAR' check(currency='ZAR'),
 status text not null default 'pending' check(status in ('pending','initiated','confirmed','failed','cancelled','refunded')),
 receipt_number text unique,
 confirmed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.family_tuition_payments enable row level security;
create policy family_tuition_payments_parent_read on public.family_tuition_payments for select to authenticated using(
 payer_user_id=auth.uid() or exists(select 1 from public.family_tuition_invoices i where i.id=invoice_id and private.is_verified_guardian(i.learner_user_id))
);
revoke insert,update,delete on public.family_tuition_payments from anon,authenticated;

create table if not exists public.family_conversations (
 id uuid primary key default gen_random_uuid(),
 learner_user_id uuid not null references auth.users(id) on delete cascade,
 parent_user_id uuid not null references auth.users(id) on delete cascade,
 educator_user_id uuid not null references auth.users(id) on delete cascade,
 subject text not null,
 status text not null default 'open' check(status in ('open','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.family_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.family_conversations(id) on delete cascade,
 sender_user_id uuid not null references auth.users(id),
 body text not null check(length(trim(body)) between 1 and 10000),
 attachment_path text,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.family_conversations enable row level security;
alter table public.family_messages enable row level security;
create policy family_conversation_participant_read on public.family_conversations for select to authenticated using(auth.uid() in(parent_user_id,educator_user_id));
create policy family_conversation_parent_create on public.family_conversations for insert to authenticated with check(
 parent_user_id=auth.uid() and private.is_verified_guardian(learner_user_id)
 and exists(
  select 1 from public.learning_progress lp join public.lessons le on le.id=lp.lesson_id
  join public.course_modules cm on cm.id=le.module_id join public.courses c on c.id=cm.course_id
  where lp.learner_id=learner_user_id and c.created_by=educator_user_id
 )
);
create policy family_messages_participant_read on public.family_messages for select to authenticated using(
 exists(select 1 from public.family_conversations c where c.id=conversation_id and auth.uid() in(c.parent_user_id,c.educator_user_id))
);
create policy family_messages_participant_send on public.family_messages for insert to authenticated with check(
 sender_user_id=auth.uid() and exists(select 1 from public.family_conversations c where c.id=conversation_id and c.status='open' and auth.uid() in(c.parent_user_id,c.educator_user_id))
);
create policy family_messages_sender_read_update on public.family_messages for update to authenticated using(
 exists(select 1 from public.family_conversations c where c.id=conversation_id and auth.uid() in(c.parent_user_id,c.educator_user_id))
) with check(
 exists(select 1 from public.family_conversations c where c.id=conversation_id and auth.uid() in(c.parent_user_id,c.educator_user_id))
);

create table if not exists public.family_calendar_events (
 id uuid primary key default gen_random_uuid(),
 learner_user_id uuid not null references auth.users(id) on delete cascade,
 institution_id uuid references public.organisations(id) on delete set null,
 title text not null,
 description text,
 event_type text not null default 'school_event',
 starts_at timestamptz not null,
 ends_at timestamptz,
 all_day boolean not null default false,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.family_calendar_events enable row level security;
create policy family_calendar_parent_read on public.family_calendar_events for select to authenticated using(private.is_verified_guardian(learner_user_id));

create table if not exists public.family_documents (
 id uuid primary key default gen_random_uuid(),
 learner_user_id uuid not null references auth.users(id) on delete cascade,
 uploaded_by uuid not null references auth.users(id),
 title text not null,
 document_type text not null,
 storage_path text not null,
 mime_type text,
 file_size_bytes bigint,
 parent_visible boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.family_documents enable row level security;
create policy family_documents_parent_read on public.family_documents for select to authenticated using(parent_visible and private.is_verified_guardian(learner_user_id));

create table if not exists public.family_meeting_requests (
 id uuid primary key default gen_random_uuid(),
 learner_user_id uuid not null references auth.users(id) on delete cascade,
 parent_user_id uuid not null references auth.users(id) on delete cascade,
 educator_user_id uuid not null references auth.users(id),
 requested_start timestamptz,
 confirmed_start timestamptz,
 message text,
 status text not null default 'requested' check(status in ('requested','confirmed','declined','cancelled','completed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.family_meeting_requests enable row level security;
create policy family_meetings_participant_read on public.family_meeting_requests for select to authenticated using(auth.uid() in(parent_user_id,educator_user_id) and private.is_verified_guardian(learner_user_id));
create policy family_meetings_parent_create on public.family_meeting_requests for insert to authenticated with check(parent_user_id=auth.uid() and private.is_verified_guardian(learner_user_id));

create table if not exists public.family_support_requests (
 id uuid primary key default gen_random_uuid(),
 requester_user_id uuid not null references auth.users(id) on delete cascade,
 category text not null,
 subject text not null,
 description text not null,
 status text not null default 'open' check(status in ('open','in_progress','resolved','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.family_support_requests enable row level security;
create policy family_support_owner_read on public.family_support_requests for select to authenticated using(requester_user_id=auth.uid());
create policy family_support_owner_create on public.family_support_requests for insert to authenticated with check(requester_user_id=auth.uid());

create table if not exists public.family_privacy_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email_notifications boolean not null default true,
 in_app_notifications boolean not null default true,
 push_notifications boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.family_privacy_preferences enable row level security;
create policy family_preferences_owner_all on public.family_privacy_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create table if not exists public.family_audit_events (
 id uuid primary key default gen_random_uuid(),
 actor_user_id uuid not null references auth.users(id),
 subject_user_id uuid references auth.users(id),
 action text not null,
 resource_type text not null,
 resource_id uuid,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.family_audit_events enable row level security;
revoke all on public.family_audit_events from anon,authenticated;
grant all on public.family_audit_events to service_role;

create index if not exists family_attendance_learner_date_idx on public.family_attendance_records(learner_user_id,attendance_date desc);
create index if not exists family_invoices_learner_due_idx on public.family_tuition_invoices(learner_user_id,due_date desc);
create index if not exists family_payments_invoice_idx on public.family_tuition_payments(invoice_id,created_at desc);
create index if not exists family_messages_conversation_date_idx on public.family_messages(conversation_id,created_at desc);
create index if not exists family_calendar_learner_date_idx on public.family_calendar_events(learner_user_id,starts_at);
create index if not exists family_documents_learner_date_idx on public.family_documents(learner_user_id,created_at desc);
