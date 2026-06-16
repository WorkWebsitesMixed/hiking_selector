-- AdminSync lists the trail-photos bucket (storage.objects) with the anon
-- key to map each trail to its public photo URL. A "public" bucket only
-- makes objects readable by direct URL; the list() API still goes through
-- RLS on storage.objects, which by default denies anon. Without this policy
-- list() returns an empty array (no error) and no photo_url ever gets set.
create policy "anon: list trail-photos"
  on storage.objects for select
  to anon
  using (bucket_id = 'trail-photos');
