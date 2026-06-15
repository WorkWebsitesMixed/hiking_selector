# Senderos Antioquia — Project Handoff

A hiking trail browser + group completion tracker for a friend group hiking
in Antioquia, Colombia. Built with React + Vite + Supabase + Tailwind,
deployed to GitHub Pages. Trail data is sourced from a Google Sheet.

---

## Stack

- **Frontend:** React + Vite, React Router, Tailwind CSS (custom palette, no
  component libraries — no shadcn/MUI/Radix)
- **Backend:** Supabase (Postgres + Storage), accessed directly from the
  browser via the anon key
- **Trail data source:** Google Sheet, synced manually into Supabase via an
  admin page
- **Deployment target:** GitHub Pages (not yet done — Stage 9)

---

## Why things are the way they are

- **No server.** Everything runs client-side with the Supabase anon key.
  RLS policies are deliberately permissive (anon can read/write
  trails/completions/users) because this is a closed friend-group app with
  no public exposure. This was a conscious tradeoff, documented in the
  migration file's comments.
- **Token-based auth, no passwords/OAuth.** Each friend gets a personal URL
  `?token=xxxx`. The token is validated against `users.token`, then stored
  in localStorage. No login screen, no registration flow (yet).
- **Manual sync from Google Sheets.** Andrés is the only one who edits trail
  data. The Sheet stays the source of truth; an `/admin` page (guarded by
  `?admin=<VITE_ADMIN_TOKEN>`) pulls the Sheet via the Sheets API and
  upserts into `trails` (onConflict: route_name).
- **Snapshot pattern on completions.** `completions` stores
  `distance_km_snapshot`, `difficulty_snapshot`, `elevation_gain_snapshot`
  copied at the time of logging, so historical leaderboard stats don't
  silently change if a trail's data is corrected later.
- **Design language:** parchment light mode for the trail browser, charcoal
  dark mode for trail detail hero + leaderboard. Fraunces for headings,
  Inter for body, JetBrains Mono for all numeric/data values (distances,
  elevations, dates). Difficulty shown as filled/empty pip dots (●●●○○),
  not a green-yellow-red scale. Cards have an amber left-border accent when
  no photo is present; cards with photos drop the border and use the photo
  as the visual anchor instead. Explicitly avoided: drop-shadow cards,
  gradients, mountain silhouette clichés, icon libraries (icons are inline
  SVG only).

---

## Supabase setup (already done)

Project: `lhacvwnrfmydjcpfiavt` (São Paulo region)

### Tables (migration: `supabase/migrations/20260515000000_initial_schema.sql`)

- **users** — `id, name, token (unique), joined_at`. Anon SELECT only.
- **trails** — all 12 Sheet columns mapped to typed columns
  (`difficulty_score` 1–5 with CHECK constraint, `distance_km` numeric,
  `max_altitude_m`, `elevation_gain_m`, etc.) plus `photo_url` (added in
  Stage 8) and `updated_at` with an update trigger. Anon SELECT + UPSERT
  (needed for browser-based admin sync).
- **completions** — `user_id`, `trail_id` (FKs), three snapshot columns,
  `completed_date`, optional `comment`, unique constraint on
  `(user_id, trail_id)`. Anon SELECT + INSERT + UPDATE, no DELETE policy.

### Storage

- Public bucket `trail-photos`, public-read policy for `anon`.
- Public URL pattern:
  `https://lhacvwnrfmydjcpfiavt.supabase.co/storage/v1/object/public/trail-photos/<filename>.jpg`
- **Open issue (in progress):** photo URLs were uploaded directly into
  Supabase but the Sheet's column M ("Photo URL") is empty for those rows,
  so re-syncing nulls them out (sync upserts every column). Decision made:
  go with **Option A** — paste the full Supabase Storage URL into column M
  of the Sheet for each trail that has a photo, then re-sync. This keeps
  the Sheet as the single source of truth. Not yet done for the trails
  already uploaded to Storage.

---

## Environment variables (`.env`)

```
VITE_SUPABASE_URL=https://lhacvwnrfmydjcpfiavt.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_SHEET_ID=1qW1jLdTDLY7X8H9wL7nVWel9aHl9FrDuRs3uuxZdhys
VITE_SHEETS_API_KEY=...
VITE_ADMIN_TOKEN=...
VITE_STORAGE_URL=https://lhacvwnrfmydjcpfiavt.supabase.co/storage/v1/object/public/trail-photos
```

Google Sheet must have 13 columns (A–M), with **column M = "Photo URL"**
(added in Stage 8, currently mostly empty).

---

## Stage-by-stage status

| Stage | What | Status |
|---|---|---|
| 1 | Project scaffold (Vite, Tailwind, Router, folder structure, Supabase client) | ✅ Done & verified |
| 2 | Supabase migration (3 tables, RLS) + `UserContext` (token auth) | ✅ Done & verified |
| 3 | `AdminSync` — Sheets fetch, parsing, upsert to `trails` | ✅ Done & verified |
| 4 | `TrailBrowser` — filters (region/grade/type/search), trail cards | ✅ Done & verified |
| — | Visual polish: darker metadata text, inline SVG stat icons | ✅ Done |
| 5 | `TrailDetail` — dark hero, stats, terrain/description, YouTube/photo links, "you did this" stamp, logbook of completions, inline completion form (mark/edit) | ✅ Done & verified |
| 6 | `Leaderboard` (`/leaderboard`) — group totals, ranked entries with snapshot-based stats, "tú" tag, amber #1 | ✅ Done & verified |
| 7 | Navigation bar (light/dark variants, Rutas / Expedición / user name, persistent across routes) | ✅ Done |
| 8 | Photo integration — `photo_url` column, Sheet column M, AdminSync mapping, TrailCard photo/fallback, TrailDetail hero background photo, lazy-load + onError fallback | ✅ Code done & build clean. **Data not yet populated** — see open issue above |
| 9 | GitHub Pages deployment | ⏳ Not started |

---

## Immediate next steps

1. **Fix the photo data gap (Option A):**
   - For each trail already uploaded to the `trail-photos` bucket, paste its
     full public URL into column M of that row in the Google Sheet.
   - Re-run `/admin?admin=<VITE_ADMIN_TOKEN>` sync.
   - Verify in Supabase Table Editor (`select route_name, photo_url from
     trails where photo_url is not null`).
   - Verify cards/hero render photos correctly, and that trails without
     photos still show the charcoal fallback.

2. **Stage 9 — GitHub Pages deployment.** Known gotchas to discuss before
   handing to Claude Code:
   - Vite's `base` config needs to match the repo name for GitHub Pages
     subpath routing.
   - React Router needs either `HashRouter` or a 404.html redirect trick
     for client-side routing on GitHub Pages (BrowserRouter + GH Pages
     refresh = 404 otherwise).
   - Environment variables (`VITE_*`) need to be baked in at build time —
     GitHub Actions secrets or a committed `.env.production` (the anon key
     and Sheets API key are meant to be public-safe, but `VITE_ADMIN_TOKEN`
     ending up in a public repo's build output is worth a conscious
     decision, not an accident).
   - `gh-pages` package install + deploy script.

3. **Onboarding friends:**
   - Add each friend as a row in `users` (name + random token) via Supabase
     SQL Editor.
   - Send each friend their personal URL: `<deployed-url>/?token=<theirs>`.
   - Remind them to bookmark it (loss of token = re-share needed until a
     self-registration flow exists).

4. **Optional future work (not committed to yet):**
   - Self-registration flow (`/join` page) — was discussed as a clean
     future migration since the rest of the app only cares that a valid
     token exists, not how it was created.
   - More photos added incrementally via the Sheet column M workflow.
   - Possible additional leaderboard stats (furthest from Medellín
     completed, etc.) — mentioned as an idea, not committed.

---

## Working conventions established in this project

- **Staged build process** — one stage at a time, Claude Code confirms
  before moving on, user tests each stage before approving the next.
- **Visual-only fix requests are scoped explicitly** ("no logic changes")
  to avoid scope creep into working features.
- **No icon libraries, no UI component libraries** — inline SVG and custom
  Tailwind components only, to avoid the "generic AI-built site" look.
- **Spanish UI strings** (`Rutas`, `Expedición`, `Cuadro de honor del
  grupo`, `Registro del grupo`, `Marcar como completada`, etc.) — the app
  is Spanish-facing for the friend group, code/comments in English.
