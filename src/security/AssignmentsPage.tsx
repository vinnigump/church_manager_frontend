import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { listAssignments, readAssignment, type Assignment } from './assignments-api'
import { Pagination, ReadResult, securityRoute, useRead } from './SecurityPages'
import AuditLink from './AuditLink'

export function AssignmentMetadata({ value }: { value: Assignment }) {
  return <><p>Identificador da conta: {value.userId}</p><p>Identificador do perfil: {value.profileId}</p>
    <p>Unidade organizacional: {value.organizationUnitId}</p><p>Estado registrado: {value.status}</p>
    <p>Início inclusivo: <time dateTime={value.startsAt}>{new Date(value.startsAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC</time></p>
    <p>Fim exclusivo: {value.endsAt ? <time dateTime={value.endsAt}>{new Date(value.endsAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC</time> : 'Sem fim definido'}</p>
    <p>{value.delegationId ? `Fonte da delegação: ${value.delegationId}` : 'Atribuição central'}</p></>
}
function List({ denominationId }: { denominationId: string }) {
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listAssignments(denominationId, page, signal), [denominationId, page])
  const query = useRead(JSON.stringify([denominationId, page]), load)
  return <ReadResult query={query} label="atribuições">{data => <>
    <p role="status">Página {page + 1} · {data.total} atribuições.</p>
    {data.items.length ? <ul className="security-list">{data.items.map(item => <li key={item.id}>
      <h2>Atribuição {item.id}</h2><AssignmentMetadata value={item}/>
      <Link to={`${securityRoute(denominationId)}/atribuicoes/${item.id}`}>Consultar atribuição {item.id}</Link>
    </li>)}</ul> : <p>Nenhuma atribuição nesta página.</p>}
    <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das atribuições"/>
  </>}</ReadResult>
}
function Detail({ denominationId, assignmentId }: { denominationId: string; assignmentId: string }) {
  const load = useCallback((signal: AbortSignal) => readAssignment(denominationId, assignmentId, signal), [denominationId, assignmentId])
  const query = useRead(JSON.stringify([denominationId, assignmentId]), load)
  return <ReadResult query={query} label="atribuição">{data => <><h2>Atribuição {data.id}</h2><AssignmentMetadata value={data}/>
    <AuditLink denominationId={denominationId} resourceType="USER_ROLE_ASSIGNMENT" resourceId={data.id}/>
    {data.status === 'ACTIVE' && <Link to={`${securityRoute(denominationId)}/atribuicoes/${data.id}/revogar`}>Revogar atribuição</Link>}
    {data.delegationId && <Link to={`${securityRoute(denominationId)}/delegacoes/${data.delegationId}/atribuicoes`}>Consultar atribuições desta fonte</Link>}
  </>}</ReadResult>
}
export default function AssignmentsPage() {
  const { denominationId = '', assignmentId } = useParams()
  const { account } = useAuth()
  const valid = isUuid(denominationId) && (assignmentId === undefined || isUuid(assignmentId))
  const title = assignmentId ? 'Detalhes da atribuição' : 'Atribuições de acesso'
  return <><h1 data-page-title={title}>{title}</h1><Link to="/conta">Voltar à minha conta</Link>
    {!valid ? <p role="alert">O acesso administrativo é inválido. Abra novamente o acesso da sua denominação.</p> :
      <ResourceAccess permissionCode="security:assignment:manage" resourceType="DENOMINATION" resourceId={denominationId}>
        <div key={`${account?.id}:${denominationId}:${assignmentId ?? ''}`}>
          <p>O estado registrado e a vigência não representam autorização efetiva da conta. Cada operação é autorizada pelo servidor.</p>
          {assignmentId ? <><Link to={`${securityRoute(denominationId)}/atribuicoes`}>Voltar às atribuições</Link><Detail denominationId={denominationId} assignmentId={assignmentId}/></> : <><Link to={`${securityRoute(denominationId)}/delegacoes`}>Fontes de delegação da denominação</Link><List denominationId={denominationId}/></>}
        </div>
      </ResourceAccess>}
  </>
}
