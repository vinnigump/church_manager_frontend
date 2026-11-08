import { useEffect, useState, type ReactNode } from 'react'
import { consultAuthorization } from '../authorization'
import { useAuth } from '../auth'

// These church decisions only admit a candidate. The business endpoint also
// checks ACTIVE leadership of the exact group for MANAGE_LED; never infer it.
export default function GroupAccess({ churchId, children }: { churchId: string; children: ReactNode }) {
  const { account } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [checked, setChecked] = useState<{ account: typeof account; churchId: string; attempt: number; decision: 'allowed' | 'denied' | 'error' } | null>(null)
  useEffect(() => { const focus = () => setAttempt(v => v + 1); window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus) }, [])
  useEffect(() => {
    if (!account) return
    const controller = new AbortController(); let active = true
    const query = (permissionCode: string) => consultAuthorization({ permissionCode, resourceType: 'CHURCH', resourceId: churchId }, controller.signal)
    async function check() {
      try { const allowed = await query('GROUP_MEMBERSHIP_MANAGE') || await query('GROUP_MEMBERSHIP_MANAGE_LED'); if (active) setChecked({ account, churchId, attempt, decision: allowed ? 'allowed' : 'denied' }) }
      catch { if (active) setChecked({ account, churchId, attempt, decision: 'error' }) }
    }
    void check(); return () => { active = false; controller.abort() }
  }, [account, churchId, attempt])
  if (!checked || checked.account !== account || checked.churchId !== churchId || checked.attempt !== attempt) return <p role="status" aria-busy="true">Verificando acesso à gestão do grupo…</p>
  if (checked.decision === 'error') return <><p role="alert">Não foi possível confirmar a permissão. O acesso permanece bloqueado.</p><button onClick={() => setAttempt(v => v + 1)}>Verificar novamente</button></>
  if (checked.decision === 'denied') return <p role="alert">Acesso não autorizado à gestão do grupo.</p>
  return <>{children}</>
}
