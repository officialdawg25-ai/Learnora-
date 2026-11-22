create table public.institution_verification_submissions (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.organisations(id) on delete cascade,
 submitted_by uuid not null references public.profiles(id),
 reference_type text not null check(reference_type in ('cipc','dbe','dhet','saqa','municipal','other')),
 evidence_reference text not null check(length(trim(evidence_reference)) between 3 and 200),
 status text not null default 'pending' check(status in ('pending','verified','more_information_required','rejected')),
 reviewer_user_id uuid references public.profiles(id),
 reviewer_notes text,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 check(status<>'verified' or (reviewer_user_id is not null and reviewed_at is not null))
);
create unique index institution_verification_one_pending_idx on public.institution_verification_submissions(organisation_id) where status='pending';
create index institution_verification_status_created_idx on public.institution_verification_submissions(status,created_at);
alter table public.institution_verification_submissions enable row level security;
revoke all on public.institution_verification_submissions from anon,authenticated;
grant select,insert on public.institution_verification_submissions to authenticated;
create policy institution_verification_insert_owner on public.institution_verification_submissions
for insert to authenticated with check (
 submitted_by=(select auth.uid()) and status='pending'
 and private.has_active_membership(organisation_id,array['owner','admin'])
);
create policy institution_verification_select_authorised on public.institution_verification_submissions
for select to authenticated using (
 submitted_by=(select auth.uid())
 or private.has_active_membership(organisation_id,array['owner','admin'])
);
