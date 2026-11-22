-- Remove public SECURITY DEFINER exposure from credential verification and refund requests.
drop function if exists public.verify_learnora_credential(text);
create or replace view public.credential_verification_public
with (security_barrier=true)
as
select credential_identifier,issuer_name,credential_title,credential_type,issued_at,status,accreditation_reference
from public.credentials
where status='active';
grant select on public.credential_verification_public to anon,authenticated;

drop function if exists public.request_order_refund(uuid,text);
create or replace function public.request_order_refund(p_order_id uuid,p_reason text)
returns uuid language plpgsql security invoker set search_path=''
as $function$
declare v_order public.orders%rowtype; v_payment public.payment_transactions%rowtype; v_refund_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if length(trim(coalesce(p_reason,'')))<10 or length(p_reason)>2000 then raise exception 'Please provide a reason between 10 and 2000 characters'; end if;
 select * into v_order from public.orders where id=p_order_id and learner_id=(select auth.uid());
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
grant insert on public.refunds to authenticated;
create policy refunds_insert_owner_verified_payment on public.refunds
for insert to authenticated with check (
 requested_by=(select auth.uid())
 and status='requested'
 and exists(select 1 from public.orders o where o.id=order_id and o.learner_id=(select auth.uid()) and o.amount_minor=refunds.amount_minor and o.currency=refunds.currency and o.status in ('paid','partially_refunded'))
 and exists(select 1 from public.payment_transactions p where p.id=refunds.payment_transaction_id and p.order_id=refunds.order_id and p.status in ('confirmed','settled'))
);
