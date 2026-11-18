import { DefaultChurchAccess } from '../church-context'
import { useCallback, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { LoginRedirect, useAuth } from '../auth'
import { consultAuthorization, ResourceAccess } from '../authorization'
import { discoverResources } from '../AuthorizedResources'
import { useRead } from '../security/SecurityPages'
import { isUuid } from '../validation'
import { Enroll, OwnExecution } from './SequentialOwnPages'
import TrailModelManagement from './TrailModelManagement'
import ManagedTrailExecutions from './ManagedTrailExecutions'
import TrailPageHeader from './TrailPageHeader'
import { Query } from './TrailWidgets'
import '../events/events.css'
import '../events/occurrences.css'
import './trails.css'

type View = 'enroll' | 'own' | 'access' | 'church' | 'denomination'
export default function SequentialTrailPages({ view }: { view: View }) {
  const [params, setParams] = useSearchParams()
  const participants = params.get('aba') === 'participantes'
  const { churchId = '', denominationId = '', trailId = '' } = useParams(), { account } = useAuth()
  const [session, setSession] = useState({ account, generation: 0 })
  if (session.account !== account) { setSession({ account, generation: session.generation + 1 }); return null }
  if (!account) return <LoginRedirect/>
  const kind = view === 'denomination' ? 'DENOMINATION' : 'CHURCH', scopeId = kind === 'CHURCH' ? churchId : denominationId
  const title = view === 'enroll' ? 'Participar de uma trilha' : view === 'own' ? 'Meu percurso' : view === 'access' ? 'Gestão de trilhas' : view === 'denomination' ? 'Modelos da denominação' : 'Trilhas da igreja'
  return <div className="occurrences sequential-trails"><TrailPageHeader title={title} description={view === 'own' ? 'Acompanhe seu percurso e realize cada atividade disponível.' : view === 'enroll' ? 'Escolha a igreja e conheça as trilhas disponíveis para você.' : 'Organize modelos, etapas e acompanhe os percursos da igreja.'}/>
    <nav aria-label="Navegação das trilhas"><Link to="/minhas-trilhas">Minhas trilhas</Link><Link to="/minhas-trilhas/participar">Participar de uma trilha</Link>{view !== 'access' && <Link to="/trilhas/gestao?selecionar=1">Trocar igreja</Link>}</nav>
    <div key={`${session.generation}:${view}:${scopeId}:${trailId}`}>
      {view === 'enroll' ? <Enroll person={account.personId}/> : view === 'access' ? <ManagementAccess/> : view === 'own' ? isUuid(trailId) ? <OwnExecution id={trailId} person={account.personId}/> : <p role="alert">Abra o percurso pela lista de suas trilhas.</p> : !isUuid(scopeId) ? <p role="alert">Abra a gestão de trilhas pelo acesso da equipe.</p> :
        <ResourceAccess permissionCode={kind === 'DENOMINATION' ? 'TRAIL_TEMPLATE_MANAGE' : 'TRAIL_MANAGE'} resourceType={kind} resourceId={scopeId} preserveDuringRecheck>
          {kind === 'CHURCH' && <nav className="trail-management-tabs" aria-label="Gestão de trilhas"><button aria-pressed={!participants} onClick={() => setParams({ aba: 'modelos' })}>Modelos</button><button aria-pressed={participants} onClick={() => setParams({ aba: 'participantes' })}>Participantes</button></nav>}
          {kind === 'CHURCH' && participants ? <ManagedTrailExecutions church={scopeId}/> : <TrailModelManagement scope={{ kind, id: scopeId }}/> }
        </ResourceAccess>}
    </div>
  </div>
}
function ManagementAccess() {
  const load = useCallback(async (signal: AbortSignal) => {
    const resources = await discoverResources(signal)
    return (await Promise.all(resources.map(async resource => ({ resource, allowed: await consultAuthorization({ permissionCode: resource.resourceType === 'DENOMINATION' ? 'TRAIL_TEMPLATE_MANAGE' : 'TRAIL_MANAGE', resourceType: resource.resourceType, resourceId: resource.resourceId }, signal) })))).filter(v => v.allowed).map(v => v.resource)
  }, [])
  const query = useRead('trail-management-resources', load)
  return <Query query={query} label="acessos da equipe">{rows => rows.length ? <DefaultChurchAccess  options={rows.filter(v => v.resourceType === 'CHURCH').map(v => ({ churchId: v.resourceId, path: `/trilhas/igrejas/${v.resourceId}` }))}><ul className="event-list">{rows.map(v => <li key={`${v.resourceType}:${v.resourceId}`}><h2>{v.label}</h2>
    <Link to={`/trilhas/${v.resourceType === 'DENOMINATION' ? 'denominacoes' : 'igrejas'}/${v.resourceId}`}>{v.resourceType === 'DENOMINATION' ? 'Gerir modelos da denominação' : 'Gerir trilhas e participantes'}</Link>
  </li>)}</ul></DefaultChurchAccess> : <p>Você não possui acesso de gestão de trilhas.</p>}</Query>
}
