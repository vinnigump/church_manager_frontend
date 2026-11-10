import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, type Account, type ApiClient } from './api'
import { LoginRedirect, useAuth } from './auth'

// docs/api/self-authorization-v1.openapi.json 1.0.0 do backend.
export interface AuthorizationQuery {
  permissionCode: string
  resourceType: 'CHURCH' | 'DENOMINATION'
  resourceId: string
}
export async function consultAuthorization(query: AuthorizationQuery, signal?: AbortSignal, client: ApiClient = api): Promise<boolean> {
  const params = new URLSearchParams({ ...query })
  const decision = await client.request<unknown>(`/accounts/me/authorization?${params}`, { signal })
  if (typeof decision !== 'object' || decision === null || !('allowed' in decision) || typeof decision.allowed !== 'boolean' || Object.keys(decision).length !== 1) {
    throw new Error('Não foi possível confirmar a permissão.')
  }
  return decision.allowed
}

type Decision = 'allowed' | 'denied' | 'error'
interface CheckedDecision { account: Account; key: string; attempt: number; decision: Decision }

// Guarda de UX. Cada operação do backend deve autorizar novamente o recurso real.
// Não substitui descoberta de contextos nem concede acesso por vínculo familiar.
export function ResourceAccess({ permissionCode, resourceType, resourceId, children, optional = false, fallback = null, preserveDuringRecheck = false }: AuthorizationQuery & { children: ReactNode; optional?: boolean; fallback?: ReactNode; preserveDuringRecheck?: boolean }) {
  const { account } = useAuth()
  const [checked, setChecked] = useState<CheckedDecision | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify([permissionCode, resourceType, resourceId])
  useEffect(() => {
    const recheck = () => setAttempt(value => value + 1)
    window.addEventListener('focus', recheck)
    return () => window.removeEventListener('focus', recheck)
  }, [])
  useEffect(() => {
    if (!account) return
    const controller = new AbortController()
    let active = true
    consultAuthorization({ permissionCode, resourceType, resourceId }, controller.signal)
      .then(allowed => { if (active) setChecked({ account, key, attempt, decision: allowed ? 'allowed' : 'denied' }) })
      .catch(() => { if (active) setChecked({ account, key, attempt, decision: 'error' }) })
    return () => { active = false; controller.abort() }
  }, [account, permissionCode, resourceType, resourceId, key, attempt])

  if (!account) return <LoginRedirect />
  // Comparação durante o render evita um quadro com concessão do contexto anterior.
  if (!checked || checked.account !== account || checked.key !== key || checked.attempt !== attempt) {
    // Keep the draft and submission lock only for the same previously allowed
    // session/resource. Hidden content cannot be read or operated while checking.
    if (preserveDuringRecheck && checked?.account === account && checked.key === key && checked.decision === 'allowed') {
      return <><div hidden inert>{children}</div><p role="status" aria-busy="true">Verificando permissão…</p></>
    }
    if (optional) return <>{fallback}</>
    return <p role="status" aria-busy="true">Verificando permissão…</p>
  }
  if (checked.decision === 'error') return optional ? <>{fallback}</> : <><p role="alert">Não foi possível confirmar sua permissão. O acesso permanece bloqueado.</p><button onClick={() => setAttempt(value => value + 1)}>Verificar novamente</button></>
  if (checked.decision === 'denied') return optional ? <>{fallback}</> : <>
    <p role="alert">Acesso não autorizado para este recurso.</p>
    <Link to="/">Voltar ao início</Link>
  </>
  return preserveDuringRecheck ? <><div>{children}</div></> : <>{children}</>
}
