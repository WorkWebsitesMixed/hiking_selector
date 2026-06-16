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
- **Deployment:** GitHub Pages, built & published by a GitHub Actions
  workflow on every push to `main`. **Live at
  https://workwebsitesmixed.github.io/hiking_selector/**

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

## Deployment (done — June 2026)

- **Hosting:** GitHub Pages, repo `WorkWebsitesMixed/hiking_selector`.
- **Source:** Pages "Source" is set to **GitHub Actions** (not a branch).
- **Workflow:** `.github/workflows/deploy.yml` — on push to `main` (or manual
  `workflow_dispatch`), runs `npm ci && npm run build`, then publishes `dist/`
  via the official `actions/upload-pages-artifact` + `actions/deploy-pages`.
- **Build secrets:** all six `VITE_*` vars are stored as **repository secrets**
  (Settings → Secrets and variables → Actions) and injected at build time.
  ⚠️ A build that runs *before* the secrets exist bakes in empty values and the
  site renders blank (`createClient('', '')` throws `supabaseUrl is required`);
  re-run the workflow after secrets are set.
- **Routing:** switched `BrowserRouter` → `HashRouter` so client-side routes
  work on Pages without a 404 redirect. Vite `base` = `/hiking_selector/`.
- **HashRouter gotcha:** the token/admin params are read from
  `window.location.search`, which is the part **before** the `#`. So URLs put
  the query first:
  - Friend: `…/hiking_selector/?token=<token>`
  - Admin:  `…/hiking_selector/?admin=<VITE_ADMIN_TOKEN>#/admin`
- ⚠️ **`VITE_ADMIN_TOKEN` is baked into the public JS bundle** — anyone viewing
  the site can read it and reach `/admin`. Acceptable for now; the real fix is
  moving admin sync server-side (Supabase edge function / RLS). Same is true of
  `VITE_SHEETS_API_KEY` — restrict that key in Google Cloud Console.

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
| 9 | GitHub Pages deployment (GitHub Actions workflow, HashRouter, base path, repo secrets) | ✅ Done & live |

---

## Immediate next steps

1. **Onboarding friends (in progress).**
   - 11 friends' name→token pairs generated and saved to `friend_tokens.md`
     (gitignored). Ready-to-run `insert into users …` SQL is in that file.
   - ⏳ **Still to do:** run that SQL in the Supabase SQL Editor to create the
     rows, then send each friend their `…/?token=<theirs>` link.
   - Remind them to bookmark it (loss of token = re-share needed until a
     self-registration flow exists).

2. **Fix the photo data gap (Option A):**
   - For each trail already uploaded to the `trail-photos` bucket, paste its
     full public URL into column M of that row in the Google Sheet.
   - Re-run sync at `…/?admin=<VITE_ADMIN_TOKEN>#/admin`.
   - Verify in Supabase Table Editor (`select route_name, photo_url from
     trails where photo_url is not null`).
   - Verify cards/hero render photos correctly, and that trails without
     photos still show the charcoal fallback.

3. **Optional future work (not committed to yet):**
   - Self-registration flow (`/join` page) — was discussed as a clean
     future migration since the rest of the app only cares that a valid
     token exists, not how it was created.
   - More photos added incrementally via the Sheet column M workflow.
   - Possible additional leaderboard stats (furthest from Medellín
     completed, etc.) — mentioned as an idea, not committed.

---

## Feature ideas under discussion (June 2026 — NOT yet designed or built)

Raised by Andrés; to be discussed before any implementation. Captured here so
the intent isn't lost.

1. **Comments on *any* route, not just completed ones.** Today the `comment`
   field lives on a `completions` row, so you can only leave a note on a trail
   you've marked done. Idea: let friends leave messages on any trail — more
   like a social/message board per route ("let's do this one Saturday!").
   - Implication: comments need to decouple from `completions`. Likely a new
     `comments` (or `messages`) table: `id, trail_id, user_id, body,
     created_at`, with its own RLS. Existing completion-comments stay as-is or
     migrate.

2. **Notification bell.** When a friend opens the site, show a bell with unread
   notifications — e.g. someone left a message on a route, or completed one.
   - Implication: needs a notion of "read state" per user (e.g. a
     `last_seen_at` per user, or a `notifications`/`reads` table). No server
     means polling on load rather than push. Scope to define: what events
     generate a notification (new comment? new completion? mentions?).

3. **Clickable username → personal profile page.** The nav shows the logged-in
   user's name (`Rutas / Expedición / <name>`) but clicking it does nothing.
   Idea: make it route to a profile page showing that person's completed
   routes (and maybe their comments/stats).
   - Implication: new `/me` (or `/u/:id`) route + page. Data already exists —
     `completions` filtered by `user_id` joined to `trails`. Mostly a new view
     over existing data; smallest of the three.

### Discussion conclusions (where we landed)

**Recommended build order — easiest to hardest, and each builds on the last:**

1. **Profile page** first. No schema change, no new RLS — pure view over
   existing `completions`+`trails` data. Quick, satisfying win.
2. **Comments on any route** next. The heart of the request; unlocks the
   social layer. Requires the new `comments` table.
3. **Notification bell** last. Depends on comments existing (they're the main
   thing worth notifying about) and has the most design surface (read-state +
   "which events count").

**Three open decisions still needed from Andrés before building:**

1. **Profiles — scope:** your own profile only, or any friend's too (e.g.
   click a name on the leaderboard)? *Claude's suggestion: any friend's — same
   query, makes the leaderboard more engaging.*
2. **Comments — type:** per-route discussion threads (recommended, simpler,
   matches "comment on any route"), or also person-to-person direct messages?
   *Claude's suggestion: start with per-route threads only.*
3. **Notifications — trigger events:** which events ring the bell? New comment
   on any route? Only routes I've completed? A friend's new completion?
   @-mentions? *Defer this decision until comments (#2) are built.*

**Implementation notes carried over from discussion:**
- No server → notifications are computed on page load (polling), not pushed.
  Simplest read-state = a `last_seen_at` timestamp on the `users` row; on load,
  count items newer than it; clear on opening the bell.
- New `comments` table shape proposed: `id, trail_id, user_id, body,
  created_at`, with anon insert/select RLS like the rest of the app. Decide
  whether to migrate existing completion-comments into it or leave them.
- Profile route: `/u/:id` so any user's profile is addressable (vs `/me`).

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
