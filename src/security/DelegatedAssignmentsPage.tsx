import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { isUuid } from '../validation'
import { listDelegatedAssignments, readDelegatedAssignment } from './assignments-api'
import { AssignmentMetadata } from './AssignmentsPage'
import { Pagination, ReadResult, securityRoute, useRead } from './SecurityPages'

const route = (denominationId: string, delegationId: string) => `${securityRoute(denominationId)}/delegacoes/${delegationId}/atribuicoes`
function List({ denominationId, delegationId }: { denominationId: string; delegationId: string }) {
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listDelegatedAssignments(denominationId, delegationId, page, signal), [denominationId, delegationId, page])
  const query = useRead(JSON.stringify([denominationId, delegationId, page]), load)
  const { refresh } = query
  useEffect(() => { window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [refresh])
  return <ReadResult query={query} label="atribuições da fonte">{data => <>
    <p role="status">Página {page + 1} · {data.total} atribuições desta fonte.</p>
    {data.items.length ? <ul className="security-list">{data.items.map(item => <li key={item.id}>
      <h2>Atribuição {item.id}</h2><AssignmentMetadata value={item}/>
      <Link to={`${route(denominationId, delegationId)}/${item.id}`}>Consultar atribuição {item.id}</Link>
    </li>)}</ul> : <p>Nenhuma atribuição desta fonte nesta página.</p>}
    <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das atribuições da fonte"/>
  </>}</ReadResult>
}
function Detail({ denominationId, delegationId, assignmentId }: { denominationId: string; delegationId: string; assignmentId: string }) {
  const load = useCallback((signal: AbortSignal) => readDelegatedAssignment(denominationId, delegationId, assignmentId, signal), [denominationId, delegationId, assignmentId])
  const query = useRead(JSON.stringify([denominationId, delegationId, assignmentId]), load)
  const { refresh } = query
  useEffect(() => { window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [refresh])
  return <><Link to={route(denominationId, delegationId)}>Voltar às atribuições desta fonte</Link>
    <ReadResult query={query} label="atribuição da fonte">{data => <><h2>Atribuição {data.id}</h2><AssignmentMetadata value={data}/>
      {data.status === 'ACTIVE' && <Link to={`${route(denominationId, delegationId)}/${data.id}/revogar`}>Revogar atribuição desta fonte</Link>}
    </>}</ReadResult>
  </>
}
export default function DelegatedAssignmentsPage() {
  const { denominationId = '', delegationId = '', assignmentId } = useParams()
  const { account } = useAuth()
  const valid = isUuid(denominationId) && isUuid(delegationId) && (assignmentId === undefined || isUuid(assignmentId))
  const title = assignmentId ? 'Detalhes da atribuição nesta fonte' : 'Atribuições por fonte de delegação'
  return <><h1 data-page-title={title}>{title}</h1><Link to="/conta">Voltar à minha conta</Link>
    {!valid ? <p role="alert">O acesso administrativo é inválido.</p> : <div key={`${account?.id}:${denominationId}:${delegationId}:${assignmentId ?? ''}`}>
      <p>O servidor valida a fonte e a origem das atribuições. Para o delegado, a consulta se limita às concessões criadas por ele na fonte válida. A gestão central mantém sua política própria.</p>
      <p>Estado registrado e vigência não representam autorização efetiva. Consultar esta fonte não concede gestão denominacional.</p>
      {assignmentId ? <Detail denominationId={denominationId} delegationId={delegationId} assignmentId={assignmentId}/> : <List denominationId={denominationId} delegationId={delegationId}/>}
    </div>}
  </>
}
