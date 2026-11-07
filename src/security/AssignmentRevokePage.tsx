import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { readAssignment, revokeAssignment, type Assignment } from './assignments-api'
import { AssignmentMetadata } from './AssignmentsPage'
import { securityRoute, useRead } from './SecurityPages'
import { useSecurityCommand } from './useSecurityCommand'

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
  const { busy, blocked, message, failed, revision, run, refresh } = useSecurityCommand('Atualize a atribuição antes de tentar novamente.')
  return <>
    <Link to={`${securityRoute(denominationId)}/atribuicoes/${assignmentId}`}>Voltar à atribuição</Link>
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
    <button disabled={busy} onClick={refresh}>Atualizar atribuição e permissão</button>
    <ResourceAccess key={revision} permissionCode="security:assignment:manage" resourceType="DENOMINATION" resourceId={denominationId}>
      <Loaded denominationId={denominationId} assignmentId={assignmentId} busy={busy} blocked={blocked} execute={current => { void run(signal => revokeAssignment(denominationId, current, signal), 'Revogação confirmada pelo servidor. A permissão e os dados serão consultados novamente.') }}/>
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
