-- Learners may only append their own user messages; assistant/system roles are server-controlled.
drop policy if exists ai_messages_owner_insert on public.ai_messages;
create policy ai_messages_owner_user_message_insert on public.ai_messages
for insert to authenticated with check (
 user_id=(select auth.uid())
 and role='user'
 and exists(select 1 from public.ai_conversations c where c.id=conversation_id and c.user_id=(select auth.uid()))
);
