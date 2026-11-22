-- Re-check guardian authority on every parent-side conversation read/write.
drop policy if exists family_conversation_participant_read on public.family_conversations;
create policy family_conversation_participant_read on public.family_conversations for select to authenticated using(
 (parent_user_id=auth.uid() and private.is_verified_guardian(learner_user_id))
 or
 (educator_user_id=auth.uid() and exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='educator' and r.status='active'))
);
