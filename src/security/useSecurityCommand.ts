import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api'

// Instanciar acima de ResourceAccess; reautorizar/remontar os dados a cada revision.
export function useSecurityCommand(refreshInstruction: string) {
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  const pending = useRef<AbortController | null>(null)
  const refreshRequired = useRef(false)
  const alive = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false; pending.current?.abort() } }, [])
  async function run(execute: (signal: AbortSignal) => Promise<unknown>, success: string) {
    if (pending.current || refreshRequired.current) return
    const controller = new AbortController()
    pending.current = controller; setBusy(true); setMessage(''); setFailed(false)
    try {
      await execute(controller.signal)
      if (alive.current) { setMessage(success); setRevision(value => value + 1) }
    } catch (error) {
      if (alive.current) {
        refreshRequired.current = true; setBlocked(true); setFailed(true)
        setMessage(error instanceof ApiError && error.status >= 400 && error.status < 500
          ? `${error.message} O servidor também protege o último acesso administrativo. ${refreshInstruction}`
          : `O resultado da revogação não pôde ser confirmado. ${refreshInstruction}`)
      }
    } finally { pending.current = null; if (alive.current) setBusy(false) }
  }
  function refresh() {
    if (pending.current) return
    refreshRequired.current = false; setBlocked(false); setMessage(''); setFailed(false); setRevision(value => value + 1)
  }
  return { busy, blocked, message, failed, revision, run, refresh }
}
