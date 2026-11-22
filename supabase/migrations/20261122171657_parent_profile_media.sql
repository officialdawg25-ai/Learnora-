-- Private profile media for parent-managed profile pictures.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('learnora-profile-media','learnora-profile-media',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy parent_profile_media_owner_read on storage.objects for select to authenticated using(
 bucket_id='learnora-profile-media' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy parent_profile_media_owner_insert on storage.objects for insert to authenticated with check(
 bucket_id='learnora-profile-media' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy parent_profile_media_owner_update on storage.objects for update to authenticated using(
 bucket_id='learnora-profile-media' and (storage.foldername(name))[1]=auth.uid()::text
) with check(bucket_id='learnora-profile-media' and (storage.foldername(name))[1]=auth.uid()::text);
