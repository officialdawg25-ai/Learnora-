-- Parent portal read model, secure document access and verified tuition settlement.
create policy family_learner_details_parent_read on public.family_learner_details for select to authenticated
 using(created_by_parent=auth.uid() or private.is_verified_guardian(learner_user_id));
create table if not exists public.family_parent_details (
 user_id uuid primary key references auth.users(id) on delete cascade,
 mobile_number text,
 residential_address text,
 emergency_contact_name text,
 emergency_contact_number text,
 updated_at timestamptz not null default now()
);
alter table public.family_parent_details enable row level security;
create policy family_parent_details_owner_all on public.family_parent_details for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy family_parent_details_owner_all on public.family_parent_details for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('learnora-family-documents','learnora-family-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do nothing;
create policy family_document_storage_parent_read on storage.objects for select to authenticated using(
 bucket_id='learnora-family-documents' and exists(
  select 1 from public.family_documents d where d.storage_path=name and d.parent_visible=true and private.is_verified_guardian(d.learner_user_id)
 )
);

create or replace function public.guardian_parent_workspace(p_learner_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
 if auth.uid() is null or not private.is_verified_guardian(p_learner_id) then
  raise exception 'Verified guardian access is required';
 end if;
 select jsonb_build_object(
  'learner',jsonb_build_object('id',p.id,'display_name',p.display_name,'avatar_path',p.avatar_path,'date_of_birth',p.date_of_birth,'grade_label',ld.grade_label,'class_label',ld.class_label,'academic_year',ld.academic_year,'institution_id',ld.institution_id),
  'attendance',coalesce((select jsonb_agg(to_jsonb(a) order by a.attendance_date desc) from public.family_attendance_records a where a.learner_user_id=p_learner_id),'[]'::jsonb),
  'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'invoice_number',i.invoice_number,'description',i.description,'currency',i.currency,'total_minor',i.total_minor,'amount_paid_minor',i.amount_paid_minor,'balance_minor',i.total_minor-i.amount_paid_minor,'due_date',i.due_date,'status',case when i.status='issued' and i.due_date<current_date and i.amount_paid_minor<i.total_minor then 'overdue' else i.status end,'issued_at',i.issued_at,'items',coalesce((select jsonb_agg(to_jsonb(it) order by it.created_at) from public.family_tuition_invoice_items it where it.invoice_id=i.id),'[]'::jsonb)) order by i.due_date nulls last) from public.family_tuition_invoices i where i.learner_user_id=p_learner_id and i.status<>'draft'),'[]'::jsonb),
  'attendance_summary',(select jsonb_build_object('total',count(*),'present',count(*) filter(where attendance_status='present'),'absent',count(*) filter(where attendance_status='absent'),'late',count(*) filter(where attendance_status='late'),'excused',count(*) filter(where attendance_status='excused')) from public.family_attendance_records where learner_user_id=p_learner_id),
  'calendar',coalesce((select jsonb_agg(to_jsonb(e) order by e.starts_at) from public.family_calendar_events e where e.learner_user_id=p_learner_id and e.starts_at>=now()-interval '30 days'),'[]'::jsonb),
  'documents',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.family_documents d where d.learner_user_id=p_learner_id and d.parent_visible=true),'[]'::jsonb),
  'educators',coalesce((select jsonb_agg(distinct jsonb_build_object('user_id',c.created_by,'display_name',coalesce(ep.public_display_name,pr.display_name),'bio',ep.professional_bio,'subjects',ep.subjects,'region',ep.public_region,'course_title',c.title)) from public.learning_progress lp join public.lessons le on le.id=lp.lesson_id join public.course_modules cm on cm.id=le.module_id join public.courses c on c.id=cm.course_id left join public.educator_profiles ep on ep.user_id=c.created_by left join public.profiles pr on pr.id=c.created_by where lp.learner_id=p_learner_id),'[]'::jsonb)
 ) into v_result
 from public.profiles p left join public.family_learner_details ld on ld.learner_user_id=p.id where p.id=p_learner_id;
 return coalesce(v_result,'{}'::jsonb);
end;
$$;
revoke all on function public.guardian_parent_workspace(uuid) from public,anon;
grant execute on function public.guardian_parent_workspace(uuid) to authenticated;

create or replace function public.process_verified_tuition_payment(
 p_payment_id uuid,p_provider_reference text,p_amount_minor bigint,p_event_id text,p_payload_hash text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_payment public.family_tuition_payments%rowtype; v_invoice public.family_tuition_invoices%rowtype; v_receipt text;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
 select * into v_payment from public.family_tuition_payments where id=p_payment_id for update;
 if not found then raise exception 'Tuition payment not found'; end if;
 if v_payment.status='confirmed' then
  if v_payment.provider_reference=p_provider_reference then return jsonb_build_object('status','already_confirmed','receipt_number',v_payment.receipt_number); end if;
  raise exception 'Payment already confirmed against another provider reference';
 end if;
 if v_payment.status not in ('pending','initiated') then raise exception 'Payment is not payable'; end if;
 if v_payment.amount_minor<>p_amount_minor or v_payment.currency<>'ZAR' then raise exception 'Payment amount mismatch'; end if;
 select * into v_invoice from public.family_tuition_invoices where id=v_payment.invoice_id for update;
 if not found or v_invoice.status='void' then raise exception 'Invoice is unavailable'; end if;
 if v_payment.amount_minor>(v_invoice.total_minor-v_invoice.amount_paid_minor) then raise exception 'Payment exceeds invoice balance'; end if;
 v_receipt:='LRN-FEE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 update public.family_tuition_payments set status='confirmed',provider_reference=p_provider_reference,receipt_number=v_receipt,confirmed_at=now() where id=p_payment_id;
 update public.family_tuition_invoices set amount_paid_minor=amount_paid_minor+v_payment.amount_minor,
  status=case when amount_paid_minor+v_payment.amount_minor>=total_minor then 'paid' else 'partially_paid' end,updated_at=now()
  where id=v_invoice.id;
 insert into public.family_audit_events(actor_user_id,subject_user_id,action,resource_type,resource_id,metadata)
 values(v_payment.payer_user_id,v_invoice.learner_user_id,'tuition_payment_confirmed','tuition_payment',p_payment_id,jsonb_build_object('provider_reference',p_provider_reference,'amount_minor',p_amount_minor,'event_id',p_event_id,'payload_hash',p_payload_hash,'receipt_number',v_receipt));
 return jsonb_build_object('status','confirmed','receipt_number',v_receipt);
end;
$$;
revoke all on function public.process_verified_tuition_payment(uuid,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.process_verified_tuition_payment(uuid,text,bigint,text,text) to service_role;

create index if not exists family_parent_meetings_child_idx on public.family_meeting_requests(learner_user_id,requested_start);
