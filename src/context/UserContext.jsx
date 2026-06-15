import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const UserContext = createContext(null)

const STORAGE_KEY = 'hiking_user'

export function UserProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    async function resolveUser() {
      // 1. Token in URL takes precedence — validate it against Supabase
      const params   = new URLSearchParams(window.location.search)
      const urlToken = params.get('token')

      if (urlToken) {
        const { data, error: dbError } = await supabase
          .from('users')
          .select('*')
          .eq('token', urlToken)
          .single()

        if (dbError || !data) {
          setError('Token not recognised. Ask for a fresh link.')
          setLoading(false)
          return
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        setUser(data)

        // Strip the token from the URL so it isn't shared by accident
        params.delete('token')
        const search = params.toString()
        window.history.replaceState(
          {},
          '',
          window.location.pathname + (search ? `?${search}` : '')
        )

        setLoading(false)
        return
      }

      // 2. Fall back to localStorage for return visits
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          setUser(JSON.parse(stored))
        } catch {
          // Corrupted entry — treat as logged out
          localStorage.removeItem(STORAGE_KEY)
        }
      }

      setLoading(false)
    }

    resolveUser()
  }, [])

  return (
    <UserContext.Provider value={{ user, loading, error }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (ctx === null) {
    throw new Error('useUser must be called inside <UserProvider>')
  }
  return ctx
}
