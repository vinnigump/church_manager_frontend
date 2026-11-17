import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api'
export function useQuestionnaireCommand() {
  const pending = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [message, setMessage] = useState('')
  useEffect(() => () => pending.current?.abort(), [])
  async function run<T>(operation: (signal: AbortSignal) => Promise<T>, success: (value: T) => void) {
    if (pending.current || blocked) return
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('')
    try { const value = await operation(controller.signal); if (!controller.signal.aborted) success(value) }
    catch (e) { if (!controller.signal.aborted) { setBlocked(true); setMessage(`${e instanceof ApiError ? e.message : 'Não foi possível confirmar a operação.'} Confira os dados antes de repetir; a operação pode ter sido salva.`) } }
    finally { if (pending.current === controller) pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  function reset() { if (!pending.current) { setBlocked(false); setMessage('') } }
  return { run, reset, busy, blocked, message }
}
