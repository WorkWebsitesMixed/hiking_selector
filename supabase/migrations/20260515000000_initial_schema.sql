-- migration: 20260515000000_initial_schema.sql
-- Run in the Supabase SQL Editor or via: supabase db push

-- ============================================================
-- Helper trigger function: keeps updated_at current on trails
-- ============================================================
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- users
-- ============================================================
create table users (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  token      text        not null unique,
  joined_at  timestamptz not null default now()
);

alter table users enable row level security;

-- Anon key must be able to look up a user by token to complete
-- the auth flow. This exposes names + tokens to anyone with the
-- anon key, which is acceptable for a closed friend-group app.
create policy "anon: read users"
  on users for select
  to anon
  using (true);


-- ============================================================
-- trails
-- ============================================================
create table trails (
  id                     uuid        primary key default gen_random_uuid(),
  route_name             text        not null unique,
  region                 text,
  distance_from_medellin text,
  difficulty_label       text,
  difficulty_score       integer     check (difficulty_score between 1 and 5),
  distance_km            numeric,
  duration_hours         text,
  max_altitude_m         integer,
  elevation_gain_m       integer,
  terrain_info           text,
  category               text,
  description            text,
  youtube_link           text,
  photo_link             text,
  updated_at             timestamptz not null default now()
);

alter table trails enable row level security;

create policy "anon: read trails"
  on trails for select
  to anon
  using (true);

-- Admin sync runs entirely in the browser using the anon key.
-- There is no server-side backend to hold a service role key,
-- so upserts from the admin page must be allowed via anon.
-- The /admin route is guarded at the UI level by VITE_ADMIN_TOKEN.
-- NOTE: this means anyone who finds the anon key + admin token
-- can modify trail data. Acceptable for this threat model; can
-- be hardened later with a Supabase Edge Function.
create policy "anon: upsert trails"
  on trails for insert
  to anon
  with check (true);

create policy "anon: update trails"
  on trails for update
  to anon
  using (true);

create trigger trails_updated_at
  before update on trails
  for each row execute function update_updated_at();

create index trails_region_idx     on trails (region);
create index trails_difficulty_idx on trails (difficulty_score);
create index trails_category_idx   on trails (category);


-- ============================================================
-- completions
-- ============================================================
create table completions (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references users (id),
  trail_id                uuid        not null references trails (id),
  elevation_gain_snapshot integer,
  distance_km_snapshot    numeric,
  difficulty_snapshot     integer,
  completed_date          date        not null,
  comment                 text,
  created_at              timestamptz not null default now(),

  unique (user_id, trail_id)
);

alter table completions enable row level security;

-- Leaderboard is visible to the whole group, so full read is fine.
create policy "anon: read completions"
  on completions for select
  to anon
  using (true);

-- Any anon call may insert/update — app code must ensure user_id
-- belongs to the token holder before calling this.
create policy "anon: insert completions"
  on completions for insert
  to anon
  with check (true);

create policy "anon: update completions"
  on completions for update
  to anon
  using (true);

create index completions_user_id_idx  on completions (user_id);
create index completions_trail_id_idx on completions (trail_id);
