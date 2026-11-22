-- Authorised educators and institution managers may ingest draft learning sources.
grant insert on public.knowledge_sources to authenticated;
grant insert on public.knowledge_chunks to authenticated;
create policy knowledge_sources_insert_manager on public.knowledge_sources
for insert to authenticated with check (
 created_by=(select auth.uid())
 and publication_status='draft'
 and (
  (course_id is not null and exists(select 1 from public.courses c where c.id=course_id and private.can_manage_academy(c.academy_id)))
  or (organisation_id is not null and private.has_active_membership(organisation_id,array['owner','admin','academic_manager']))
 )
);
create policy knowledge_chunks_insert_source_manager on public.knowledge_chunks
for insert to authenticated with check (
 exists(select 1 from public.knowledge_sources s where s.id=source_id and s.created_by=(select auth.uid()) and s.publication_status='draft'
  and (
   (s.course_id is not null and exists(select 1 from public.courses c where c.id=s.course_id and private.can_manage_academy(c.academy_id)))
   or (s.organisation_id is not null and private.has_active_membership(s.organisation_id,array['owner','admin','academic_manager']))
  ))
);
create policy knowledge_sources_select_owner_drafts on public.knowledge_sources
for select to authenticated using(created_by=(select auth.uid()) and publication_status='draft');
create policy knowledge_chunks_select_owner_drafts on public.knowledge_chunks
for select to authenticated using(exists(select 1 from public.knowledge_sources s where s.id=source_id and s.created_by=(select auth.uid()) and s.publication_status='draft'));
