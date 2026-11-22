-- Emit in-app notices for real family activity, without bypassing relationship checks.
create or replace function private.notify_family_activity()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
 v_recipient uuid; v_actor uuid; v_learner uuid; v_resource uuid; v_type text; v_title text; v_body text; v_relationship record;
begin
 if tg_table_name='family_messages' then
  select c.learner_user_id,c.parent_user_id,c.educator_user_id into v_learner,v_recipient,v_actor from public.family_conversations c where c.id=new.conversation_id;
  if new.sender_user_id=v_recipient then v_recipient:=v_actor; else v_actor:=new.sender_user_id; end if;
  if v_recipient is null or v_recipient=v_actor then return new; end if;
  v_resource:=new.id;v_type:='family_message';v_title:='New family message';v_body:=left(new.body,180);
  insert into public.user_notifications(recipient_user_id,actor_user_id,notification_type,title,body,resource_type,resource_id,metadata)
  values(v_recipient,v_actor,v_type,v_title,v_body,'family_message',v_resource,jsonb_build_object('learner_user_id',v_learner,'conversation_id',new.conversation_id));
 elsif tg_table_name='family_attendance_records' then
  for v_relationship in select guardian_user_id from public.guardian_relationships where learner_user_id=new.learner_user_id and status='active' and learner_consent_status='approved' and revoked_at is null loop
   insert into public.user_notifications(recipient_user_id,actor_user_id,notification_type,title,body,resource_type,resource_id,metadata)
   values(v_relationship.guardian_user_id,new.recorded_by,'attendance_update','Attendance updated','A new attendance record was published for your learner.','attendance_record',new.id,jsonb_build_object('attendance_status',new.attendance_status,'attendance_date',new.attendance_date));
  end loop;
 elsif tg_table_name='family_tuition_invoices' then
  for v_relationship in select guardian_user_id from public.guardian_relationships where learner_user_id=new.learner_user_id and status='active' and learner_consent_status='approved' and revoked_at is null loop
   insert into public.user_notifications(recipient_user_id,actor_user_id,notification_type,title,body,resource_type,resource_id,metadata)
   values(v_relationship.guardian_user_id,null,'financial_invoice','New tuition invoice','A new tuition invoice is available in your family financial centre.','tuition_invoice',new.id,jsonb_build_object('invoice_number',new.invoice_number,'due_date',new.due_date));
  end loop;
 elsif tg_table_name='family_calendar_events' then
  for v_relationship in select guardian_user_id from public.guardian_relationships where learner_user_id=new.learner_user_id and status='active' and learner_consent_status='approved' and revoked_at is null loop
   insert into public.user_notifications(recipient_user_id,actor_user_id,notification_type,title,body,resource_type,resource_id,metadata)
   values(v_relationship.guardian_user_id,new.created_by,'calendar_event','New academic event',left(new.title,180),'calendar_event',new.id,jsonb_build_object('starts_at',new.starts_at,'event_type',new.event_type));
  end loop;
 elsif tg_table_name='family_meeting_requests' then
  if tg_op='UPDATE' and old.status is distinct from new.status then
   insert into public.user_notifications(recipient_user_id,actor_user_id,notification_type,title,body,resource_type,resource_id,metadata)
   values(new.parent_user_id,new.educator_user_id,'meeting_update','Parent–teacher meeting updated','Your meeting request status is now '||new.status||'.','meeting_request',new.id,jsonb_build_object('status',new.status,'confirmed_start',new.confirmed_start));
  end if;
 elsif tg_table_name='family_tuition_payments' then
  if tg_op='UPDATE' and old.status is distinct from new.status and new.status='confirmed' then
   insert into public.user_notifications(recipient_user_id,actor_user_id,notification_type,title,body,resource_type,resource_id,metadata)
   values(new.payer_user_id,null,'payment_confirmed','Tuition payment confirmed','Your tuition payment has been verified and allocated to the invoice.','tuition_payment',new.id,jsonb_build_object('receipt_number',new.receipt_number,'amount_minor',new.amount_minor));
  end if;
 end if;
 return new;
end;
$$;
revoke all on function private.notify_family_activity() from public,anon,authenticated;
create trigger family_message_notification after insert on public.family_messages for each row execute function private.notify_family_activity();
create trigger family_attendance_notification after insert on public.family_attendance_records for each row execute function private.notify_family_activity();
create trigger family_invoice_notification after insert on public.family_tuition_invoices for each row execute function private.notify_family_activity();
create trigger family_calendar_notification after insert on public.family_calendar_events for each row execute function private.notify_family_activity();
create trigger family_meeting_notification after update on public.family_meeting_requests for each row execute function private.notify_family_activity();
create trigger family_tuition_payment_notification after update on public.family_tuition_payments for each row execute function private.notify_family_activity();
