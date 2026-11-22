-- Move the guardian read model behind the private schema and connect institutional workflows.
create or replace function private.guardian_parent_workspace(p_learner_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
 if auth.uid() is null or not private.is_verified_guardian(p_learner_id) then
  raise exception 'Verified guardian access is required';
 end if;
 select jsonb_build_object(
  'learner',jsonb_build_object('id',p.id,'display_name',p.display_name,'avatar_path',p.avatar_path,'date_of_birth',p.date_of_birth,'grade_label',ld.grade_label,'class_label',ld.class_label,'academic_year',ld.academic_year,'institution_id',ld.institution_id),
  'institution',case when o.id is null then null else jsonb_build_object('id',o.id,'name',o.name,'organisation_type',o.organisation_type,'status',o.status) end,
  'attendance',coalesce((select jsonb_agg(to_jsonb(a) order by a.attendance_date desc) from public.family_attendance_records a where a.learner_user_id=p_learner_id),'[]'::jsonb),
  'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'invoice_number',i.invoice_number,'description',i.description,'currency',i.currency,'total_minor',i.total_minor,'amount_paid_minor',i.amount_paid_minor,'balance_minor',i.total_minor-i.amount_paid_minor,'due_date',i.due_date,'status',case when i.status='issued' and i.due_date<current_date and i.amount_paid_minor<i.total_minor then 'overdue' else i.status end,'issued_at',i.issued_at,'items',coalesce((select jsonb_agg(to_jsonb(it) order by it.created_at) from public.family_tuition_invoice_items it where it.invoice_id=i.id),'[]'::jsonb)) order by i.due_date nulls last) from public.family_tuition_invoices i where i.learner_user_id=p_learner_id and i.status<>'draft'),'[]'::jsonb),
  'attendance_summary',(select jsonb_build_object('total',count(*),'present',count(*) filter(where attendance_status='present'),'absent',count(*) filter(where attendance_status='absent'),'late',count(*) filter(where attendance_status='late'),'excused',count(*) filter(where attendance_status='excused')) from public.family_attendance_records where learner_user_id=p_learner_id),
  'calendar',coalesce((select jsonb_agg(to_jsonb(e) order by e.starts_at) from public.family_calendar_events e where e.learner_user_id=p_learner_id and e.starts_at>=now()-interval '30 days'),'[]'::jsonb),
  'documents',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.family_documents d where d.learner_user_id=p_learner_id and d.parent_visible=true),'[]'::jsonb),
  'educators',coalesce((select jsonb_agg(distinct jsonb_build_object('user_id',ec.educator_id,'display_name',coalesce(ep.public_display_name,pr.display_name),'bio',ep.professional_bio,'subjects',ep.subjects,'region',ep.public_region,'course_title',ec.course_title)) from (
   select c.created_by educator_id,c.id course_id,c.title course_title from public.enrolments en join public.courses c on c.id=en.course_id where en.learner_id=p_learner_id and en.status in ('active','completed')
   union
   select c.created_by educator_id,c.id course_id,c.title course_title from public.learning_progress lp join public.lessons le on le.id=lp.lesson_id join public.course_modules cm on cm.id=le.module_id join public.courses c on c.id=cm.course_id where lp.learner_id=p_learner_id
  ) ec left join public.educator_profiles ep on ep.user_id=ec.educator_id left join public.profiles pr on pr.id=ec.educator_id),'[]'::jsonb)
 ) into v_result
 from public.profiles p left join public.family_learner_details ld on ld.learner_user_id=p.id left join public.organisations o on o.id=ld.institution_id where p.id=p_learner_id;
 return coalesce(v_result,'{}'::jsonb);
end;
$$;
revoke all on function private.guardian_parent_workspace(uuid) from public,anon;
grant execute on function private.guardian_parent_workspace(uuid) to authenticated;
create or replace function public.guardian_parent_workspace(p_learner_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$ select private.guardian_parent_workspace(p_learner_id); $$;
revoke all on function public.guardian_parent_workspace(uuid) from public,anon;
grant execute on function public.guardian_parent_workspace(uuid) to authenticated;

create policy family_meetings_educator_read on public.family_meeting_requests for select to authenticated
 using(educator_user_id=auth.uid() and exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='educator' and r.status='active'));
create policy family_meetings_educator_update on public.family_meeting_requests for update to authenticated
 using(educator_user_id=auth.uid() and exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='educator' and r.status='active'))
 with check(educator_user_id=auth.uid() and exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='educator' and r.status='active'));

create policy family_attendance_institution_read on public.family_attendance_records for select to authenticated using(
 institution_id is not null and exists(select 1 from public.organisation_memberships m where m.organisation_id=institution_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','educator','teacher','registrar'))
);
create policy family_attendance_institution_insert on public.family_attendance_records for insert to authenticated with check(
 recorded_by=auth.uid() and institution_id is not null and exists(select 1 from public.organisation_memberships m where m.organisation_id=institution_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','educator','teacher','registrar'))
);
create policy family_attendance_institution_update on public.family_attendance_records for update to authenticated using(
 institution_id is not null and exists(select 1 from public.organisation_memberships m where m.organisation_id=institution_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','educator','teacher','registrar'))
) with check(
 recorded_by=auth.uid() and institution_id is not null and exists(select 1 from public.organisation_memberships m where m.organisation_id=institution_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','educator','teacher','registrar'))
);

create policy family_invoice_institution_read on public.family_tuition_invoices for select to authenticated using(
 institution_id is not null and exists(select 1 from public.organisation_memberships m where m.organisation_id=institution_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','finance','bursar'))
);
create policy family_invoice_institution_insert on public.family_tuition_invoices for insert to authenticated with check(
 institution_id is not null and exists(select 1 from public.organisation_memberships m where m.organisation_id=institution_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','finance','bursar'))
);
create policy family_invoice_institution_update on public.family_tuition_invoices for update to authenticated using(
 institution_id is not null and exists(select 1 from public.organisation_memberships m where m.organisation_id=institution_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','finance','bursar'))
) with check(
 institution_id is not null and exists(select 1 from public.organisation_memberships m where m.organisation_id=institution_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','finance','bursar'))
);
create policy family_invoice_items_institution_read on public.family_tuition_invoice_items for select to authenticated using(
 exists(select 1 from public.family_tuition_invoices i join public.organisation_memberships m on m.organisation_id=i.institution_id where i.id=invoice_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','finance','bursar'))
);
create policy family_invoice_items_institution_insert on public.family_tuition_invoice_items for insert to authenticated with check(
 exists(select 1 from public.family_tuition_invoices i join public.organisation_memberships m on m.organisation_id=i.institution_id where i.id=invoice_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','finance','bursar'))
);

create policy family_calendar_institution_read on public.family_calendar_events for select to authenticated using(
 institution_id is not null and exists(select 1 from public.organisation_memberships m where m.organisation_id=institution_id and m.user_id=auth.uid() and m.status='active')
);
create policy family_calendar_institution_insert on public.family_calendar_events for insert to authenticated with check(
 created_by=auth.uid() and institution_id is not null and exists(select 1 from public.organisation_memberships m where m.organisation_id=institution_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','educator','teacher'))
);
create policy family_documents_institution_read on public.family_documents for select to authenticated using(
 exists(select 1 from public.family_learner_details ld join public.organisation_memberships m on m.organisation_id=ld.institution_id where ld.learner_user_id=family_documents.learner_user_id and m.user_id=auth.uid() and m.status='active')
);
