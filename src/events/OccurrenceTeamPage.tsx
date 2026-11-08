import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { readOccurrenceTeam } from './team-api'
import './events.css'

function TeamRecords({ churchId, occurrenceId, page, setPage }: { churchId: string; occurrenceId: string; page: number; setPage: (page: number) => void }) {
  const load = useCallback((signal: AbortSignal) => readOccurrenceTeam(churchId, occurrenceId, page, signal), [churchId, occurrenceId, page])
  const query = useRead(`${churchId}:${occurrenceId}:${page}`, load)
  return <ReadResult query={query} label="histórico da equipe">{data => <>
    <p>Revisão consultada da ocorrência: {data.revision}</p>
    <p>Página {data.page + 1} · {data.total} atribuições no histórico, incluindo liberadas.</p>
    <p>Esta página não conta toda a equipe ativa. A elegibilidade é a informada pelo servidor nesta consulta; a publicação reavalia a coordenação na própria operação.</p>
    {data.items.length ? <ul className="event-list">{data.items.map(item => <li key={item.id}>
      <h2>{item.role === 'COORDINATOR' ? 'Coordenação' : 'Apoio'}</h2>
      <dl><dt>Atribuição</dt><dd>{item.id}</dd><dt>Membresia vinculada</dt><dd>{item.membershipId}</dd></dl>
      <p>Atribuída em: <time dateTime={item.assignedAt}>{item.assignedAt}</time></p>
      {item.releasedAt === null ? <p>Não liberada · {item.eligible ? 'Elegível nesta consulta' : 'Não elegível nesta consulta'}</p>
        : <p>Liberada em: <time dateTime={item.releasedAt}>{item.releasedAt}</time></p>}
    </li>)}</ul> : <p>Nenhuma atribuição nesta página.</p>}
    <Pagination page={page} total={data.total} setPage={setPage} label="Páginas do histórico da equipe"/>
  </>}</ReadResult>
}
function TeamWorkspace({ churchId, occurrenceId }: { churchId: string; occurrenceId: string }) {
  const [page, setPage] = useState(0)
  return <ResourceAccess permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId}>
    <TeamRecords churchId={churchId} occurrenceId={occurrenceId} page={page} setPage={setPage}/>
  </ResourceAccess>
}
export default function OccurrenceTeamPage() {
  const { churchId = '', occurrenceId = '' } = useParams()
  const { account } = useAuth()
  return <div className="events"><h1 data-page-title="Equipe da ocorrência">Equipe da ocorrência</h1><Link to="/eventos">Voltar a Eventos</Link>
    <p>Histórico administrativo de coordenação e apoio. A consulta não disponibiliza nomes ou contatos.</p>
    {!isUuid(churchId) || !isUuid(occurrenceId) ? <p role="alert">O acesso à equipe é inválido. Abra novamente o detalhe autorizado da ocorrência.</p> : <>
      <p><Link to={`/eventos/igrejas/${churchId}/ocorrencias/${occurrenceId}`}>Voltar à ocorrência</Link></p>
      <TeamWorkspace key={`${account?.id}:${churchId}:${occurrenceId}`} churchId={churchId} occurrenceId={occurrenceId}/>
    </>}
  </div>
}
