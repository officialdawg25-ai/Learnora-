-- Settlement reconciliation and controlled refund lifecycle.
create table public.payment_settlement_batches (
 id uuid primary key default gen_random_uuid(),
 provider text not null check(provider='payfast'),
 statement_reference text not null unique,
 statement_date date not null,
 currency char(3) not null default 'ZAR',
 declared_total_minor bigint not null check(declared_total_minor>=0),
 status text not null default 'imported' check(status in ('imported','reconciled','exceptions')),
 imported_at timestamptz not null default now(),
 imported_by uuid references public.profiles(id),
 notes text
);
create table public.payment_settlement_lines (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references public.payment_settlement_batches(id) on delete cascade,
 provider_reference text not null,
 amount_minor bigint not null check(amount_minor>0),
 payment_transaction_id uuid references public.payment_transactions(id),
 status text not null default 'unmatched' check(status in ('unmatched','matched','amount_mismatch','duplicate','exception')),
 settled_at timestamptz,
 unique(batch_id,provider_reference)
);
create index payment_settlement_lines_batch_idx on public.payment_settlement_lines(batch_id,status);
create index payment_settlement_lines_payment_idx on public.payment_settlement_lines(payment_transaction_id);

alter table public.payment_settlement_batches enable row level security;
alter table public.payment_settlement_lines enable row level security;
revoke all on public.payment_settlement_batches,public.payment_settlement_lines from anon,authenticated;
create policy settlement_batches_service_only on public.payment_settlement_batches for all to service_role using(true) with check(true);
create policy settlement_lines_service_only on public.payment_settlement_lines for all to service_role using(true) with check(true);

create unique index refunds_one_open_request_per_order on public.refunds(order_id)
where status in ('requested','approved','submitted');

create or replace function public.request_order_refund(p_order_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_order public.orders%rowtype; v_payment public.payment_transactions%rowtype; v_refund_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if length(trim(coalesce(p_reason,'')))<10 or length(p_reason)>2000 then raise exception 'Please provide a reason between 10 and 2000 characters'; end if;
 select * into v_order from public.orders where id=p_order_id and learner_id=(select auth.uid()) for update;
 if not found then raise exception 'Order not found' using errcode='42501'; end if;
 if v_order.status not in ('paid','partially_refunded') then raise exception 'This order is not eligible for a refund request'; end if;
 select * into v_payment from public.payment_transactions where order_id=v_order.id and status in ('confirmed','settled') order by created_at desc limit 1;
 if not found then raise exception 'No verified payment is available for this order'; end if;
 insert into public.refunds(order_id,payment_transaction_id,requested_by,amount_minor,currency,reason)
 values(v_order.id,v_payment.id,(select auth.uid()),v_order.amount_minor,v_order.currency,trim(p_reason))
 returning id into v_refund_id;
 return v_refund_id;
end;
$function$;
revoke all on function public.request_order_refund(uuid,text) from public,anon;
grant execute on function public.request_order_refund(uuid,text) to authenticated;

create or replace function public.reconcile_payfast_settlement(
 p_batch_id uuid,p_provider_reference text,p_amount_minor bigint,p_settled_at timestamptz
) returns text language plpgsql security definer set search_path=''
as $function$
declare v_payment public.payment_transactions%rowtype; v_line_id uuid; v_journal_id uuid; v_bank uuid; v_clearing uuid;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 select * into v_payment from public.payment_transactions where provider_reference=p_provider_reference for update;
 if not found then
  insert into public.payment_settlement_lines(batch_id,provider_reference,amount_minor,status,settled_at)
  values(p_batch_id,p_provider_reference,p_amount_minor,'unmatched',p_settled_at)
  on conflict(batch_id,provider_reference) do nothing;
  return 'unmatched';
 end if;
 if v_payment.amount_minor<>p_amount_minor then
  insert into public.payment_settlement_lines(batch_id,provider_reference,amount_minor,payment_transaction_id,status,settled_at)
  values(p_batch_id,p_provider_reference,p_amount_minor,v_payment.id,'amount_mismatch',p_settled_at)
  on conflict(batch_id,provider_reference) do nothing;
  return 'amount_mismatch';
 end if;
 if v_payment.status='settled' then
  insert into public.payment_settlement_lines(batch_id,provider_reference,amount_minor,payment_transaction_id,status,settled_at)
  values(p_batch_id,p_provider_reference,p_amount_minor,v_payment.id,'duplicate',p_settled_at)
  on conflict(batch_id,provider_reference) do nothing;
  return 'duplicate';
 end if;
 if v_payment.status<>'confirmed' then raise exception 'Only confirmed payments can be reconciled'; end if;
 insert into public.payment_settlement_lines(batch_id,provider_reference,amount_minor,payment_transaction_id,status,settled_at)
 values(p_batch_id,p_provider_reference,p_amount_minor,v_payment.id,'matched',p_settled_at)
 on conflict(batch_id,provider_reference) do nothing returning id into v_line_id;
 if v_line_id is null then return 'duplicate'; end if;
 select id into v_bank from public.ledger_accounts where account_code='BANK_SETTLEMENT' and currency=v_payment.currency and owner_user_id is null limit 1;
 select id into v_clearing from public.ledger_accounts where account_code='PAYFAST_CLEARING' and currency=v_payment.currency and owner_user_id is null limit 1;
 if v_bank is null or v_clearing is null then raise exception 'Settlement ledger accounts missing'; end if;
 update public.payment_transactions set status='settled',settled_at=p_settled_at,updated_at=now() where id=v_payment.id;
 insert into public.ledger_journals(source_type,source_id,description,currency)
 values('payfast_settlement',v_payment.id,'PayFast settlement matched to provider statement',v_payment.currency)
 on conflict(source_type,source_id) do nothing returning id into v_journal_id;
 if v_journal_id is not null then
  insert into public.ledger_entries(journal_id,account_id,debit_minor,credit_minor,currency)
  values(v_journal_id,v_bank,p_amount_minor,0,v_payment.currency),(v_journal_id,v_clearing,0,p_amount_minor,v_payment.currency);
 end if;
 return 'matched';
end;
$function$;
revoke all on function public.reconcile_payfast_settlement(uuid,text,bigint,timestamptz) from public,anon,authenticated;
grant execute on function public.reconcile_payfast_settlement(uuid,text,bigint,timestamptz) to service_role;

create or replace function public.complete_payfast_refund(p_refund_id uuid,p_provider_reference text)
returns text language plpgsql security definer set search_path=''
as $function$
declare v_refund public.refunds%rowtype; v_payment public.payment_transactions%rowtype; v_order public.orders%rowtype;
 v_debit uuid; v_credit uuid; v_journal uuid; v_refunded bigint;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 select * into v_refund from public.refunds where id=p_refund_id for update;
 if not found then raise exception 'Refund request not found'; end if;
 if v_refund.status='completed' then return 'already_completed'; end if;
 if v_refund.status not in ('approved','submitted') then raise exception 'Refund must be approved before completion'; end if;
 select * into v_payment from public.payment_transactions where id=v_refund.payment_transaction_id for update;
 select * into v_order from public.orders where id=v_refund.order_id for update;
 select id into v_debit from public.ledger_accounts where account_code='CUSTOMER_FUNDS_PENDING' and currency=v_refund.currency and owner_user_id is null limit 1;
 if v_payment.status='settled' then
  select id into v_credit from public.ledger_accounts where account_code='BANK_SETTLEMENT' and currency=v_refund.currency and owner_user_id is null limit 1;
 else
  select id into v_credit from public.ledger_accounts where account_code='PAYFAST_CLEARING' and currency=v_refund.currency and owner_user_id is null limit 1;
 end if;
 if v_debit is null or v_credit is null then raise exception 'Refund ledger accounts missing'; end if;
 update public.refunds set status='completed',provider_reference=p_provider_reference,completed_at=now() where id=p_refund_id;
 insert into public.ledger_journals(source_type,source_id,description,currency)
 values('payfast_refund',v_refund.id,'PayFast refund confirmed by authorised reconciliation workflow',v_refund.currency)
 on conflict(source_type,source_id) do nothing returning id into v_journal;
 if v_journal is not null then
  insert into public.ledger_entries(journal_id,account_id,debit_minor,credit_minor,currency)
  values(v_journal,v_debit,v_refund.amount_minor,0,v_refund.currency),(v_journal,v_credit,0,v_refund.amount_minor,v_refund.currency);
 end if;
 select coalesce(sum(amount_minor),0) into v_refunded from public.refunds where order_id=v_order.id and status='completed';
 if v_refunded>=v_order.amount_minor then
  update public.orders set status='refunded',updated_at=now() where id=v_order.id;
  update public.payment_transactions set status='refunded',updated_at=now() where id=v_payment.id;
 else
  update public.orders set status='partially_refunded',updated_at=now() where id=v_order.id;
 end if;
 return 'completed';
end;
$function$;
revoke all on function public.complete_payfast_refund(uuid,text) from public,anon,authenticated;
grant execute on function public.complete_payfast_refund(uuid,text) to service_role;
