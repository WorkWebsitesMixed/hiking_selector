import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUser } from '../context/UserContext'

// ── Icons (same stroke style as TrailBrowser) ────────────────────────
const IconRoute = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 6 C2.5 3, 4.5 9, 6 6 C7.5 3, 9.5 9, 11 6"/>
  </svg>
)
const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="6" r="4.5"/>
    <path d="M6 3.5V6l1.5 1.5"/>
  </svg>
)
const IconAltitude = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 10V2M3 5l3-3 3 3"/>
  </svg>
)
const IconElevation = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2L10.5 10H1.5L6 2Z"/>
  </svg>
)

// ── Helpers ──────────────────────────────────────────────────────────
function DifficultyPips({ score }) {
  return (
    <span aria-label={`Difficulty ${score} of 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= score ? 'text-trail-amber' : 'text-warm-white/20'}>●</span>
      ))}
    </span>
  )
}

function formatDate(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

const today = new Date().toISOString().split('T')[0]

// ── Component ────────────────────────────────────────────────────────
export default function TrailDetail() {
  const { id }                         = useParams()
  const { user, loading: userLoading } = useUser()

  const [trail,       setTrail]       = useState(null)
  const [completions, setCompletions] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  const [showForm,    setShowForm]    = useState(false)
  const [formDate,    setFormDate]    = useState(today)
  const [formComment, setFormComment] = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [formError,   setFormError]   = useState(null)

  useEffect(() => {
    if (userLoading) return

    async function load() {
      const [trailRes, completionsRes] = await Promise.all([
        supabase.from('trails').select('*').eq('id', id).single(),
        supabase
          .from('completions')
          .select('*, users(name)')
          .eq('trail_id', id)
          .order('completed_date', { ascending: false }),
      ])

      if (trailRes.error) {
        setError(trailRes.error.message)
      } else {
        setTrail(trailRes.data)
      }

      if (!completionsRes.error) {
        setCompletions(completionsRes.data ?? [])
      }

      setLoading(false)
    }

    load()
  }, [id, userLoading])

  const myCompletion = user
    ? completions.find(c => c.user_id === user.id) ?? null
    : null

  function openForm() {
    setFormDate(myCompletion?.completed_date ?? today)
    setFormComment(myCompletion?.comment ?? '')
    setFormError(null)
    setShowForm(v => !v)
  }

  async function handleSubmit() {
    setSubmitting(true)
    setFormError(null)

    const { data, error: upsertError } = await supabase
      .from('completions')
      .upsert(
        {
          user_id:                 user.id,
          trail_id:                trail.id,
          completed_date:          formDate,
          comment:                 formComment.trim() || null,
          elevation_gain_snapshot: trail.elevation_gain_m,
          distance_km_snapshot:    trail.distance_km,
          difficulty_snapshot:     trail.difficulty_score,
        },
        { onConflict: 'user_id,trail_id' }
      )
      .select('*, users(name)')
      .single()

    if (upsertError) {
      setFormError(upsertError.message)
      setSubmitting(false)
      return
    }

    setCompletions(prev => {
      const idx = prev.findIndex(c => c.user_id === user.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = data
        return next
      }
      return [data, ...prev]
    })

    setShowForm(false)
    setSubmitting(false)
  }

  // ── Loading / error ───────────────────────────────────────────────
  if (loading || userLoading) {
    return (
      <main className="min-h-screen bg-charcoal pt-14 flex items-center justify-center">
        <p className="font-mono text-sm text-warm-white/30">Cargando…</p>
      </main>
    )
  }

  if (error || !trail) {
    return (
      <main className="min-h-screen bg-charcoal pt-14 flex items-center justify-center">
        <p className="font-mono text-sm text-red-400">{error ?? 'Ruta no encontrada.'}</p>
      </main>
    )
  }

  // ── Page ─────────────────────────────────────────────────────────
  return (
    <div className="font-body">

      {/* ══ HERO ══════════════════════════════════════════════════ */}
      <section
        className="bg-charcoal text-warm-white pt-14 bg-cover bg-center"
        style={trail.photo_url ? {
          backgroundImage: `linear-gradient(to bottom, rgba(28,28,26,0.85), rgba(28,28,26,0.95)), url('${trail.photo_url}')`,
        } : undefined}
      >
        <div className="max-w-[90vw] mx-auto px-6 pt-8 pb-12">

          {/* Trail name */}
          <h1 className="font-heading text-4xl sm:text-5xl leading-tight mb-3">
            {trail.route_name}
          </h1>

          {/* Region · Category */}
          <p className="font-mono text-xs text-warm-white/40 mb-7 tracking-wide">
            {[trail.region, trail.category].filter(Boolean).join('  ·  ')}
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-5 font-mono text-sm text-warm-white/65 flex-wrap mb-9">
            {trail.difficulty_score && <DifficultyPips score={trail.difficulty_score} />}
            {trail.distance_km && (
              <span className="flex items-center gap-1.5">
                <IconRoute />{trail.distance_km} km
              </span>
            )}
            {trail.duration_hours && (
              <span className="flex items-center gap-1.5">
                <IconClock />{trail.duration_hours}
              </span>
            )}
            {trail.max_altitude_m && (
              <span className="flex items-center gap-1.5">
                <IconAltitude />{trail.max_altitude_m.toLocaleString()} m
              </span>
            )}
            {trail.elevation_gain_m && (
              <span className="flex items-center gap-1.5">
                <IconElevation />+{trail.elevation_gain_m} m
              </span>
            )}
          </div>

          {/* Body text */}
          <div className="max-w-2xl space-y-4 mb-9">
            {trail.terrain_info && (
              <p className="text-sm text-warm-white/55 leading-relaxed">
                <span className="font-mono text-[10px] uppercase tracking-widest
                                 text-warm-white/25 mr-2">
                  Terreno
                </span>
                {trail.terrain_info}
              </p>
            )}
            {trail.description && (
              <p className="text-base text-warm-white/80 leading-relaxed">
                {trail.description}
              </p>
            )}
          </div>

          {/* External links */}
          {(trail.youtube_link || trail.photo_link) && (
            <div className="flex gap-3 flex-wrap mb-10">
              {trail.youtube_link && (
                <a href={trail.youtube_link} target="_blank" rel="noopener noreferrer"
                   className="px-4 py-2 border border-trail-amber/45 text-trail-amber
                              font-mono text-xs rounded-sm
                              hover:border-trail-amber hover:bg-trail-amber/5 transition-colors">
                  ▶ YouTube
                </a>
              )}
              {trail.photo_link && (
                <a href={trail.photo_link} target="_blank" rel="noopener noreferrer"
                   className="px-4 py-2 border border-trail-amber/45 text-trail-amber
                              font-mono text-xs rounded-sm
                              hover:border-trail-amber hover:bg-trail-amber/5 transition-colors">
                  ◎ Fotos
                </a>
              )}
            </div>
          )}

          {/* "You did this" stamp */}
          {myCompletion && (
            <div className="inline-block border-2 border-dashed border-trail-amber/45
                            rounded px-5 py-4 bg-trail-amber/5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-trail-amber mb-1.5">
                ✓ completada
              </p>
              <p className="font-mono text-sm text-trail-amber">
                {formatDate(myCompletion.completed_date)}
              </p>
              {myCompletion.comment && (
                <p className="text-sm text-warm-white/45 italic mt-2">
                  "{myCompletion.comment}"
                </p>
              )}
            </div>
          )}

        </div>
      </section>

      {/* ══ LOGBOOK ═══════════════════════════════════════════════ */}
      <section className="bg-parchment text-charcoal">
        <div className="max-w-[90vw] mx-auto px-6 py-10">

          <h2 className="font-heading text-3xl mb-7">Registro del grupo</h2>

          {/* Entries */}
          {completions.length === 0 ? (
            <p className="font-mono text-sm text-charcoal/40 mb-8">
              Nadie ha registrado esta ruta todavía.
            </p>
          ) : (
            <div className="divide-y divide-charcoal/10 mb-8 max-w-xl">
              {completions.map(c => (
                <div key={c.id} className="py-3.5">
                  <div className="flex items-baseline gap-3">
                    <span className="font-semibold text-sm text-charcoal">
                      {c.users?.name}
                    </span>
                    <span className="font-mono text-xs text-charcoal/45">
                      {formatDate(c.completed_date)}
                    </span>
                  </div>
                  {c.comment && (
                    <p className="text-sm text-charcoal/50 italic mt-0.5">
                      "{c.comment}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* CTA / form */}
          {!user ? (
            <p className="font-mono text-xs text-charcoal/40">
              Abre tu enlace personal para registrar rutas.
            </p>
          ) : (
            <div className="max-w-md">
              <button
                onClick={openForm}
                className="px-5 py-2.5 bg-trail-amber text-charcoal font-mono text-sm
                           rounded-sm hover:brightness-105 transition-all"
              >
                {showForm
                  ? 'Cancelar'
                  : myCompletion
                    ? 'Editar registro'
                    : 'Marcar como completada'}
              </button>

              {showForm && (
                <div className="mt-4 border border-charcoal/10 rounded p-5 space-y-4 bg-white/30">

                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest
                                      text-charcoal/40 mb-1.5">
                      Fecha
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      max={today}
                      onChange={e => setFormDate(e.target.value)}
                      className="font-mono text-sm border border-charcoal/15 rounded-sm
                                 px-3 py-1.5 bg-white/70
                                 focus:outline-none focus:border-trail-amber"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest
                                      text-charcoal/40 mb-1.5">
                      Comentario{' '}
                      <span className="normal-case text-charcoal/30">(opcional)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={formComment}
                      onChange={e => setFormComment(e.target.value)}
                      placeholder="¿Cómo estuvo la ruta?"
                      className="w-full text-sm border border-charcoal/15 rounded-sm
                                 px-3 py-2 bg-white/70 resize-none
                                 placeholder:text-charcoal/25
                                 focus:outline-none focus:border-trail-amber"
                    />
                  </div>

                  {formError && (
                    <p className="font-mono text-xs text-red-600">{formError}</p>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !formDate}
                    className="px-5 py-2 bg-trail-amber text-charcoal font-mono text-sm
                               rounded-sm hover:brightness-105 disabled:opacity-40 transition-all"
                  >
                    {submitting
                      ? 'Guardando…'
                      : myCompletion ? 'Actualizar' : 'Registrar'}
                  </button>

                </div>
              )}
            </div>
          )}

        </div>
      </section>

    </div>
  )
}
