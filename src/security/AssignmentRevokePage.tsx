import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { readAssignment, revokeAssignment, type Assignment } from './assignments-api'
import { AssignmentMetadata } from './AssignmentsPage'
import { securityRoute, useRead } from './SecurityPages'

function Confirmation({ value, disabled, execute }: { value: Assignment; disabled: boolean; execute: () => void }) {
  const [confirm, setConfirm] = useState(false)
  if (value.status !== 'ACTIVE') return <p>Esta atribuição não está em estado ativo registrado. Nenhuma revogação está disponível.</p>
  return <>{!confirm ? <button disabled={disabled} onClick={() => setConfirm(true)}>Revogar atribuição</button> : <div role="group" aria-label="Confirmar revogação da atribuição">
    <p>Revogar a atribuição {value.id} da conta {value.userId}? Essa atribuição deixará de conceder acesso. Outras atribuições permanecem sujeitas às decisões do servidor. O servidor protege o último acesso administrativo de recuperação.</p>
    <button disabled={disabled} onClick={() => { setConfirm(false); execute() }}>Confirmar revogação</button>
    <button disabled={disabled} onClick={() => setConfirm(false)}>Cancelar revogação</button>
  </div>}</>
}
function Loaded({ denominationId, assignmentId, busy, blocked, execute }: { denominationId: string; assignmentId: string; busy: boolean; blocked: boolean; execute: (current: Assignment) => void }) {
  const load = useCallback((signal: AbortSignal) => readAssignment(denominationId, assignmentId, signal), [denominationId, assignmentId])
  const { state } = useRead(JSON.stringify([denominationId, assignmentId]), load)
  if (state.kind === 'loading') return <p role="status">Carregando atribuição…</p>
  if (state.kind === 'error') return <p role="alert">{state.message}</p>
  return <><h2>Atribuição {state.data.id}</h2><AssignmentMetadata value={state.data}/>
    <Confirmation value={state.data} disabled={busy || blocked} execute={() => execute(state.data)}/>
  </>
}
function Workspace({ denominationId, assignmentId }: { denominationId: string; assignmentId: string }) {
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  const pending = useRef<AbortController | null>(null)
  const refreshRequired = useRef(false)
  const alive = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false; pending.current?.abort() } }, [])
  async function execute(current: Assignment) {
    if (pending.current || refreshRequired.current) return
    const controller = new AbortController()
    pending.current = controller; setBusy(true); setMessage(''); setFailed(false)
    try {
      await revokeAssignment(denominationId, current, controller.signal)
      if (alive.current) {
        setMessage('Revogação confirmada pelo servidor. A permissão e os dados serão consultados novamente.')
        setRevision(value => value + 1)
      }
    } catch (error) {
      if (alive.current) {
        refreshRequired.current = true; setBlocked(true); setFailed(true)
        setMessage(error instanceof ApiError && error.status >= 400 && error.status < 500
          ? `${error.message} O servidor também protege o último acesso administrativo. Atualize a atribuição antes de tentar novamente.`
          : 'O resultado da revogação não pôde ser confirmado. Atualize a atribuição antes de tentar novamente.')
      }
    } finally { pending.current = null; if (alive.current) setBusy(false) }
  }
  function refresh() {
    if (pending.current) return
    refreshRequired.current = false; setBlocked(false); setMessage(''); setFailed(false); setRevision(value => value + 1)
  }
  return <>
    <Link to={`${securityRoute(denominationId)}/atribuicoes/${assignmentId}`}>Voltar à atribuição</Link>
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
    <button disabled={busy} onClick={refresh}>Atualizar atribuição e permissão</button>
    <ResourceAccess key={revision} permissionCode="security:assignment:manage" resourceType="DENOMINATION" resourceId={denominationId}>
      <Loaded denominationId={denominationId} assignmentId={assignmentId} busy={busy} blocked={blocked} execute={current => { void execute(current) }}/>
    </ResourceAccess>
  </>
}
export default function AssignmentRevokePage() {
  const { denominationId = '', assignmentId = '' } = useParams()
  const { account } = useAuth()
  return <><h1 data-page-title="Revogar atribuição">Revogar atribuição</h1>
    {!isUuid(denominationId) || !isUuid(assignmentId) ? <p role="alert">O acesso administrativo é inválido.</p>
      : <Workspace key={`${account?.id}:${denominationId}:${assignmentId}`} denominationId={denominationId} assignmentId={assignmentId}/>}
  </>
}
