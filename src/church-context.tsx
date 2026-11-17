import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { api } from './api'
import { useAuth } from './auth'
import { isUuid } from './validation'
type ChurchContext = { defaultChurchId: string | null; churches: { churchId: string; name: string }[] }
const empty: ChurchContext = { defaultChurchId: null, churches: [] }
const Context = createContext<ChurchContext>(empty)
function parse(value: unknown): ChurchContext {
  if (!value || typeof value !== 'object') throw new Error('Contexto inválido.')
  const data = value as ChurchContext
  if (!Array.isArray(data.churches) || data.churches.some(v => !v || !isUuid(v.churchId) || typeof v.name !== 'string') || (data.defaultChurchId !== null && (!isUuid(data.defaultChurchId) || !data.churches.some(v => v.churchId === data.defaultChurchId)))) throw new Error('Contexto inválido.')
  return data
}
export function ChurchContextProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth()
  const [snapshot, setSnapshot] = useState<{ account: typeof account; data: ChurchContext }>({ account: null, data: empty })
  useEffect(() => {
    const controller = new AbortController()
    if (account) void api.request<unknown>('/accounts/me/church-context', { signal: controller.signal }).then(parse).then(data => { if (!controller.signal.aborted) setSnapshot({ account, data }) }).catch(() => { if (!controller.signal.aborted) setSnapshot({ account, data: empty }) })
    return () => controller.abort()
  }, [account])
  return <Context.Provider value={account && snapshot.account === account ? snapshot.data : empty}>{children}</Context.Provider>
}
export function useDefaultChurch() { return useContext(Context) }
/** Options MUST already be authorized for the operation by the caller. Never grants access. */
export function DefaultChurchAccess({ options, children, auto = true, label = 'Abrir minha igreja' }: { options: { churchId: string; path: string }[]; children: ReactNode; auto?: boolean; label?: string }) {
  const { defaultChurchId } = useDefaultChurch(), [params] = useSearchParams()
  const preferred = options.find(v => v.churchId === defaultChurchId)
  if (auto && preferred && params.get('selecionar') !== '1') return <Navigate to={preferred.path} replace/>
  if (!auto && preferred && params.get('selecionar') !== '1') return <p><Link to={preferred.path}>{label}</Link>{options.some(v => v.churchId !== preferred.churchId) && <> · <Link to="?selecionar=1">Trocar igreja</Link></>}</p>
  return <>{children}</>
}
export function ChurchSwitchLink({ to }: { to: string }) { return <Link to={to + '?selecionar=1'}>Trocar igreja</Link> }
