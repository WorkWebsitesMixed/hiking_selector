-- migration: 20260615000000_add_photo_url_to_trails.sql
-- Run in the Supabase SQL Editor or via: supabase db push
--
-- Adds the photo_url column that was introduced in Stage 8 (photo
-- integration). The column already exists in the live Supabase project
-- but was created directly in the dashboard and never captured in a
-- migration, so a fresh `supabase db reset`/`db push` from this repo
-- would otherwise be missing it and the admin sync would fail on insert.
--
-- Populated from the Google Sheet's column M ("Photo URL"); rows without
-- a photo stay null and the UI falls back to the charcoal placeholder.

alter table trails
  add column if not exists photo_url text;
