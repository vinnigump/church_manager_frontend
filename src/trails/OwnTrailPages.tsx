import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LoginRedirect, useAuth } from '../auth'
import { isUuid } from '../validation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { listOwnTrails, listOwnTrailTasks, readOwnTrail, type OwnTrail, type OwnTrailTask } from './own-trail-api'
import '../events/events.css'
import '../events/occurrences.css'

const trailLabel: Record<OwnTrail['status'], string> = { NOT_STARTED: 'Não iniciada', IN_PROGRESS: 'Em andamento', PAUSED: 'Pausada', COMPLETED: 'Concluída', CANCELLED: 'Cancelada' }
const taskLabel: Record<OwnTrailTask['status'], string> = { PENDING: 'Pendente', BLOCKED: 'Aguardando etapas anteriores', AVAILABLE: 'Disponível', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluída', SKIPPED: 'Ignorada (registro anterior)', CANCELLED: 'Cancelada' }
const typeLabel: Record<OwnTrailTask['type'], string> = { MANUAL: 'Tarefa', EVENT_PARTICIPATION: 'Evento', QUESTIONNAIRE: 'Questionário', AUTOMATIC: 'Automática (cadastro anterior)' }
function List() {
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listOwnTrails(page, signal), [page])
  const query = useRead(`own-trails:${page}`, load)
  return <><p><Link to="/minhas-trilhas/participar">Participar de uma trilha</Link></p><p><Link to="/trilhas/gestao">Acesso da equipe às trilhas</Link></p><ReadResult query={query} label="minhas trilhas">{data => <>
    <p role="status">{data.total} percursos · Página {page + 1}</p>
    {data.items.length ? <ul className="event-list">{data.items.map(v => <li key={v.id}>
      <h2>{v.name}</h2><p>{v.churchName} · {trailLabel[v.status]}</p>
      <p>{v.completedTaskCount} de {v.taskCount} etapas com conclusão registrada.</p>
      <Link to={`/minhas-trilhas/${v.id}`}>Acompanhar {v.name}</Link>
    </li>)}</ul> : <p>Você ainda não tem percursos registrados.</p>}
    <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das minhas trilhas"/>
  </>}</ReadResult></>
}
function Detail({ id }: { id: string }) {
  const [page, setPage] = useState(0)
  const load = useCallback(async (signal: AbortSignal) => {
    const [trail, tasks] = await Promise.all([readOwnTrail(id, signal), listOwnTrailTasks(id, page, signal)])
    return { trail, tasks }
  }, [id, page])
  const query = useRead(`${id}:${page}`, load)
  return <ReadResult query={query} label="meu percurso">{({ trail, tasks }) => <>
    <h2>{trail.name}</h2><p>{trail.churchName} · {trailLabel[trail.status]}</p>
    <p><Link to={`/minhas-trilhas/${id}/atividades`}>Abrir atividades do percurso</Link></p>
    <p>Versão {trail.versionNumber} · {trail.completedTaskCount} de {trail.taskCount} etapas com conclusão registrada.</p>
    <p>Acompanhe as etapas abaixo. Uma atividade pode ser realizada por outra pessoa responsável pelo seu percurso.</p>
    {tasks.items.length ? <ol className="event-list">{tasks.items.map(v => <li key={v.id}>
      <h3>{v.position}. {v.name}</h3><p>{typeLabel[v.type]} · {v.required ? 'Obrigatória' : 'Opcional'}</p><p>{taskLabel[v.status]}</p>
    </li>)}</ol> : <p>Nenhuma etapa nesta página.</p>}
    <p>A conclusão da trilha depende dos requisitos de cada etapa.</p>
    <Pagination page={page} total={tasks.total} setPage={setPage} label="Páginas das etapas"/>
  </>}</ReadResult>
}
export default function OwnTrailPages({ detail = false }: { detail?: boolean }) {
  const { trailId = '' } = useParams(), { account } = useAuth()
  const [scope, setScope] = useState({ account, session: 0 }), [refresh, setRefresh] = useState(0)
  useEffect(() => { const recheck = () => setRefresh(v => v + 1); window.addEventListener('focus', recheck); return () => window.removeEventListener('focus', recheck) }, [])
  if (scope.account !== account) { setScope({ account, session: scope.session + 1 }); return null }
  if (!account) return <LoginRedirect/>
  const title = detail ? 'Meu percurso' : 'Minhas trilhas'
  return <div className="occurrences"><h1 data-page-title={title}>{title}</h1>
    <nav aria-label="Navegação das minhas trilhas"><Link to="/">Voltar ao Início</Link>{detail && <Link to="/minhas-trilhas">Todas as minhas trilhas</Link>}</nav>
    <div key={`${scope.session}:${refresh}:${trailId}:${detail}`}>
      {detail && !isUuid(trailId) ? <p role="alert">Acesso inválido ao percurso. Abra novamente sua lista de trilhas.</p> : detail ? <Detail id={trailId}/> : <List/>}
    </div>
  </div>
}
