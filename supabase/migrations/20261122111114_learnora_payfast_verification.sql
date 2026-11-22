-- Internal-only finance controls, verified PayFast posting and missing foreign-key indexes.
insert into public.ledger_accounts(account_code,account_name,account_type,currency,is_control_account)
values ('CUSTOMER_FUNDS_PENDING','Customer funds pending settlement','liability','ZAR',true)
on conflict do nothing;

create index if not exists academy_memberships_invited_by_idx on public.academy_memberships(invited_by);
create index if not exists course_versions_created_by_idx on public.course_versions(created_by);
create index if not exists educator_verification_educator_idx on public.educator_verification_submissions(educator_user_id);
create index if not exists educator_verification_reviewer_idx on public.educator_verification_submissions(reviewer_user_id);
create index if not exists publication_reviews_course_idx on public.publication_reviews(course_id);
create index if not exists publication_reviews_requested_by_idx on public.publication_reviews(requested_by);
create index if not exists publication_reviews_reviewer_idx on public.publication_reviews(reviewer_user_id);

create policy payment_webhook_events_service_only on public.payment_webhook_events
for all to service_role using (true) with check (true);
create policy ledger_accounts_service_only on public.ledger_accounts
for all to service_role using (true) with check (true);
create policy ledger_journals_service_only on public.ledger_journals
for all to service_role using (true) with check (true);
create policy ledger_entries_service_only on public.ledger_entries
for all to service_role using (true) with check (true);

create or replace function public.process_verified_payfast_payment(
 p_merchant_payment_id text,
 p_provider_reference text,
 p_amount_minor bigint,
 p_event_id text,
 p_payload_hash text
) returns text
language plpgsql security definer set search_path=''
as $function$
declare
 v_payment public.payment_transactions%rowtype;
 v_order public.orders%rowtype;
 v_event_id uuid;
 v_journal_id uuid;
 v_debit_account uuid;
 v_credit_account uuid;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 if p_event_id is null or p_event_id='' or p_provider_reference is null or p_provider_reference='' then
   raise exception 'Provider event and payment references are required';
 end if;
 select * into v_payment from public.payment_transactions
 where merchant_payment_id=p_merchant_payment_id for update;
 if not found then raise exception 'Payment transaction not found'; end if;
 if v_payment.amount_minor<>p_amount_minor then raise exception 'Payment amount mismatch'; end if;
 select * into v_order from public.orders where id=v_payment.order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.status='cancelled' or v_order.status='refunded' then raise exception 'Order is not payable'; end if;

 insert into public.payment_webhook_events(provider,provider_event_id,payload_hash,processing_status)
 values('payfast',p_event_id,p_payload_hash,'processing')
 on conflict(provider,provider_event_id) do nothing
 returning id into v_event_id;
 if v_event_id is null then return 'duplicate'; end if;

 if v_payment.status='confirmed' or v_payment.status='settled' then
   update public.payment_webhook_events set processing_status='processed',processed_at=now() where id=v_event_id;
   return 'already_confirmed';
 end if;

 update public.payment_transactions
 set status='confirmed',provider_reference=p_provider_reference,verified_at=now(),updated_at=now()
 where id=v_payment.id;
 update public.orders set status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() where id=v_order.id;

 if not exists(select 1 from public.enrolments e where e.course_id=v_order.course_id and e.learner_id=v_order.learner_id and e.status in ('active','completed')) then
   insert into public.enrolments(course_id,learner_id,status,source) values(v_order.course_id,v_order.learner_id,'active','payment');
 end if;

 select id into v_debit_account from public.ledger_accounts where account_code='PAYFAST_CLEARING' and currency=v_order.currency and owner_user_id is null limit 1;
 select id into v_credit_account from public.ledger_accounts where account_code='CUSTOMER_FUNDS_PENDING' and currency=v_order.currency and owner_user_id is null limit 1;
 if v_debit_account is null or v_credit_account is null then raise exception 'Required ledger control accounts are missing'; end if;

 insert into public.ledger_journals(source_type,source_id,description,currency)
 values('payfast_payment',v_payment.id,'Verified PayFast payment; awaiting settlement reconciliation',v_order.currency)
 on conflict(source_type,source_id) do nothing returning id into v_journal_id;
 if v_journal_id is not null then
   insert into public.ledger_entries(journal_id,account_id,debit_minor,credit_minor,currency)
   values
    (v_journal_id,v_debit_account,p_amount_minor,0,v_order.currency),
    (v_journal_id,v_credit_account,0,p_amount_minor,v_order.currency);
 end if;

 update public.payment_webhook_events set processing_status='processed',processed_at=now() where id=v_event_id;
 return 'processed';
end;
$function$;
revoke all on function public.process_verified_payfast_payment(text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.process_verified_payfast_payment(text,text,bigint,text,text) to service_role;
