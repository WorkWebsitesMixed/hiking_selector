import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN
const SHEET_ID    = import.meta.env.VITE_SHEET_ID
const SHEETS_KEY  = import.meta.env.VITE_SHEETS_API_KEY

const STORAGE_BUCKET = 'trail-photos'

// "Cañón del Cauca (Mirador Trail)" → "canon-del-cauca-mirador-trail"
// Matches how the trail photo files are named. Diacritics are stripped
// because Supabase Storage object keys reject accented characters, so
// uploaded files lose their tildes (e.g. "Citará" → "citara"). Stripping
// on both the route name and the filename keeps the two sides aligned.
function slugify(s) {
  return (s ?? '')
    .normalize('NFD')                       // split accented letters into base + combining mark
    .replace(/[\u0300-\u036f]/g, '')        // drop the combining marks (tildes, accents)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')           // keep ascii letters, digits, spaces, hyphens
    .trim()
    .replace(/\s+/g, '-')
}

// "12 km / 6-7 hours" → 12
function parseDistanceKm(raw) {
  const m = (raw ?? '').match(/([\d.]+)\s*km/i)
  return m ? parseFloat(m[1]) : null
}

// "12 km / 6-7 hours" → "6-7 hours"
function parseDuration(raw) {
  const parts = (raw ?? '').split(' / ')
  return parts[1]?.trim() || null
}

// "2,600m / +900m" → 2600
function parseAltitude(raw) {
  const m = (raw ?? '').replace(/,/g, '').match(/^(\d+)m/)
  return m ? parseInt(m[1]) : null
}

// "2,600m / +900m" → 900
function parseElevation(raw) {
  const m = (raw ?? '').replace(/,/g, '').match(/\+(\d+)m/)
  return m ? parseInt(m[1]) : null
}

function rowToTrail(headers, row) {
  const get = (name) => (row[headers.indexOf(name)] ?? '').trim()

  const distDur = get('Distance / Duration')
  const altElev = get('Max Altitude & Elevation Gain')

  return {
    route_name:             get('Route Name') || null,
    region:                 get('Antioquia Region') || null,
    distance_from_medellin: get('Distance from Medellín') || null,
    difficulty_label:       get('Difficulty Level') || null,
    difficulty_score:       parseInt(get('Difficulty (1-5)')) || null,
    distance_km:            parseDistanceKm(distDur),
    duration_hours:         parseDuration(distDur),
    max_altitude_m:         parseAltitude(altElev),
    elevation_gain_m:       parseElevation(altElev),
    terrain_info:           get('Terrain & Technical Info') || null,
    category:               get('Category') || null,
    description:            get('Description') || null,
    youtube_link:           get('YouTube Search Link') || null,
    photo_link:             get('Photo Search Link') || null,
    // photo_url is derived from the Storage bucket at sync time, not the sheet.
  }
}

// List the trail-photos bucket and build a { slug → public URL } map.
// Only photos that actually exist get linked, so missing-photo trails
// keep photo_url = null instead of pointing at a broken URL.
async function buildPhotoMap() {
  const { data: files, error } = await supabase
    .storage.from(STORAGE_BUCKET)
    .list('', { limit: 1000 })

  if (error) throw new Error(`Storage list: ${error.message}`)

  const map = {}
  for (const f of files ?? []) {
    if (!f.name || !f.name.includes('.')) continue // skip folders/placeholders
    const stem = f.name.replace(/\.[^.]+$/, '')
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(f.name)
    map[slugify(stem)] = data.publicUrl
  }
  return map
}

async function syncSheets(setPhase, setResult) {
  if (!SHEET_ID || !SHEETS_KEY) {
    setPhase('error')
    setResult('VITE_SHEET_ID or VITE_SHEETS_API_KEY is not set in .env')
    return
  }

  setPhase('fetching')
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}` +
    `/values/A:M?key=${SHEETS_KEY}`

  let rows
  try {
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
    }
    const json = await res.json()
    rows = json.values ?? []
  } catch (err) {
    setPhase('error')
    setResult(`Sheets API: ${err.message}`)
    return
  }

  if (rows.length < 2) {
    setPhase('error')
    setResult('Sheet returned no data rows.')
    return
  }

  const headers  = rows[0]
  const dataRows = rows.slice(1).filter(r => r[0]?.trim())
  const trails   = dataRows.map(r => rowToTrail(headers, r)).filter(t => t.route_name)

  // Derive photo_url for each trail from the Storage bucket.
  setPhase('photos')
  let matched = 0
  try {
    const photoMap = await buildPhotoMap()
    for (const t of trails) {
      const url = photoMap[slugify(t.route_name)] ?? null
      t.photo_url = url
      if (url) matched++
    }
  } catch (err) {
    setPhase('error')
    setResult(err.message)
    return
  }

  setPhase('upserting')

  const { error } = await supabase
    .from('trails')
    .upsert(trails, { onConflict: 'route_name' })

  if (error) {
    setPhase('error')
    setResult(`Supabase: ${error.message}`)
    return
  }

  // Prune trails that are no longer in the sheet. Trails with logged
  // completions are kept (the completions FK blocks their deletion) and
  // reported back so removed-but-completed trails don't vanish silently.
  setPhase('pruning')
  let removed = 0
  let keptCompleted = 0
  try {
    const keepNames = new Set(trails.map(t => t.route_name))

    const { data: existing, error: exErr } = await supabase
      .from('trails').select('id, route_name')
    if (exErr) throw new Error(`Prune (list): ${exErr.message}`)

    const orphanIds = (existing ?? [])
      .filter(t => !keepNames.has(t.route_name))
      .map(t => t.id)

    if (orphanIds.length) {
      const { data: comps, error: cErr } = await supabase
        .from('completions').select('trail_id').in('trail_id', orphanIds)
      if (cErr) throw new Error(`Prune (completions): ${cErr.message}`)

      const completedIds = new Set((comps ?? []).map(c => c.trail_id))
      const deletable = orphanIds.filter(id => !completedIds.has(id))
      keptCompleted = orphanIds.length - deletable.length

      if (deletable.length) {
        const { error: dErr } = await supabase
          .from('trails').delete().in('id', deletable)
        if (dErr) throw new Error(`Prune (delete): ${dErr.message}`)
        removed = deletable.length
      }
    }
  } catch (err) {
    setPhase('error')
    setResult(err.message)
    return
  }

  setPhase('done')
  setResult({ trails: trails.length, photos: matched, removed, keptCompleted })
}

export default function AdminSync() {
  // HashRouter keeps the query string after the "#", so read it via the
  // router rather than window.location.search. URL: /#/admin?admin=<token>
  const [searchParams] = useSearchParams()
  const isAdmin = ADMIN_TOKEN && searchParams.get('admin') === ADMIN_TOKEN

  const [phase,  setPhase]  = useState('idle')   // idle | fetching | photos | upserting | pruning | done | error
  const [result, setResult] = useState(null)

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-charcoal text-warm-white font-body flex items-center justify-center">
        <p className="font-mono text-trail-amber text-sm">403 — access denied</p>
      </main>
    )
  }

  const busy = phase === 'fetching' || phase === 'photos' ||
               phase === 'upserting' || phase === 'pruning'

  const phaseLabel = {
    idle:      'Sync from Google Sheets',
    fetching:  'Fetching sheet…',
    photos:    'Matching photos…',
    upserting: 'Upserting to Supabase…',
    pruning:   'Removing deleted trails…',
    done:      'Sync from Google Sheets',
    error:     'Sync from Google Sheets',
  }[phase]

  return (
    <main className="min-h-screen bg-charcoal text-warm-white font-body p-10 max-w-2xl mx-auto">
      <h1 className="font-heading text-4xl mb-1">Admin Sync</h1>
      <p className="text-warm-white/40 text-sm mb-10 font-mono">
        /admin?admin=***
      </p>

      <div className="border border-warm-white/10 rounded p-6 space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-mono text-warm-white/40 uppercase tracking-widest">Source</p>
          <p className="text-sm">Google Sheets → Supabase <span className="font-mono text-trail-amber">trails</span></p>
          <p className="text-xs text-warm-white/30 font-mono">Sheet ID: {SHEET_ID}</p>
        </div>

        <button
          onClick={() => syncSheets(setPhase, setResult)}
          disabled={busy}
          className="w-full py-3 bg-trail-amber text-charcoal font-heading text-lg rounded
                     hover:brightness-110 disabled:opacity-40 transition-all"
        >
          {phaseLabel}
        </button>

        {phase === 'done' && (
          <div className="font-mono text-sm text-trail-amber space-y-1">
            <p>
              ✓ {result.trails} trail{result.trails !== 1 ? 's' : ''} upserted ·{' '}
              {result.photos} with photo{result.photos !== 1 ? 's' : ''}.
            </p>
            {result.removed > 0 && (
              <p>– {result.removed} removed (no longer in sheet).</p>
            )}
            {result.keptCompleted > 0 && (
              <p className="text-warm-white/40">
                {result.keptCompleted} not removed — already completed by someone.
              </p>
            )}
          </div>
        )}

        {phase === 'error' && (
          <p className="font-mono text-sm text-red-400">✗ {result}</p>
        )}
      </div>
    </main>
  )
}
