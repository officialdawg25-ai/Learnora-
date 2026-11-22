-- Prevent duplicate pending orders and concurrent active payment attempts.
-- Existing production data was checked: no orders or payment transactions exist yet.
create unique index if not exists orders_one_pending_per_learner_course_idx
  on public.orders(learner_id, course_id)
  where status = 'pending';

create unique index if not exists payment_transactions_one_active_per_order_idx
  on public.payment_transactions(order_id)
  where status in ('initiated', 'authorized', 'confirmed', 'settled');
