import { Link, useLocation } from 'react-router-dom'
import { useUser } from '../context/UserContext'

function NavLink({ to, label, dark, active }) {
  return (
    <Link
      to={to}
      className={`font-mono text-xs transition-colors
        ${active
          ? 'text-trail-amber'
          : dark
            ? 'text-warm-white/55 hover:text-warm-white'
            : 'text-charcoal/55 hover:text-charcoal'
        }`}
    >
      {label}
    </Link>
  )
}

export default function NavBar() {
  const { user } = useUser()
  const { pathname } = useLocation()

  const dark = pathname.startsWith('/trail/') || pathname === '/leaderboard'

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 h-14 flex items-center justify-between px-6
      ${dark
        ? 'bg-charcoal border-b border-warm-white/10'
        : 'bg-parchment border-b border-charcoal/15'
      }`}
    >
      <Link
        to="/"
        className={`font-heading text-sm leading-none
          ${dark ? 'text-warm-white' : 'text-charcoal'}`}
      >
        Senderos
      </Link>

      <div className="flex items-center gap-6">
        <NavLink to="/"           label="Rutas"      dark={dark} active={pathname === '/'} />
        <NavLink to="/leaderboard" label="Expedición" dark={dark} active={pathname === '/leaderboard'} />
        {user && (
          <span className={`font-mono text-xs
            ${dark ? 'text-warm-white/40' : 'text-charcoal/40'}`}>
            {user.name}
          </span>
        )}
      </div>
    </nav>
  )
}
