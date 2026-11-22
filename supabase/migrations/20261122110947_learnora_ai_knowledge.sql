-- Learnora model-independent AI conversations and curriculum retrieval.
create table public.ai_conversations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 capability text not null check (capability in ('tutor','teacher','assessment','learning','language','academic')),
 title text,
 context jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.ai_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null check (role in ('user','assistant','system')),
 content text not null check (length(content) between 1 and 30000),
 source_references jsonb not null default '[]'::jsonb,
 provider text,
 model text,
 input_tokens integer check (input_tokens is null or input_tokens>=0),
 output_tokens integer check (output_tokens is null or output_tokens>=0),
 created_at timestamptz not null default now()
);
create table public.knowledge_sources (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 source_type text not null check (source_type in ('curriculum','course_lesson','educator_resource','institution_policy','public_reference')),
 source_url text,
 course_id uuid references public.courses(id) on delete cascade,
 organisation_id uuid references public.organisations(id) on delete cascade,
 access_scope text not null default 'public' check (access_scope in ('public','enrolled','institution_private','academy_private')),
 publication_status text not null default 'draft' check (publication_status in ('draft','published','archived')),
 language_code text not null default 'en',
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (not (course_id is not null and organisation_id is not null))
);
create table public.knowledge_chunks (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.knowledge_sources(id) on delete cascade,
 chunk_index integer not null check (chunk_index>=0),
 content text not null check (length(content) between 1 and 12000),
 language_code text not null default 'en',
 search_vector tsvector generated always as (to_tsvector('english',content)) stored,
 created_at timestamptz not null default now(),
 unique(source_id,chunk_index)
);
create index ai_conversations_user_created_idx on public.ai_conversations(user_id,created_at desc);
create index ai_messages_conversation_created_idx on public.ai_messages(conversation_id,created_at);
create index knowledge_sources_course_scope_idx on public.knowledge_sources(course_id,access_scope,publication_status);
create index knowledge_chunks_search_idx on public.knowledge_chunks using gin(search_vector);
create index knowledge_chunks_source_idx on public.knowledge_chunks(source_id,chunk_index);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;

grant select,insert on public.ai_conversations,public.ai_messages to authenticated;
grant select on public.knowledge_sources,public.knowledge_chunks to authenticated;
revoke all on public.knowledge_sources,public.knowledge_chunks from anon;

create policy ai_conversations_owner_select on public.ai_conversations for select to authenticated using (user_id=(select auth.uid()));
create policy ai_conversations_owner_insert on public.ai_conversations for insert to authenticated with check (user_id=(select auth.uid()));
create policy ai_messages_owner_select on public.ai_messages for select to authenticated using (
 user_id=(select auth.uid()) and exists(select 1 from public.ai_conversations c where c.id=conversation_id and c.user_id=(select auth.uid()))
);
create policy ai_messages_owner_insert on public.ai_messages for insert to authenticated with check (
 user_id=(select auth.uid()) and exists(select 1 from public.ai_conversations c where c.id=conversation_id and c.user_id=(select auth.uid()))
);
create policy knowledge_sources_select_authorised on public.knowledge_sources for select to authenticated using (
 publication_status='published' and (
   access_scope='public'
   or (course_id is not null and private.can_access_course_content(course_id))
   or (organisation_id is not null and private.has_active_membership(organisation_id,null))
   or (access_scope='academy_private' and course_id is not null and exists(select 1 from public.courses c where c.id=course_id and private.can_manage_academy(c.academy_id)))
 )
);
create policy knowledge_chunks_select_authorised on public.knowledge_chunks for select to authenticated using (
 exists(select 1 from public.knowledge_sources s where s.id=source_id and s.publication_status='published' and (
   s.access_scope='public'
   or (s.course_id is not null and private.can_access_course_content(s.course_id))
   or (s.organisation_id is not null and private.has_active_membership(s.organisation_id,null))
   or (s.access_scope='academy_private' and s.course_id is not null and exists(select 1 from public.courses c where c.id=s.course_id and private.can_manage_academy(c.academy_id)))
 ))
);
comment on table public.knowledge_chunks is 'Curriculum-aware retrieval chunks. Access is enforced through source scope and the requesting user RLS context.';
