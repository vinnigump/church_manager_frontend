import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { readDelegation, revokeDelegation, type Delegation } from './delegations-api'
import { DelegationMetadata } from './DelegationsPage'
import { securityRoute, useRead } from './SecurityPages'
import { useSecurityCommand } from './useSecurityCommand'

function Controls({ value, disabled, execute }: { value: Delegation; disabled: boolean; execute: () => void }) {
  const [confirm, setConfirm] = useState(false)
  if (value.status !== 'ACTIVE') return <p>Esta fonte não está em estado ativo registrado. Nenhuma revogação está disponível.</p>
  return <>{!confirm ? <button disabled={disabled} onClick={() => setConfirm(true)}>Revogar fonte de delegação</button> : <div role="group" aria-label="Confirmar revogação da fonte">
    <p>Revogar a fonte {value.id} do delegado {value.delegateeUserId}? O servidor deixará de considerar esta fonte válida para operações delegadas. O histórico será preservado e as decisões de acesso serão reavaliadas pelo servidor.</p>
    <button disabled={disabled} onClick={() => { setConfirm(false); execute() }}>Confirmar revogação da fonte</button>
    <button disabled={disabled} onClick={() => setConfirm(false)}>Cancelar revogação da fonte</button>
  </div>}</>
}
function Loaded({ denominationId, delegationId, command }: { denominationId: string; delegationId: string; command: ReturnType<typeof useSecurityCommand> }) {
  const load = useCallback((signal: AbortSignal) => readDelegation(denominationId, delegationId, signal), [denominationId, delegationId])
  const { state } = useRead(JSON.stringify([denominationId, delegationId]), load)
  if (state.kind === 'loading') return <p role="status">Carregando fonte de delegação…</p>
  if (state.kind === 'error') return <p role="alert">{state.message}</p>
  return <><DelegationMetadata value={state.data}/><Controls value={state.data} disabled={command.busy || command.blocked} execute={() => {
    void command.run(signal => revokeDelegation(denominationId, state.data, signal), 'Revogação da fonte confirmada pelo servidor. A permissão e os dados serão consultados novamente.')
  }}/></>
}
function Workspace({ denominationId, delegationId }: { denominationId: string; delegationId: string }) {
  const command = useSecurityCommand('Atualize a fonte e a permissão antes de tentar novamente.')
  return <><Link to={`${securityRoute(denominationId)}/delegacoes/${delegationId}`}>Voltar à fonte de delegação</Link>
    {command.message && <p role={command.failed ? 'alert' : 'status'}>{command.message}</p>}
    <button disabled={command.busy} onClick={command.refresh}>Atualizar fonte e permissão</button>
    <ResourceAccess key={command.revision} permissionCode="security:assignment:manage" resourceType="DENOMINATION" resourceId={denominationId}>
      <Loaded denominationId={denominationId} delegationId={delegationId} command={command}/>
    </ResourceAccess>
  </>
}
export default function DelegationRevokePage() {
  const { denominationId = '', delegationId = '' } = useParams()
  const { account } = useAuth()
  return <><h1 data-page-title="Revogar fonte de delegação">Revogar fonte de delegação</h1>
    {!isUuid(denominationId) || !isUuid(delegationId) ? <p role="alert">O acesso administrativo é inválido.</p>
      : <Workspace key={`${account?.id}:${denominationId}:${delegationId}`} denominationId={denominationId} delegationId={delegationId}/>}
  </>
}
