-- Learnora academic record, competency evidence, credentials and opportunity discovery.
create table public.competency_frameworks (
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 name text not null,
 description text,
 framework_owner text,
 country_code char(2),
 organisation_id uuid references public.organisations(id) on delete cascade,
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now()
);
create table public.competencies (
 id uuid primary key default gen_random_uuid(),
 framework_id uuid not null references public.competency_frameworks(id) on delete cascade,
 code text not null,
 title text not null,
 description text,
 parent_competency_id uuid references public.competencies(id),
 level text,
 created_at timestamptz not null default now(),
 unique(framework_id,code)
);
create table public.competency_prerequisites (
 competency_id uuid not null references public.competencies(id) on delete cascade,
 prerequisite_competency_id uuid not null references public.competencies(id) on delete cascade,
 primary key(competency_id,prerequisite_competency_id),
 check(competency_id<>prerequisite_competency_id)
);
create table public.learner_competency_evidence (
 id uuid primary key default gen_random_uuid(),
 learner_user_id uuid not null references public.profiles(id) on delete cascade,
 competency_id uuid not null references public.competencies(id),
 assessment_attempt_id uuid references public.assessment_attempts(id),
 evidence_type text not null check(evidence_type in ('assessment','project','practical','educator_observation','portfolio')),
 evidence_reference text,
 score_value numeric,
 score_scale text,
 verification_status text not null default 'recorded' check(verification_status in ('recorded','pending_review','verified','rejected')),
 verified_by uuid references public.profiles(id),
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 unique(learner_user_id,competency_id,assessment_attempt_id)
);
create table public.learner_competency_mastery (
 id uuid primary key default gen_random_uuid(),
 learner_user_id uuid not null references public.profiles(id) on delete cascade,
 competency_id uuid not null references public.competencies(id),
 mastery_state text not null check(mastery_state in ('introduced','developing','demonstrated','mastered')),
 evidence_count integer not null default 0 check(evidence_count>=0),
 confidence numeric check(confidence is null or confidence between 0 and 1),
 rationale text,
 evaluated_at timestamptz not null default now(),
 evaluator_version text,
 unique(learner_user_id,competency_id)
);
create table public.credentials (
 id uuid primary key default gen_random_uuid(),
 credential_identifier text not null unique,
 recipient_user_id uuid not null references public.profiles(id),
 issuer_name text not null,
 issuer_organisation_id uuid references public.organisations(id),
 academy_id uuid references public.academies(id),
 course_id uuid references public.courses(id),
 credential_title text not null,
 credential_type text not null check(credential_type in ('platform_completion','institution_issued','accredited_qualification')),
 accreditation_reference text,
 issued_at timestamptz not null default now(),
 status text not null default 'active' check(status in ('active','revoked','expired')),
 revoked_at timestamptz,
 revocation_reason text,
 created_at timestamptz not null default now(),
 check(credential_type<>'accredited_qualification' or accreditation_reference is not null)
);
create table public.learning_opportunities (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 provider_name text not null,
 opportunity_type text not null check(opportunity_type in ('scholarship','bursary','university_programme','college_programme','internship','skills_programme','competition','educational_event','career_exploration')),
 description text,
 source_url text not null,
 application_url text,
 region text,
 country_code char(2) not null default 'ZA',
 deadline date,
 eligibility jsonb not null default '{}'::jsonb,
 verification_source text not null,
 verified_at timestamptz not null,
 publication_status text not null default 'draft' check(publication_status in ('draft','published','expired','withdrawn')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.learner_opportunity_saves (
 learner_user_id uuid not null references public.profiles(id) on delete cascade,
 opportunity_id uuid not null references public.learning_opportunities(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(learner_user_id,opportunity_id)
);
create table public.learner_learning_goals (
 id uuid primary key default gen_random_uuid(),
 learner_user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null,
 description text,
 target_date date,
 status text not null default 'active' check(status in ('active','completed','paused','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create index competencies_framework_idx on public.competencies(framework_id,code);
create index competency_evidence_learner_idx on public.learner_competency_evidence(learner_user_id,created_at desc);
create index competency_mastery_learner_idx on public.learner_competency_mastery(learner_user_id);
create index credentials_recipient_idx on public.credentials(recipient_user_id,issued_at desc);
create index opportunities_discovery_idx on public.learning_opportunities(publication_status,opportunity_type,deadline);
create index learner_goals_learner_idx on public.learner_learning_goals(learner_user_id,status);

alter table public.competency_frameworks enable row level security;
alter table public.competencies enable row level security;
alter table public.competency_prerequisites enable row level security;
alter table public.learner_competency_evidence enable row level security;
alter table public.learner_competency_mastery enable row level security;
alter table public.credentials enable row level security;
alter table public.learning_opportunities enable row level security;
alter table public.learner_opportunity_saves enable row level security;
alter table public.learner_learning_goals enable row level security;

grant select on public.competency_frameworks,public.competencies,public.competency_prerequisites,public.learner_competency_evidence,public.learner_competency_mastery,public.credentials,public.learning_opportunities to authenticated;
grant select on public.learning_opportunities to anon;
grant select,insert,delete on public.learner_opportunity_saves to authenticated;
grant select,insert,update,delete on public.learner_learning_goals to authenticated;
revoke insert,update,delete on public.competency_frameworks,public.competencies,public.competency_prerequisites,public.learner_competency_evidence,public.learner_competency_mastery,public.credentials,public.learning_opportunities from anon,authenticated;

create policy frameworks_select_published_or_member on public.competency_frameworks for select to authenticated
using(status='published' and (organisation_id is null or private.has_active_membership(organisation_id,null)));
create policy competencies_select_framework_access on public.competencies for select to authenticated
using(exists(select 1 from public.competency_frameworks f where f.id=framework_id and f.status='published' and (f.organisation_id is null or private.has_active_membership(f.organisation_id,null))));
create policy prerequisites_select_framework_access on public.competency_prerequisites for select to authenticated
using(exists(select 1 from public.competencies c join public.competency_frameworks f on f.id=c.framework_id where c.id=competency_id and f.status='published' and (f.organisation_id is null or private.has_active_membership(f.organisation_id,null))));

create policy competency_evidence_select_learner_or_teacher on public.learner_competency_evidence for select to authenticated
using(learner_user_id=(select auth.uid()) or (assessment_attempt_id is not null and exists(
 select 1 from public.assessment_attempts aa join public.assessments a on a.id=aa.assessment_id join public.courses c on c.id=a.course_id
 where aa.id=assessment_attempt_id and private.can_manage_academy(c.academy_id)
)));
create policy competency_mastery_select_learner on public.learner_competency_mastery for select to authenticated
using(learner_user_id=(select auth.uid()));

create policy credentials_select_recipient_or_issuer on public.credentials for select to authenticated
using(recipient_user_id=(select auth.uid()) or (academy_id is not null and private.can_manage_academy(academy_id)) or (issuer_organisation_id is not null and private.has_active_membership(issuer_organisation_id,array['owner','admin','academic_manager'])));

create policy opportunities_select_published on public.learning_opportunities for select to authenticated using(publication_status='published' and (deadline is null or deadline>=current_date));
create policy opportunities_select_published_anon on public.learning_opportunities for select to anon using(publication_status='published' and (deadline is null or deadline>=current_date));
create policy opportunity_saves_select_self on public.learner_opportunity_saves for select to authenticated using(learner_user_id=(select auth.uid()));
create policy opportunity_saves_insert_self on public.learner_opportunity_saves for insert to authenticated with check(learner_user_id=(select auth.uid()));
create policy opportunity_saves_delete_self on public.learner_opportunity_saves for delete to authenticated using(learner_user_id=(select auth.uid()));
create policy learning_goals_all_self on public.learner_learning_goals for all to authenticated
using(learner_user_id=(select auth.uid())) with check(learner_user_id=(select auth.uid()));

create or replace function public.verify_learnora_credential(p_credential_identifier text)
returns table(credential_identifier text,issuer_name text,credential_title text,credential_type text,issued_at timestamptz,status text,accreditation_reference text)
language sql stable security definer set search_path=''
as $function$
 select c.credential_identifier,c.issuer_name,c.credential_title,c.credential_type,c.issued_at,c.status,c.accreditation_reference
 from public.credentials c where c.credential_identifier=p_credential_identifier;
$function$;
revoke all on function public.verify_learnora_credential(text) from public;
grant execute on function public.verify_learnora_credential(text) to anon,authenticated;

comment on table public.learner_competency_mastery is 'Evidence-based, explainable mastery summaries. These records do not automatically determine progression, exclusion or certification.';
comment on table public.credentials is 'Credential type distinguishes platform completion, institution-issued credentials and accredited qualifications; accredited claims require a reference.';
comment on table public.learning_opportunities is 'Opportunity records require a verifiable source and verification timestamp before publication.';
