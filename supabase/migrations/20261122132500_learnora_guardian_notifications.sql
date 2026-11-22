-- In-app notification delivery for guardian relationship lifecycle events.
create table public.user_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_user_id uuid not null references public.profiles(id) on delete cascade,
 actor_user_id uuid references public.profiles(id) on delete set null,
 notification_type text not null check(notification_type in (
  'guardian_request','guardian_invite_redeemed','guardian_learner_approved','guardian_learner_declined',
  'guardian_connection_revoked','guardian_connection_activated','guardian_connection_rejected'
 )),
 title text not null check(length(title) between 1 and 140),
 body text not null check(length(body) between 1 and 500),
 resource_type text not null default 'guardian_relationship',
 resource_id uuid not null,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create index user_notifications_recipient_created_idx on public.user_notifications(recipient_user_id,created_at desc);
create index user_notifications_unread_idx on public.user_notifications(recipient_user_id,created_at desc) where read_at is null;
alter table public.user_notifications enable row level security;
revoke all on public.user_notifications from anon,authenticated;
grant select on public.user_notifications to authenticated;
create policy user_notifications_select_recipient on public.user_notifications for select to authenticated
 using(recipient_user_id=(select auth.uid()));

create or replace function private.notify_guardian_relationship_event()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare v_guardian uuid; v_learner uuid; v_type text; v_title text; v_body text;
begin
 select guardian_user_id,learner_user_id into v_guardian,v_learner
 from public.guardian_relationships where id=new.relationship_id;
 if v_guardian is null or v_learner is null then return new; end if;
 case new.event_type
  when 'request_submitted' then
   v_type:='guardian_request';v_title:='A family connection was requested';v_body:='A parent or guardian has requested a connection to your Learnora account.';
   insert into public.user_notifications(recipient_user_id,actor_user_id,notification_type,title,body,resource_id,metadata)
   values(v_learner,new.actor_user_id,v_type,v_title,v_body,new.relationship_id,new.metadata);
  when 'invite_redeemed' then
   v_type:='guardian_invite_redeemed';v_title:='Your invitation was redeemed';v_body:='A parent or guardian redeemed your invitation. Review the connection request in your family space.';
   insert into public.user_notifications(recipient_user_id,actor_user_id,notification_type,title,body,resource_id,metadata)
   values(v_learner,new.actor_user_id,v_type,v_title,v_body,new.relationship_id,new.metadata);
  when 'learner_approved' then
   v_type:='guardian_learner_approved';v_title:='Learner acknowledgement received';v_body:='The learner acknowledged your request. Independent guardian-authority verification is still required.';
   insert into public.user_notifications(recipient_user_id,actor_user_id,notification_type,title,body,resource_id,metadata)
   values(v_guardian,new.actor_user_id,v_type,v_title,v_body,new.relationship_id,new.metadata);
  when 'learner_declined' then
   v_type:='guardian_learner_declined';v_title:='Connection request declined';v_body:='The learner declined this connection request. No guardian access was activated.';
   insert into public.user_notifications(recipient_user_id,actor_user_id,notification_type,title,body,resource_id,metadata)
   values(v_guardian,new.actor_user_id,v_type,v_title,v_body,new.relationship_id,new.metadata);
  when 'guardian_revoked' then
   v_type:='guardian_connection_revoked';v_title:='Family connection revoked';v_body:='A guardian revoked this family connection. Relationship-based access has ended.';
   insert into public.user_notifications(recipient_user_id,actor_user_id,notification_type,title,body,resource_id,metadata)
   values(v_learner,new.actor_user_id,v_type,v_title,v_body,new.relationship_id,new.metadata);
  when 'learner_revoked' then
   v_type:='guardian_connection_revoked';v_title:='Family connection revoked';v_body:='The learner revoked this family connection. Relationship-based access has ended.';
   insert into public.user_notifications(recipient_user_id,actor_user_id,notification_type,title,body,resource_id,metadata)
   values(v_guardian,new.actor_user_id,v_type,v_title,v_body,new.relationship_id,new.metadata);
  when 'admin_activated' then
   v_type:='guardian_connection_activated';v_title:='Family connection verified';v_body:='The family connection has passed the required review and is now active within its approved information categories.';
   insert into public.user_notifications(recipient_user_id,actor_user_id,notification_type,title,body,resource_id,metadata)
   values(v_guardian,new.actor_user_id,v_type,v_title,v_body,new.relationship_id,new.metadata),
         (v_learner,new.actor_user_id,v_type,v_title,v_body,new.relationship_id,new.metadata);
  when 'admin_rejected' then
   v_type:='guardian_connection_rejected';v_title:='Family connection not approved';v_body:='The connection request was not approved. No guardian access is active.';
   insert into public.user_notifications(recipient_user_id,actor_user_id,notification_type,title,body,resource_id,metadata)
   values(v_guardian,new.actor_user_id,v_type,v_title,v_body,new.relationship_id,new.metadata),
         (v_learner,new.actor_user_id,v_type,v_title,v_body,new.relationship_id,new.metadata);
  else
   null;
 end case;
 return new;
end;
$function$;
revoke all on function private.notify_guardian_relationship_event() from public,anon,authenticated;
create trigger guardian_relationship_event_notify
 after insert on public.guardian_relationship_events
 for each row execute function private.notify_guardian_relationship_event();

create or replace function private.mark_user_notification_read(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $function$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.user_notifications set read_at=coalesce(read_at,now())
 where id=p_notification_id and recipient_user_id=auth.uid();
 return found;
end;
$function$;
revoke all on function private.mark_user_notification_read(uuid) from public,anon;
grant execute on function private.mark_user_notification_read(uuid) to authenticated;

create or replace function public.mark_user_notification_read(p_notification_id uuid)
returns boolean language sql security invoker set search_path=''
as $function$ select private.mark_user_notification_read($1); $function$;
revoke all on function public.mark_user_notification_read(uuid) from public,anon;
grant execute on function public.mark_user_notification_read(uuid) to authenticated;

comment on table public.user_notifications is 'Recipient-scoped in-app notifications. Guardian relationship notifications are generated from append-only relationship events; client inserts are not permitted.';
