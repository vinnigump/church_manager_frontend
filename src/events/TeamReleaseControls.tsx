import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api'
import { releaseOccurrenceTeam, type TeamAssignment, type TeamPage } from './team-api'

export function useTeamRelease(churchId: string, occurrenceId: string) {
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)
  const pending = useRef<AbortController | null>(null)
  const needsRefresh = useRef(false)
  useEffect(() => () => pending.current?.abort(), [])
  async function run(before: TeamPage, assignmentId: string) {
    if (pending.current || needsRefresh.current) return
    const controller = new AbortController(); pending.current = controller
    setBusy(true); setMessage(''); setFailed(false)
    try {
      const result = await releaseOccurrenceTeam(churchId, occurrenceId, before, assignmentId, controller.signal)
      if (!controller.signal.aborted) {
        setMessage(`Liberação confirmada na revisão ${result.revision}. O histórico foi preservado. A consulta abaixo mostra o estado atual.`)
        setVersion(v => v + 1)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        needsRefresh.current = true; setBlocked(true); setFailed(true)
        setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar a liberação.'} Atualize e confira a equipe antes de outra tentativa.`)
      }
    } finally { pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  function refresh() {
    if (pending.current) return
    needsRefresh.current = false; setBlocked(false); setMessage(''); setFailed(false); setVersion(v => v + 1)
  }
  return { busy, blocked, message, failed, version, run, refresh }
}
export type TeamReleaseCommand = ReturnType<typeof useTeamRelease>
export default function TeamReleaseControls({ data, item, command }: { data: TeamPage; item: TeamAssignment; command: TeamReleaseCommand }) {
  const [confirmed, setConfirmed] = useState(false)
  return !confirmed ? <button disabled={command.busy || command.blocked} onClick={() => setConfirmed(true)}>Liberar atribuição {item.id}</button> : <div role="group" aria-label={`Confirmar liberação ${item.id}`}>
    <p>Confirmar liberação de {item.role === 'COORDINATOR' ? 'coordenação' : 'apoio'} da membresia {item.membershipId} na revisão {data.revision}?</p>
    <p>O histórico permanece. Isso não altera membresia, presença ou permissões. Liberar a coordenação pode impedir uma futura publicação até que haja coordenador elegível.</p>
    <button disabled={command.busy || command.blocked} onClick={() => void command.run(data, item.id)}>Confirmar liberação</button>{' '}
    <button disabled={command.busy} onClick={() => setConfirmed(false)}>Voltar sem liberar</button>
  </div>
}
