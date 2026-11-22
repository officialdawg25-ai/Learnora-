-- Learnora commercial ledger and payment lifecycle. No browser writes to financial records.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id),
  course_id uuid not null references public.courses(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'ZAR',
  status text not null default 'pending' check (status in ('pending','paid','partially_refunded','refunded','cancelled','failed')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (learner_id,course_id,id)
);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  provider text not null check (provider in ('payfast')),
  provider_reference text unique,
  merchant_payment_id text unique,
  idempotency_key text not null unique,
  status text not null default 'initiated' check (status in ('initiated','authorized','confirmed','settled','failed','cancelled','refund_pending','refunded')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'ZAR',
  verified_at timestamptz,
  settled_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('payfast')),
  provider_event_id text not null,
  payload_hash text not null,
  processing_status text not null default 'received' check (processing_status in ('received','processing','processed','failed','ignored')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  failure_reason text,
  unique(provider,provider_event_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  payment_transaction_id uuid not null references public.payment_transactions(id),
  requested_by uuid not null references public.profiles(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'ZAR',
  reason text not null,
  status text not null default 'requested' check (status in ('requested','approved','submitted','completed','rejected','failed')),
  provider_reference text unique,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code text not null,
  account_name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','revenue','expense')),
  currency char(3) not null default 'ZAR',
  owner_user_id uuid references public.profiles(id),
  is_control_account boolean not null default false,
  created_at timestamptz not null default now(),
  unique(account_code,currency,owner_user_id)
);

create table public.ledger_journals (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id uuid not null,
  description text not null,
  currency char(3) not null default 'ZAR',
  status text not null default 'posted' check (status in ('posted','reversed')),
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(source_type,source_id)
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.ledger_journals(id),
  account_id uuid not null references public.ledger_accounts(id),
  debit_minor bigint not null default 0 check (debit_minor >= 0),
  credit_minor bigint not null default 0 check (credit_minor >= 0),
  currency char(3) not null default 'ZAR',
  created_at timestamptz not null default now(),
  check ((debit_minor > 0 and credit_minor = 0) or (credit_minor > 0 and debit_minor = 0))
);

create table public.educator_earnings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  educator_user_id uuid not null references public.profiles(id),
  academy_id uuid not null references public.academies(id),
  gross_minor bigint not null check (gross_minor > 0),
  platform_fee_minor bigint not null check (platform_fee_minor >= 0),
  net_minor bigint not null check (net_minor >= 0 and net_minor = gross_minor-platform_fee_minor),
  currency char(3) not null default 'ZAR',
  status text not null default 'accrued' check (status in ('accrued','held','available','paid','reversed')),
  created_at timestamptz not null default now(),
  unique(order_id,educator_user_id)
);

create table public.payout_records (
  id uuid primary key default gen_random_uuid(),
  educator_user_id uuid not null references public.profiles(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'ZAR',
  status text not null default 'requested' check (status in ('requested','approved','processing','paid','failed','cancelled')),
  provider_reference text unique,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  failure_reason text
);

create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  plan_code text not null,
  provider text not null check (provider in ('payfast')),
  provider_subscription_id text unique,
  status text not null default 'pending' check (status in ('pending','active','past_due','paused','cancelled','expired')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'ZAR',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_learner_created_idx on public.orders(learner_id,created_at desc);
create index orders_course_idx on public.orders(course_id);
create index payment_transactions_order_idx on public.payment_transactions(order_id,created_at desc);
create index payment_webhook_status_idx on public.payment_webhook_events(processing_status,received_at);
create index refunds_order_idx on public.refunds(order_id,requested_at desc);
create index ledger_entries_journal_idx on public.ledger_entries(journal_id);
create index ledger_entries_account_idx on public.ledger_entries(account_id,created_at);
create index educator_earnings_user_status_idx on public.educator_earnings(educator_user_id,status);
create index payout_records_user_status_idx on public.payout_records(educator_user_id,status);
create index billing_subscriptions_user_status_idx on public.billing_subscriptions(user_id,status);

insert into public.ledger_accounts(account_code,account_name,account_type,currency,is_control_account)
values
 ('PAYFAST_CLEARING','PayFast clearing','asset','ZAR',true),
 ('EDUCATOR_PAYABLE','Educator payable','liability','ZAR',true),
 ('PLATFORM_REVENUE','Platform commission revenue','revenue','ZAR',true),
 ('REFUNDS_PAYABLE','Refunds payable','liability','ZAR',true),
 ('BANK_SETTLEMENT','Bank settlement','asset','ZAR',true)
on conflict do nothing;

alter table public.orders enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.refunds enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.ledger_journals enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.educator_earnings enable row level security;
alter table public.payout_records enable row level security;
alter table public.billing_subscriptions enable row level security;

grant select on public.orders,public.payment_transactions,public.refunds,public.educator_earnings,public.payout_records,public.billing_subscriptions to authenticated;
revoke all on public.payment_webhook_events,public.ledger_accounts,public.ledger_journals,public.ledger_entries from anon,authenticated;
revoke insert,update,delete on public.orders,public.payment_transactions,public.refunds,public.educator_earnings,public.payout_records,public.billing_subscriptions from anon,authenticated;

create policy orders_select_owner_or_academy on public.orders for select to authenticated using (
 learner_id=(select auth.uid()) or exists(select 1 from public.courses c where c.id=course_id and private.can_manage_academy(c.academy_id))
);
create policy payments_select_order_owner_or_academy on public.payment_transactions for select to authenticated using (
 exists(select 1 from public.orders o join public.courses c on c.id=o.course_id where o.id=order_id and (o.learner_id=(select auth.uid()) or private.can_manage_academy(c.academy_id)))
);
create policy refunds_select_order_owner on public.refunds for select to authenticated using (
 exists(select 1 from public.orders o where o.id=order_id and o.learner_id=(select auth.uid()))
);
create policy educator_earnings_select_self on public.educator_earnings for select to authenticated using (educator_user_id=(select auth.uid()));
create policy payout_records_select_self on public.payout_records for select to authenticated using (educator_user_id=(select auth.uid()));
create policy billing_subscriptions_select_self on public.billing_subscriptions for select to authenticated using (user_id=(select auth.uid()));

create or replace function private.post_ledger_journal(
 p_source_type text,p_source_id uuid,p_description text,p_currency char(3),p_entries jsonb
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_journal_id uuid; v_debits bigint; v_credits bigint; v_count integer;
begin
 if auth.role() <> 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 if jsonb_typeof(p_entries)<>'array' then raise exception 'Entries must be an array'; end if;
 select count(*),coalesce(sum((x->>'debit_minor')::bigint),0),coalesce(sum((x->>'credit_minor')::bigint),0)
 into v_count,v_debits,v_credits from jsonb_array_elements(p_entries) x;
 if v_count<2 or v_debits<=0 or v_debits<>v_credits then raise exception 'Journal entries must balance and contain at least two lines'; end if;
 insert into public.ledger_journals(source_type,source_id,description,currency)
 values(p_source_type,p_source_id,p_description,p_currency)
 on conflict(source_type,source_id) do nothing returning id into v_journal_id;
 if v_journal_id is null then
   select id into v_journal_id from public.ledger_journals where source_type=p_source_type and source_id=p_source_id;
   return v_journal_id;
 end if;
 insert into public.ledger_entries(journal_id,account_id,debit_minor,credit_minor,currency)
 select v_journal_id,(x->>'account_id')::uuid,coalesce((x->>'debit_minor')::bigint,0),coalesce((x->>'credit_minor')::bigint,0),p_currency
 from jsonb_array_elements(p_entries) x;
 return v_journal_id;
end;
$function$;
revoke all on function private.post_ledger_journal(text,uuid,text,char,jsonb) from public,anon,authenticated;
grant execute on function private.post_ledger_journal(text,uuid,text,char,jsonb) to service_role;

comment on table public.payment_transactions is 'Payment provider state is server-verified. A callback alone does not prove bank settlement.';
comment on table public.ledger_journals is 'Immutable double-entry journals; only service-controlled workflows can post entries.';
comment on table public.educator_earnings is 'Accrued contractual earnings, distinct from actual bank payout settlement.';
