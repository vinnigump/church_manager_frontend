import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { ReadResult, useRead } from '../security/SecurityPages'
import { readOccurrence, type Occurrence } from './occurrence-api'
import { canRequestTransition, isTransition, transitionOccurrence, transitionPermission, type Transition } from './lifecycle-api'
import { occurrenceRoute } from './OccurrencePages'
import './occurrences.css'

const labels: Record<Transition, string> = { unpublish: 'Despublicar ocorrência', cancel: 'Cancelar ocorrência', complete: 'Concluir ocorrência' }
function useTransitionCommand(churchId: string, action: Transition) {
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  const pending = useRef<AbortController | null>(null)
  const needsRefresh = useRef(false)
  useEffect(() => () => pending.current?.abort(), [])
  async function run(before: Occurrence) {
    if (pending.current || needsRefresh.current) return
    const controller = new AbortController(); pending.current = controller
    setBusy(true); setMessage(''); setFailed(false)
    try {
      await transitionOccurrence(churchId, before, action, controller.signal)
      if (!controller.signal.aborted) {
        setMessage({ unpublish: 'Ocorrência despublicada. O marco da primeira publicação e a configuração foram preservados.',
          cancel: 'Ocorrência cancelada. O histórico foi preservado.', complete: 'Ocorrência concluída. Presenças e histórico foram preservados.' }[action])
        setRevision(v => v + 1)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        needsRefresh.current = true; setBlocked(true); setFailed(true)
        setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar o resultado da transição.'} Atualize e confira a ocorrência antes de tentar novamente.`)
      }
    } finally { pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  function refresh() {
    if (pending.current) return
    needsRefresh.current = false; setBlocked(false); setMessage(''); setFailed(false); setRevision(v => v + 1)
  }
  return { busy, blocked, message, failed, revision, run, refresh }
}
type Command = ReturnType<typeof useTransitionCommand>
function TransitionRecords({ churchId, id, action, command }: { churchId: string; id: string; action: Transition; command: Command }) {
  const [confirmedSnapshot, setConfirmedSnapshot] = useState<Occurrence | null>(null)
  const load = useCallback((signal: AbortSignal) => readOccurrence(churchId, id, signal), [churchId, id])
  const query = useRead(`${churchId}:${id}`, load)
  return <ReadResult query={query} label="ocorrência">{value => <>
    <h2>Ocorrência {value.id}</h2><p>Estado registrado: {value.status} · Revisão: {value.revision}</p>
    <p>Início: <time dateTime={value.startsAt}>{value.startsAt}</time><br/>Término: <time dateTime={value.endsAt}>{value.endsAt}</time></p>
    {canRequestTransition(value, action) ? <>
      <p>{action === 'unpublish' ? 'Somente antes do início. O calendário anual não será despublicado; a configuração permanece imutável após a primeira publicação.'
        : action === 'cancel' ? 'O servidor permite cancelamento somente antes do início. Esta ação afeta apenas esta ocorrência, preserva os registros existentes e não encerra a série.'
          : 'O servidor reconcilia o horário e permite conclusão em andamento. Não reabre ocorrências finalizadas nem altera presenças.'}</p>
      <p>O estado e o horário são reavaliados pelo servidor na confirmação. O relógio deste navegador não concede autorização.</p>
      {!confirmedSnapshot ? <button disabled={command.busy || command.blocked} onClick={() => setConfirmedSnapshot(value)}>{labels[action]}</button> : <div role="group" aria-label="Confirmar transição da ocorrência">
        <p>Confirmar {labels[action].toLocaleLowerCase('pt-BR')} na revisão {confirmedSnapshot.revision}?</p>
        <button disabled={command.busy || command.blocked || value.revision !== confirmedSnapshot.revision || value.status !== confirmedSnapshot.status} onClick={() => {
          if (value.revision !== confirmedSnapshot.revision || value.status !== confirmedSnapshot.status) return
          void command.run(confirmedSnapshot)
        }}>Confirmar transição</button>{' '}
        <button disabled={command.busy} onClick={() => setConfirmedSnapshot(null)}>Voltar sem alterar</button>
      </div>}
    </> : <p>Esta transição não está disponível para o estado registrado. Estados legados não são convertidos e ocorrências finalizadas não são reabertas.</p>}
  </>}</ReadResult>
}
function TransitionWorkspace({ churchId, id, action }: { churchId: string; id: string; action: Transition }) {
  const command = useTransitionCommand(churchId, action)
  return <ResourceAccess key={command.revision} permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId}>
    <ResourceAccess permissionCode={transitionPermission[action]} resourceType="CHURCH" resourceId={churchId}>
      {command.message && <p role={command.failed ? 'alert' : 'status'}>{command.message}</p>}
      {command.busy && <p role="status" aria-busy="true">Confirmando transição…</p>}
      <button disabled={command.busy} onClick={command.refresh}>Atualizar ocorrência e reavaliar acesso</button>
      <TransitionRecords churchId={churchId} id={id} action={action} command={command}/>
    </ResourceAccess>
  </ResourceAccess>
}
export default function OccurrenceTransitionPage() {
  const { churchId = '', occurrenceId = '', action = '' } = useParams()
  const { account } = useAuth()
  return <div className="occurrences"><h1 data-page-title="Transição da ocorrência">Transição da ocorrência</h1><Link to="/eventos">Voltar a Eventos</Link>
    {!isUuid(churchId) || !isUuid(occurrenceId) || !isTransition(action) ? <p role="alert">O acesso à transição é inválido. Abra novamente o detalhe autorizado da ocorrência.</p> : <>
      <p><Link to={`${occurrenceRoute(churchId)}/${occurrenceId}`}>Voltar à ocorrência</Link></p>
      <TransitionWorkspace key={`${account?.id}:${churchId}:${occurrenceId}:${action}`} churchId={churchId} id={occurrenceId} action={action}/>
    </>}
  </div>
}
