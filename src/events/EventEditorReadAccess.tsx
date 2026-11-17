import { useEffect, useState, type ReactNode } from 'react'
import { LoginRedirect, useAuth } from '../auth'
import { consultAuthorization } from '../authorization'
/** Authorize the form's own read supports; never grants general list access. */
export default function EventEditorReadAccess({ church, children, allowCreate = false }: { church: string; children: ReactNode; allowCreate?: boolean }) {
  const { account } = useAuth(), [attempt, setAttempt] = useState(0)
  const key = JSON.stringify([church, allowCreate, attempt])
  const [checked, setChecked] = useState<{ account: typeof account; key: string; result: 'allowed' | 'denied' | 'error' } | null>(null)
  useEffect(() => { const refresh = () => setAttempt(v => v + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [])
  useEffect(() => {
    const controller = new AbortController()
    if (account) void Promise.all(['EVENT_VIEW', 'EVENT_EDIT', ...(allowCreate ? ['EVENT_CREATE'] : [])].map(permissionCode => consultAuthorization({ permissionCode, resourceType: 'CHURCH', resourceId: church }, controller.signal)))
      .then(values => { if (!controller.signal.aborted) setChecked({ account, key, result: values.some(Boolean) ? 'allowed' : 'denied' }) })
      .catch(() => { if (!controller.signal.aborted) setChecked({ account, key, result: 'error' }) })
    return () => controller.abort()
  }, [account, church, allowCreate, key])
  if (!account) return <LoginRedirect/>
  if (checked?.key !== key || checked.account !== account) return <p role="status" aria-busy="true">Verificando permissão…</p>
  if (checked.result === 'error') return <><p role="alert">Não foi possível confirmar sua permissão. O acesso permanece bloqueado.</p><button onClick={() => setAttempt(v => v + 1)}>Verificar novamente</button></>
  if (checked.result === 'denied') return <p role="alert">Acesso não autorizado para este recurso.</p>
  return <>{children}</>
}
