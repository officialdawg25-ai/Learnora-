drop policy if exists user_notifications_update_read_at_recipient on public.user_notifications;
create policy user_notifications_update_read_at_recipient on public.user_notifications for update to authenticated
using(recipient_user_id=(select auth.uid()))
with check(recipient_user_id=(select auth.uid()));
grant update(read_at) on public.user_notifications to authenticated;
