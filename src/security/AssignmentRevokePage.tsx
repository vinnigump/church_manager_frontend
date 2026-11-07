import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { readAssignment, readDelegatedAssignment, revokeAssignment, type Assignment } from './assignments-api'
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
function Loaded({ denominationId, assignmentId, delegationId, busy, blocked, execute }: { denominationId: string; assignmentId: string; delegationId?: string; busy: boolean; blocked: boolean; execute: (current: Assignment) => void }) {
  const load = useCallback((signal: AbortSignal) => delegationId ? readDelegatedAssignment(denominationId, delegationId, assignmentId, signal) : readAssignment(denominationId, assignmentId, signal), [denominationId, delegationId, assignmentId])
  const { state, refresh } = useRead(JSON.stringify([denominationId, delegationId, assignmentId]), load)
  useEffect(() => {
    if (!delegationId) return
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [delegationId, refresh])
  if (state.kind === 'loading') return <p role="status">Carregando atribuição…</p>
  if (state.kind === 'error') return <p role="alert">{state.message}</p>
  return <><h2>Atribuição {state.data.id}</h2><AssignmentMetadata value={state.data}/>
    <Confirmation value={state.data} disabled={busy || blocked} execute={() => execute(state.data)}/>
  </>
}
function Workspace({ denominationId, assignmentId, delegationId }: { denominationId: string; assignmentId: string; delegationId?: string }) {
  const { busy, blocked, message, failed, revision, run, refresh } = useSecurityCommand('Atualize a atribuição antes de tentar novamente.')
  const loaded = <Loaded key={revision} denominationId={denominationId} assignmentId={assignmentId} delegationId={delegationId} busy={busy} blocked={blocked} execute={current => { void run(signal => revokeAssignment(denominationId, current, signal), 'Revogação confirmada pelo servidor. A permissão e os dados serão consultados novamente.') }}/>
  return <>
    <Link to={delegationId ? `${securityRoute(denominationId)}/delegacoes/${delegationId}/atribuicoes/${assignmentId}` : `${securityRoute(denominationId)}/atribuicoes/${assignmentId}`}>Voltar à atribuição</Link>
    {delegationId && <p>O servidor aplica a política central quando houver essa permissão; caso contrário, exige fonte própria válida e atribuição criada pelo delegado nessa origem. Conhecer a fonte não concede gestão denominacional.</p>}
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
    <button disabled={busy} onClick={refresh}>Atualizar atribuição e permissão</button>
    {delegationId ? loaded : <ResourceAccess key={revision} permissionCode="security:assignment:manage" resourceType="DENOMINATION" resourceId={denominationId}>{loaded}</ResourceAccess>}
  </>
}
export default function AssignmentRevokePage({ delegated = false }: { delegated?: boolean }) {
  const { denominationId = '', assignmentId = '', delegationId } = useParams()
  const { account } = useAuth()
  const title = delegated ? 'Revogar atribuição por fonte' : 'Revogar atribuição'
  return <><h1 data-page-title={title}>{title}</h1>
    {!isUuid(denominationId) || !isUuid(assignmentId) || (delegated && (!delegationId || !isUuid(delegationId))) ? <p role="alert">O acesso administrativo é inválido.</p>
      : <Workspace key={`${account?.id}:${denominationId}:${assignmentId}:${delegated ? delegationId : ''}`} denominationId={denominationId} assignmentId={assignmentId} delegationId={delegated ? delegationId : undefined}/>}
  </>
}
