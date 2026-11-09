import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { api, type Account } from './api'

export interface Grant { permission: string; scope: string }
export type PasswordNotice = 'changed' | 'uncertain'
interface Auth { account: Account | null; grants: Grant[]; expired: boolean; passwordNotice?: PasswordNotice; login: (name: string, password: string) => Promise<void>; logout: (notice?: PasswordNotice) => void }
export const AuthContext = createContext<Auth | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [expired, setExpired] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState<PasswordNotice>()
  useEffect(() => {
    api.onUnauthorized = () => { setAccount(null); setExpired(true) }
    return () => { api.onUnauthorized = undefined; api.clear() }
  }, [])
  return <AuthContext.Provider value={{ account, grants: [], expired, passwordNotice,
    login: async (name, password) => { const result = await api.login(name, password); setAccount(result); setExpired(false); setPasswordNotice(undefined) },
    logout: notice => { api.clear(); setAccount(null); setExpired(false); setPasswordNotice(notice) },
  }}>{children}</AuthContext.Provider>
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider ausente'); return value }
export function hasGrant(grants: Grant[], permission: string, scope: string) {
  return grants.some(grant => grant.permission === permission && grant.scope === scope)
}
export function LoginRedirect() {
  const { pathname } = useLocation()
  // Guarda somente o caminho interno; query, fragmento e credenciais não são copiados.
  return <Navigate to="/entrar" state={{ returnTo: pathname }} replace />
}
export function loginDestination(state: unknown): string {
  const path = typeof state === 'object' && state !== null && 'returnTo' in state ? state.returnTo : null
  // Aceita só caminhos internos, sem retornar às rotas de entrada e saída.
  return typeof path === 'string' && path.trim() === path && /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]*$/.test(path)
    && !/^\/(?:entrar|sair)\/?$/i.test(path) ? path : '/'
}
export function Guard({ permission, scope }: { permission?: string; scope?: string }) {
  const { account, grants } = useAuth()
  if (!account) return <LoginRedirect />
  if (permission && (!scope || !hasGrant(grants, permission, scope))) return <>
    <p role="alert">Acesso indisponível para esta permissão e escopo.</p>
    <Link to="/">Voltar ao início</Link>
  </>
  return <Outlet />
}
