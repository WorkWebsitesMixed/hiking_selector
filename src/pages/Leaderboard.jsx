import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from '../context/UserContext'

// ── Data helpers ─────────────────────────────────────────────────────
function buildRankings(completions) {
  const map = new Map()

  for (const c of completions) {
    const uid = c.user_id
    if (!map.has(uid)) {
      map.set(uid, {
        userId:           uid,
        name:             c.users?.name ?? '—',
        count:            0,
        totalElevation:   0,
        totalDistance:    0,
        hardestScore:     0,
        hardestTrailName: null,
        lastDate:         null,
      })
    }

    const e = map.get(uid)
    e.count++
    e.totalElevation += c.elevation_gain_snapshot ?? 0
    e.totalDistance  += c.distance_km_snapshot    ?? 0

    if ((c.difficulty_snapshot ?? 0) > e.hardestScore) {
      e.hardestScore     = c.difficulty_snapshot
      e.hardestTrailName = c.trails?.route_name ?? null
    }

    if (!e.lastDate || c.completed_date > e.lastDate) {
      e.lastDate = c.completed_date
    }
  }

  return [...map.values()].sort(
    (a, b) => b.count - a.count || b.totalElevation - a.totalElevation
  )
}

function formatDate(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

function fmtElev(m)  { return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m` }
function fmtDist(km) { return `${Number.isInteger(km) ? km : km.toFixed(1)} km` }

// ── Sub-components ───────────────────────────────────────────────────
function RankNumber({ n }) {
  if (n === 1) return (
    <span className="font-mono text-2xl font-bold text-trail-amber w-8 shrink-0 leading-none">1</span>
  )
  if (n <= 3) return (
    <span className="font-mono text-2xl text-warm-white/40 w-8 shrink-0 leading-none">{n}</span>
  )
  return (
    <span className="font-mono text-base text-warm-white/25 w-8 shrink-0 leading-none pt-0.5">{n}</span>
  )
}

function DifficultyPips({ score }) {
  if (!score) return null
  return (
    <span className="font-mono text-xs" aria-label={`Difficulty ${score} of 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= score ? 'text-trail-amber' : 'text-warm-white/15'}>●</span>
      ))}
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────
export default function Leaderboard() {
  const { user, loading: userLoading } = useUser()

  const [completions, setCompletions] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase
        .from('completions')
        .select('user_id, users(name), elevation_gain_snapshot, distance_km_snapshot, difficulty_snapshot, completed_date, trails(route_name)')
        .order('completed_date', { ascending: false })

      if (err) {
        setError(err.message)
      } else {
        setCompletions(data ?? [])
      }
      setLoading(false)
    }

    load()
  }, [])

  const rankings = buildRankings(completions)

  const totals = {
    logged:    completions.length,
    elevation: completions.reduce((s, c) => s + (c.elevation_gain_snapshot ?? 0), 0),
    distance:  completions.reduce((s, c) => s + (c.distance_km_snapshot    ?? 0), 0),
  }

  // ── States ────────────────────────────────────────────────────────
  if (loading || userLoading) {
    return (
      <main className="min-h-screen bg-charcoal pt-14 flex items-center justify-center">
        <p className="font-mono text-sm text-warm-white/30">Cargando…</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-charcoal pt-14 flex items-center justify-center">
        <p className="font-mono text-sm text-red-400">{error}</p>
      </main>
    )
  }

  // ── Page ──────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-charcoal text-warm-white font-body pt-14">
      <div className="max-w-[90vw] mx-auto px-6 pt-8 pb-16">

        {/* Header */}
        <h1 className="font-heading text-5xl mb-2">Expedición</h1>
        <p className="font-mono text-xs text-warm-white/35 mb-2">
          Cuadro de honor del grupo
        </p>

        {/* Group totals */}
        {completions.length > 0 && (
          <div className="flex gap-6 font-mono text-xs text-warm-white/45 mb-10 flex-wrap">
            <span>{totals.logged} registros</span>
            <span className="text-warm-white/20">·</span>
            <span>{fmtDist(totals.distance)} en total</span>
            <span className="text-warm-white/20">·</span>
            <span>+{totals.elevation.toLocaleString()} m acumulados</span>
          </div>
        )}

        {/* Rankings */}
        {rankings.length === 0 ? (
          <p className="font-mono text-sm text-warm-white/30 mt-8">
            Ninguna ruta registrada todavía.
          </p>
        ) : (
          <div className="divide-y divide-warm-white/8 max-w-2xl">
            {rankings.map((r, i) => {
              const isMe = user?.id === r.userId
              return (
                <div
                  key={r.userId}
                  className={`flex gap-5 py-5 items-start transition-colors
                    ${isMe ? 'bg-trail-amber/5 -mx-4 px-4 rounded' : ''}`}
                >
                  <RankNumber n={i + 1} />

                  <div className="flex-1 min-w-0">
                    {/* Name row */}
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className={`font-semibold text-base leading-none
                        ${i === 0 ? 'text-trail-amber' : 'text-warm-white'}`}>
                        {r.name}
                      </span>
                      {isMe && (
                        <span className="font-mono text-[10px] text-trail-amber/70 uppercase tracking-widest">
                          tú
                        </span>
                      )}
                    </div>

                    {/* Primary stats */}
                    <div className="flex items-center gap-4 font-mono text-xs text-warm-white/55 flex-wrap mb-1.5">
                      <span className={i === 0 ? 'text-trail-amber/80' : ''}>
                        {r.count} {r.count === 1 ? 'ruta' : 'rutas'}
                      </span>
                      {r.totalDistance > 0 && (
                        <span>{fmtDist(r.totalDistance)}</span>
                      )}
                      {r.totalElevation > 0 && (
                        <span>+{r.totalElevation.toLocaleString()} m</span>
                      )}
                      {r.lastDate && (
                        <span className="text-warm-white/30">
                          {formatDate(r.lastDate)}
                        </span>
                      )}
                    </div>

                    {/* Hardest trail */}
                    {r.hardestTrailName && (
                      <div className="flex items-center gap-2">
                        <DifficultyPips score={r.hardestScore} />
                        <span className="font-mono text-[11px] text-warm-white/30 truncate">
                          {r.hardestTrailName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </main>
  )
}
