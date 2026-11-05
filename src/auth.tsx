import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { api, type Account } from './api'

export interface Grant { permission: string; scope: string }
interface Auth { account: Account | null; grants: Grant[]; expired: boolean; login: (name: string, password: string) => Promise<void>; logout: () => void }
export const AuthContext = createContext<Auth | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [expired, setExpired] = useState(false)
  useEffect(() => {
    api.onUnauthorized = () => { setAccount(null); setExpired(true) }
    return () => { api.onUnauthorized = undefined; api.clear() }
  }, [])
  return <AuthContext.Provider value={{ account, grants: [], expired,
    login: async (name, password) => { const result = await api.login(name, password); setAccount(result); setExpired(false) },
    logout: () => { api.clear(); setAccount(null); setExpired(false) },
  }}>{children}</AuthContext.Provider>
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider ausente'); return value }
export function hasGrant(grants: Grant[], permission: string, scope: string) {
  return grants.some(grant => grant.permission === permission && grant.scope === scope)
}
export function Guard({ permission, scope }: { permission?: string; scope?: string }) {
  const { account, grants } = useAuth()
  if (!account) return <Navigate to="/entrar" replace />
  if (permission && (!scope || !hasGrant(grants, permission, scope))) return <p role="alert">Acesso indisponível para esta permissão e escopo.</p>
  return <Outlet />
}
