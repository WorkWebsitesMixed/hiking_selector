-- Admin sync prunes trails that have been removed from the Google Sheet.
-- Like the upsert/update policies, this runs in the browser with the anon
-- key, guarded at the UI level by VITE_ADMIN_TOKEN. The completions.trail_id
-- foreign key (ON DELETE NO ACTION) still blocks deleting any trail that has
-- logged completions, so logbook data cannot be lost this way.
create policy "anon: delete trails"
  on trails for delete
  to anon
  using (true);
