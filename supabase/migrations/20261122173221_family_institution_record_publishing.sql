-- Bind parent-visible records to actual active institution class membership.
alter table public.family_learner_details alter column created_by_parent drop not null;

create or replace function private.is_institution_staff_for_learner(p_learner_id uuid,p_institution_id uuid,p_allowed_roles text[])
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.organisation_memberships m
  join public.institution_classes ic on ic.organisation_id=m.organisation_id
  join public.class_memberships cm on cm.class_id=ic.id
  where m.user_id=auth.uid() and m.organisation_id=p_institution_id and m.status='active'
   and m.role=any(p_allowed_roles) and cm.user_id=p_learner_id and cm.role='learner' and cm.status='active'
 );
$$;
revoke all on function private.is_institution_staff_for_learner(uuid,uuid,text[]) from public,anon;
grant execute on function private.is_institution_staff_for_learner(uuid,uuid,text[]) to authenticated;

create policy family_learner_details_institution_read on public.family_learner_details for select to authenticated using(
 institution_id is not null and private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','educator','teacher','registrar','finance','bursar'])
);
create policy family_learner_details_institution_insert on public.family_learner_details for insert to authenticated with check(
 institution_id is not null and created_by_parent is null and private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','educator','teacher','registrar'])
);
create policy family_learner_details_institution_update on public.family_learner_details for update to authenticated using(
 institution_id is not null and private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','educator','teacher','registrar'])
) with check(
 institution_id is not null and private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','educator','teacher','registrar'])
);

drop policy if exists family_attendance_institution_read on public.family_attendance_records;
drop policy if exists family_attendance_institution_insert on public.family_attendance_records;
drop policy if exists family_attendance_institution_update on public.family_attendance_records;
create policy family_attendance_institution_read on public.family_attendance_records for select to authenticated using(private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','educator','teacher','registrar']));
create policy family_attendance_institution_insert on public.family_attendance_records for insert to authenticated with check(recorded_by=auth.uid() and private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','educator','teacher','registrar']));
create policy family_attendance_institution_update on public.family_attendance_records for update to authenticated using(private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','educator','teacher','registrar'])) with check(recorded_by=auth.uid() and private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','educator','teacher','registrar']));

drop policy if exists family_invoice_institution_read on public.family_tuition_invoices;
drop policy if exists family_invoice_institution_insert on public.family_tuition_invoices;
drop policy if exists family_invoice_institution_update on public.family_tuition_invoices;
create policy family_invoice_institution_read on public.family_tuition_invoices for select to authenticated using(private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','finance','bursar']));
create policy family_invoice_institution_insert on public.family_tuition_invoices for insert to authenticated with check(private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','finance','bursar']));
create policy family_invoice_institution_update on public.family_tuition_invoices for update to authenticated using(private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','finance','bursar'])) with check(private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','finance','bursar']));

drop policy if exists family_invoice_items_institution_read on public.family_tuition_invoice_items;
drop policy if exists family_invoice_items_institution_insert on public.family_tuition_invoice_items;
create policy family_invoice_items_institution_read on public.family_tuition_invoice_items for select to authenticated using(
 exists(select 1 from public.family_tuition_invoices i where i.id=invoice_id and private.is_institution_staff_for_learner(i.learner_user_id,i.institution_id,array['owner','admin','finance','bursar']))
);
create policy family_invoice_items_institution_insert on public.family_tuition_invoice_items for insert to authenticated with check(
 exists(select 1 from public.family_tuition_invoices i where i.id=invoice_id and private.is_institution_staff_for_learner(i.learner_user_id,i.institution_id,array['owner','admin','finance','bursar']))
);

drop policy if exists family_calendar_institution_read on public.family_calendar_events;
drop policy if exists family_calendar_institution_insert on public.family_calendar_events;
create policy family_calendar_institution_read on public.family_calendar_events for select to authenticated using(private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','educator','teacher','registrar']));
create policy family_calendar_institution_insert on public.family_calendar_events for insert to authenticated with check(created_by=auth.uid() and private.is_institution_staff_for_learner(learner_user_id,institution_id,array['owner','admin','educator','teacher','registrar']));

drop policy if exists family_documents_institution_read on public.family_documents;
create policy family_documents_institution_read on public.family_documents for select to authenticated using(
 private.is_institution_staff_for_learner(learner_user_id,(select ld.institution_id from public.family_learner_details ld where ld.learner_user_id=family_documents.learner_user_id),array['owner','admin','educator','teacher','registrar','finance','bursar'])
);
create policy family_documents_institution_insert on public.family_documents for insert to authenticated with check(
 uploaded_by=auth.uid() and private.is_institution_staff_for_learner(learner_user_id,(select ld.institution_id from public.family_learner_details ld where ld.learner_user_id=family_documents.learner_user_id),array['owner','admin','educator','teacher','registrar','finance','bursar'])
);
create policy family_document_storage_institution_read on storage.objects for select to authenticated using(
 bucket_id='learnora-family-documents' and exists(
  select 1 from public.family_documents d where d.storage_path=name and private.is_institution_staff_for_learner(d.learner_user_id,(select ld.institution_id from public.family_learner_details ld where ld.learner_user_id=d.learner_user_id),array['owner','admin','educator','teacher','registrar','finance','bursar'])
 )
);
create policy family_document_storage_institution_insert on storage.objects for insert to authenticated with check(
 bucket_id='learnora-family-documents' and exists(
  select 1 from public.family_learner_details ld where ld.learner_user_id=((storage.foldername(name))[1])::uuid and private.is_institution_staff_for_learner(ld.learner_user_id,ld.institution_id,array['owner','admin','educator','teacher','registrar','finance','bursar'])
 )
);
