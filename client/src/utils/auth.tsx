import { useState, useEffect } from 'react'

export function useAuth() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'))

  useEffect(()=> {
    const handler = () => setToken(localStorage.getItem('auth_token'))
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  },[])

  return {
    token,
    login: (t: string) => { localStorage.setItem('auth_token', t); setToken(t) },
    logout: () => { localStorage.removeItem('auth_token'); setToken(null) }
  }
}
