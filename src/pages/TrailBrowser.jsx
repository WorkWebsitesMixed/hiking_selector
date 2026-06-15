import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUser } from '../context/UserContext'

function regionGroup(r)   { return r?.split(' (')[0] ?? '' }
function categoryPrimary(c) { return c?.split(' / ')[0] ?? '' }

function DifficultyPips({ score }) {
  return (
    <span aria-label={`Difficulty ${score} of 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= score ? 'text-trail-amber' : 'text-charcoal/20'}>●</span>
      ))}
    </span>
  )
}

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors whitespace-nowrap
        ${active
          ? 'bg-trail-amber text-charcoal border-trail-amber'
          : 'border-charcoal/25 text-charcoal/60 hover:border-charcoal/50 hover:text-charcoal'
        }`}
    >
      {label}
    </button>
  )
}

function TrailCard({ trail, done }) {
  const [imgError, setImgError] = useState(false)
  const showPhoto = Boolean(trail.photo_url) && !imgError

  return (
    <Link
      to={`/trail/${trail.id}`}
      className={`group flex flex-col rounded-sm border border-charcoal/10
                 bg-white/40 hover:bg-white/60 overflow-hidden transition-all
                 ${!showPhoto ? 'border-l-4 border-l-trail-amber/40 hover:border-l-trail-amber' : ''}`}
    >
      {/* Top zone: photo or charcoal fallback */}
      <div className="relative h-40 shrink-0 bg-charcoal">
        {showPhoto ? (
          <img
            src={trail.photo_url}
            alt={trail.route_name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center px-4">
            {trail.category && (
              <span className="font-heading text-lg text-warm-white/30 text-center">
                {categoryPrimary(trail.category)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative flex flex-col gap-2 pl-4 pr-4 pt-4 pb-3">
        {done && (
          <span className="absolute top-3 right-3 font-mono text-[10px] tracking-widest text-trail-amber uppercase">
            done
          </span>
        )}

        <div className="pr-8">
          <h2 className="font-heading text-lg font-semibold leading-snug group-hover:text-trail-amber transition-colors">
            {trail.route_name}
          </h2>
          <p className="text-xs text-charcoal/40 mt-0.5">{trail.region}</p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-charcoal/65 flex-wrap">
          <DifficultyPips score={trail.difficulty_score} />
          <span className="text-charcoal/20">·</span>
          {trail.distance_km && (
            <span className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 6 C2.5 3, 4.5 9, 6 6 C7.5 3, 9.5 9, 11 6"/>
              </svg>
              {trail.distance_km} km
            </span>
          )}
          {trail.duration_hours && (
            <span className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="6" cy="6" r="4.5"/>
                <path d="M6 3.5V6l1.5 1.5"/>
              </svg>
              {trail.duration_hours}
            </span>
          )}
          {trail.elevation_gain_m && (
            <span className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 2L10.5 10H1.5L6 2Z"/>
              </svg>
              +{trail.elevation_gain_m}m
            </span>
          )}
        </div>

        {trail.category && (
          <span className="self-start px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider
                           bg-trail-amber/10 text-trail-amber/80">
            {trail.category}
          </span>
        )}
      </div>
    </Link>
  )
}

function FilterRow({ label, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs font-mono text-charcoal/30 uppercase tracking-widest pt-1 w-16 shrink-0">
        {label}
      </span>
      <div className="flex gap-1.5 flex-wrap">
        {children}
      </div>
    </div>
  )
}

export default function TrailBrowser() {
  const { user, loading: userLoading, error: userError } = useUser()

  const [trails,     setTrails]     = useState([])
  const [completed,  setCompleted]  = useState(new Set())
  const [loading,    setLoading]    = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const [search,     setSearch]     = useState('')
  const [region,     setRegion]     = useState(null)
  const [difficulty, setDifficulty] = useState(null)
  const [category,   setCategory]   = useState(null)

  useEffect(() => {
    if (userLoading) return

    async function load() {
      const promises = [
        supabase.from('trails').select('*').order('route_name'),
      ]
      if (user) {
        promises.push(
          supabase.from('completions').select('trail_id').eq('user_id', user.id)
        )
      }

      const [trailsRes, completionsRes] = await Promise.all(promises)

      if (trailsRes.error) {
        setFetchError(trailsRes.error.message)
      } else {
        setTrails(trailsRes.data)
      }

      if (completionsRes && !completionsRes.error) {
        setCompleted(new Set(completionsRes.data.map(c => c.trail_id)))
      }

      setLoading(false)
    }

    load()
  }, [userLoading, user])

  const regions    = useMemo(() =>
    [...new Set(trails.map(t => regionGroup(t.region)).filter(Boolean))].sort(),
    [trails]
  )
  const categories = useMemo(() =>
    [...new Set(trails.map(t => categoryPrimary(t.category)).filter(Boolean))].sort(),
    [trails]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return trails.filter(t => {
      if (q && !t.route_name.toLowerCase().includes(q)) return false
      if (region     && !t.region?.startsWith(region))       return false
      if (difficulty && t.difficulty_score !== difficulty)   return false
      if (category   && !t.category?.startsWith(category))  return false
      return true
    })
  }, [trails, search, region, difficulty, category])

  const hasFilters = search || region || difficulty || category

  // ── states ──────────────────────────────────────────────────────────
  if (userLoading || loading) {
    return (
      <main className="min-h-screen bg-parchment text-charcoal font-body pt-14 flex items-center justify-center">
        <p className="font-mono text-sm text-charcoal/40">Loading trails…</p>
      </main>
    )
  }

  if (userError || fetchError) {
    return (
      <main className="min-h-screen bg-parchment text-charcoal font-body pt-14 flex items-center justify-center">
        <p className="font-mono text-sm text-red-700">{userError ?? fetchError}</p>
      </main>
    )
  }

  // ── page ──────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-parchment text-charcoal font-body pt-14">
      {/* Header */}
      <header className="px-6 pt-10 pb-6 max-w-[90vw] mx-auto border-b border-charcoal/10">
        <h1 className="font-heading text-5xl mb-1">Rutas de Antioquia</h1>
        <p className="font-mono text-xs text-charcoal/40">
          {user
            ? <>{trails.length} trails · <span className="text-trail-amber">{user.name}</span> · {completed.size} completed</>
            : <>{trails.length} trails · visit with ?token=xxxx to track completions</>
          }
        </p>
      </header>

      {/* Filters */}
      <section className="px-6 max-w-[90vw] mx-auto space-y-3 mb-8">
        {/* Search */}
        <input
          type="search"
          placeholder="Search trails…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 rounded border border-charcoal/15
                     bg-white/50 font-mono text-sm placeholder:text-charcoal/30
                     focus:outline-none focus:border-trail-amber"
        />

        <FilterRow label="Region">
          <Chip label="All"    active={!region}   onClick={() => setRegion(null)} />
          {regions.map(r => (
            <Chip key={r} label={r} active={region === r} onClick={() => setRegion(r === region ? null : r)} />
          ))}
        </FilterRow>

        <FilterRow label="Grade">
          <Chip label="All"   active={!difficulty}   onClick={() => setDifficulty(null)} />
          {[1, 2, 3, 4, 5].map(n => (
            <Chip
              key={n}
              label={'●'.repeat(n) + '○'.repeat(5 - n)}
              active={difficulty === n}
              onClick={() => setDifficulty(difficulty === n ? null : n)}
            />
          ))}
        </FilterRow>

        <FilterRow label="Type">
          <Chip label="All"    active={!category}   onClick={() => setCategory(null)} />
          {categories.map(c => (
            <Chip key={c} label={c} active={category === c} onClick={() => setCategory(c === category ? null : c)} />
          ))}
        </FilterRow>
      </section>

      {/* Results */}
      <section className="px-6 max-w-[90vw] mx-auto pb-16">
        <p className="font-mono text-xs text-charcoal/30 mb-4">
          {filtered.length} trail{filtered.length !== 1 ? 's' : ''}
          {hasFilters ? ' matching filters' : ''}
        </p>

        {filtered.length === 0 ? (
          <p className="font-mono text-sm text-charcoal/40">No trails match — try clearing a filter.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(trail => (
              <TrailCard
                key={trail.id}
                trail={trail}
                done={completed.has(trail.id)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
