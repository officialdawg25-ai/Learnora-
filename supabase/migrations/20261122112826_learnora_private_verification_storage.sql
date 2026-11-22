-- Private educator verification evidence bucket. No public object access.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('learnora-verification','learnora-verification',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf','image/jpeg','image/png'];

drop policy if exists learnora_verification_upload_own on storage.objects;
create policy learnora_verification_upload_own on storage.objects
for insert to authenticated with check (
 bucket_id='learnora-verification'
 and (storage.foldername(name))[1]=(select auth.uid())::text
);
drop policy if exists learnora_verification_read_own on storage.objects;
create policy learnora_verification_read_own on storage.objects
for select to authenticated using (
 bucket_id='learnora-verification'
 and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists educator_verification_insert_owner on public.educator_verification_submissions;
create policy educator_verification_insert_owner on public.educator_verification_submissions
for insert to authenticated with check (
 educator_user_id=(select auth.uid())
 and status='pending'
 and reviewer_user_id is null
 and reviewed_at is null
 and (document_storage_path is null or document_storage_path like ((select auth.uid())::text || '/%'))
);
