import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { listDelegations, readDelegation, type Delegation } from './delegations-api'
import { Pagination, ReadResult, securityRoute, useRead } from './SecurityPages'

export function DelegationMetadata({ value }: { value: Delegation }) {
  return <><h2>Fonte de delegação {value.id}</h2><p>Identificador do delegado: {value.delegateeUserId}</p>
    <p>Identificador do perfil: {value.profileId}</p><p>Unidade organizacional: {value.organizationUnitId}</p>
    <p>Estado registrado: {value.status}</p>
    <p>Início inclusivo: <time dateTime={value.startsAt}>{new Date(value.startsAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC</time></p>
    <p>Fim exclusivo: {value.endsAt ? <time dateTime={value.endsAt}>{new Date(value.endsAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC</time> : 'Sem fim definido'}</p></>
}
function List({ denominationId }: { denominationId: string }) {
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listDelegations(denominationId, page, signal), [denominationId, page])
  const query = useRead(JSON.stringify([denominationId, page]), load)
  return <ReadResult query={query} label="fontes de delegação">{data => <>
    <p role="status">Página {page + 1} · {data.total} fontes.</p>
    {data.items.length ? <ul className="security-list">{data.items.map(item => <li key={item.id}><DelegationMetadata value={item}/>
      <Link to={`${securityRoute(denominationId)}/delegacoes/${item.id}`}>Consultar fonte {item.id}</Link>
    </li>)}</ul> : <p>Nenhuma fonte de delegação nesta página.</p>}
    <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das fontes de delegação"/>
  </>}</ReadResult>
}
function Detail({ denominationId, delegationId }: { denominationId: string; delegationId: string }) {
  const load = useCallback((signal: AbortSignal) => readDelegation(denominationId, delegationId, signal), [denominationId, delegationId])
  const query = useRead(JSON.stringify([denominationId, delegationId]), load)
  return <ReadResult query={query} label="fonte de delegação">{data => <><DelegationMetadata value={data}/>
    {data.status === 'ACTIVE' && <ResourceAccess permissionCode="security:assignment:manage" resourceType="DENOMINATION" resourceId={denominationId} optional>
      <Link to={`${securityRoute(denominationId)}/delegacoes/${data.id}/revogar`}>Revogar fonte de delegação</Link>
    </ResourceAccess>}
  </>}</ReadResult>
}
export default function DelegationsPage() {
  const { denominationId = '', delegationId } = useParams()
  const { account } = useAuth()
  const valid = isUuid(denominationId) && (delegationId === undefined || isUuid(delegationId))
  const title = delegationId ? 'Detalhes da fonte de delegação' : 'Fontes de delegação'
  return <><h1 data-page-title={title}>{title}</h1><Link to="/conta">Voltar à minha conta</Link>
    {!valid ? <p role="alert">O acesso administrativo é inválido.</p> : <div key={`${account?.id}:${denominationId}:${delegationId ?? ''}`}>
      <p>Consultar metadados não concede gestão denominacional nem comprova que a fonte está operacional. O servidor valida cada operação e sua vigência.</p>
      {delegationId ? <><Detail denominationId={denominationId} delegationId={delegationId}/>
        <ResourceAccess permissionCode="security:assignment:manage" resourceType="DENOMINATION" resourceId={denominationId} optional><Link to={`${securityRoute(denominationId)}/delegacoes`}>Fontes de delegação da denominação</Link></ResourceAccess>
      </> : <ResourceAccess permissionCode="security:assignment:manage" resourceType="DENOMINATION" resourceId={denominationId}><List denominationId={denominationId}/></ResourceAccess>}
    </div>}
  </>
}
