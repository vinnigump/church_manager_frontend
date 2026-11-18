import { DefaultChurchAccess } from '../church-context'
import './questionnaires.css'
import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { discoverResources } from '../AuthorizedResources'
import { consultAuthorization, ResourceAccess } from '../authorization'
import { Pagination } from '../security/SecurityPages'
import { isUuid } from '../validation'
import { catalog, contexts, exportResults, mine, responses, route, start, versions } from './questionnaires-api'
import QuestionnaireResponse from './QuestionnaireResponse'
import QuestionnaireEditor from './QuestionnaireEditor'
import { useQuestionnaireCommand } from './useQuestionnaireCommand'
import { managePermission, readPermission, gradePermission, ResponseReadAccess, exportPermission, questionnaireStatus as status, ScopedRead } from './shared'
import '../events/occurrences.css'
function Access() {
  const load = useCallback(async (signal: AbortSignal) => {
    const [own, resources] = await Promise.all([contexts(signal), discoverResources(signal)])
    const churches = resources.filter(v => v.resourceType === 'CHURCH')
    const checks = await Promise.all(churches.map(async v => {
      const allowed = await Promise.all([managePermission, readPermission, exportPermission, gradePermission].map(permissionCode => consultAuthorization({ permissionCode, resourceType: 'CHURCH', resourceId: v.resourceId }, signal)))
      return { church: v, manage: allowed[0], read: allowed[1], export: allowed[2], grade: allowed[3] }
    }))
    return { own, staff: checks.filter(v => v.manage || v.read || v.export || v.grade) }
  }, [])
  return <ScopedRead context="questionnaire-contexts" load={load} label="igrejas dos questionários">{data => <DefaultChurchAccess options={[...data.own.map(v => ({ churchId: v.churchId, path: route(v.churchId) })), ...data.staff.map(v => ({ churchId: v.church.resourceId, path: `${route(v.church.resourceId)}/${v.manage ? 'gerenciar' : v.read || v.grade ? 'respostas' : 'exportar'}` }))]}>
    <h2>Meus questionários</h2>{data.own.length ? <ul className="event-list">{data.own.map(v => <li key={v.churchId}><h3>{v.churchName}</h3><Link to={route(v.churchId)}>Respostas e questionários em {v.churchName}</Link>{!v.canRespond && <p>Consulta do seu histórico.</p>}</li>)}</ul> : <p>Nenhuma igreja associada ou resposta anterior encontrada.</p>}
    <h2>Gestão</h2>{data.staff.length ? <ul>{data.staff.map(v => <li key={v.church.resourceId}>{v.church.label}: {v.manage && <Link to={`${route(v.church.resourceId)}/gerenciar`}>Gerenciar questionários</Link>} {' '}{(v.read || v.grade) && <Link to={`${route(v.church.resourceId)}/respostas`}>{v.read ? 'Consultar respostas' : 'Corrigir respostas'}</Link>} {' '}{v.export && <Link to={`${route(v.church.resourceId)}/exportar`}>Exportar resultados</Link>}</li>)}</ul> : <p>Nenhuma gestão de questionários disponível.</p>}
  </DefaultChurchAccess>}</ScopedRead>
}
function OwnCatalog({ church }: { church: string }) {
  const [page, setPage] = useState(0), [historyPage, setHistoryPage] = useState(0)
  const own = useCallback((signal: AbortSignal) => mine(church, historyPage, signal), [church, historyPage])
  const access = useCallback((signal: AbortSignal) => contexts(signal), [])
  const available = useCallback((signal: AbortSignal) => catalog(church, false, page, signal), [church, page])
  return <><h2>Questionários disponíveis</h2><ScopedRead context={church} load={access} label="participação">{data => data.some(v => v.churchId === church && v.canRespond) ? <ScopedRead context={`${church}:${page}`} load={available} label="questionários">{data => <>{data.items.length ? <ul className="event-list">{data.items.map(v => <li key={v.id}><h3>{v.name}</h3>{v.publishedVersionId && <Link to={`${route(church)}/responder/${v.publishedVersionId}`}>Responder {v.name}</Link>}</li>)}</ul> : <p>Nenhum questionário disponível.</p>}<Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos questionários"/></>}</ScopedRead> : <p>Seu contexto atual permite consultar as respostas anteriores.</p>}</ScopedRead>
    <h2>Minhas respostas</h2><ScopedRead context={`${church}:${historyPage}`} load={own} label="minhas respostas">{data => <>{data.items.length ? <ul>{data.items.map(v => <li key={v.id}>{status(v.status)}{v.score !== null && ` · Nota ${v.score}`} {' '}<Link to={`${route(church)}/aplicacoes/${v.id}`}>{v.status === 'STARTED' ? 'Retomar respostas' : 'Ver minhas respostas'}</Link>{v.taskInstanceId && ' · Vinculado a uma etapa de trilha'}</li>)}</ul> : <p>Você ainda não respondeu questionários nesta igreja.</p>}<Pagination page={historyPage} total={data.total} setPage={setHistoryPage} label="Páginas das minhas respostas"/></>}</ScopedRead>
  </>
}
function Begin({ church, versionId }: { church: string; versionId: string }) {
  const [params] = useSearchParams(), navigate = useNavigate(), command = useQuestionnaireCommand(), task = params.get('taskInstanceId')
  if (task !== null && !isUuid(task)) return <p role="alert">Etapa inválida.</p>
  return <><p>Inicie ou retome o preenchimento. A tentativa será contada somente ao enviar todas as respostas.</p>{task && <p>Esta resposta será vinculada à etapa da sua trilha.</p>}{command.message && <p role="alert">{command.message}</p>}<button disabled={command.busy || command.blocked} onClick={() => void command.run(signal => start(church, versionId, task, signal), value => navigate(`${route(church)}/aplicacoes/${value.id}`, { replace: true }))}>Iniciar ou retomar</button>{command.blocked && <p><Link to={route(church)}>Conferir minhas respostas antes de repetir</Link>. Se o limite de tentativas já foi usado, procure o gestor.</p>}</>
}
function Management({ church }: { church: string }) {
  const [page, setPage] = useState(0), load = useCallback((signal: AbortSignal) => catalog(church, true, page, signal), [church, page])
  return <ResourceAccess permissionCode={managePermission} resourceType="CHURCH" resourceId={church}><p><Link to={`${route(church)}/novo`}>Criar questionário</Link></p><ScopedRead context={`${church}:${page}`} load={load} label="gestão de questionários">{data => <>{data.items.length ? <ul className="event-list">{data.items.map(v => <li key={v.id}><h2>{v.name}</h2><Link to={`${route(church)}/historico/${v.id}`}>Ver versões</Link> {' '}{v.draftVersionId && <Link to={`${route(church)}/versoes/${v.draftVersionId}`}>Editar rascunho</Link>} {' '}{v.publishedVersionId && <Link to={`${route(church)}/versoes/${v.publishedVersionId}`}>Ver versão disponível</Link>}</li>)}</ul> : <p>Nenhum questionário cadastrado.</p>}<Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos questionários"/></>}</ScopedRead></ResourceAccess>
}
function History({ church, id }: { church: string; id: string }) {
  const [page, setPage] = useState(0), load = useCallback((signal: AbortSignal) => versions(church, id, page, signal), [church, id, page])
  return <ResourceAccess permissionCode={managePermission} resourceType="CHURCH" resourceId={church}><ScopedRead context={`${church}:${id}:${page}`} load={load} label="versões">{data => <><ul>{data.items.map(v => <li key={v.id}><Link to={`${route(church)}/versoes/${v.id}`}>{v.name} · Versão {v.versionNumber}</Link> · {status(v.status)}</li>)}</ul><Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos questionários"/></>}</ScopedRead></ResourceAccess>
}
function Responses({ church }: { church: string }) {
  const [page, setPage] = useState(0), load = useCallback((signal: AbortSignal) => responses(church, page, signal), [church, page])
  return <ResponseReadAccess church={church}><ScopedRead context={`${church}:${page}`} load={load} label="respostas enviadas">{data => <>{data.items.length ? <ul className="event-list">{data.items.map(v => <li key={v.id}><h2>{v.displayName}</h2><p>{status(v.status)}{v.score !== null && ` · Nota ${v.score}`}</p><ResourceAccess permissionCode={readPermission} resourceType="CHURCH" resourceId={church} optional fallback={<Link to={`${route(church)}/respostas/${v.id}`}>Corrigir resposta</Link>}><Link to={`${route(church)}/respostas/${v.id}`}>Consultar resposta</Link></ResourceAccess></li>)}</ul> : <p>Nenhuma resposta enviada.</p>}<Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos questionários"/></>}</ScopedRead></ResponseReadAccess>
}
function Export({ church }: { church: string }) {
  const command = useQuestionnaireCommand()
  return <ResourceAccess permissionCode={exportPermission} resourceType="CHURCH" resourceId={church}><p>Exporta resultados com identificadores, situação e nota. Não inclui textos das respostas ou contatos.</p>{command.message && <p role="alert">{command.message}</p>}<button disabled={command.busy || command.blocked} onClick={() => void command.run(signal => exportResults(church, signal), csv => { const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'resultados-questionarios.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) })}>Baixar resultados CSV</button></ResourceAccess>
}
export type View = 'access' | 'own' | 'begin' | 'application' | 'manage' | 'create' | 'version' | 'history' | 'responses' | 'response' | 'export'
export default function QuestionnairePages({ view }: { view: View }) {
  const { churchId = '', versionId = '', applicationId = '', questionnaireId = '' } = useParams(), { account } = useAuth()
  const [session, setSession] = useState({ account, epoch: 0 })
  if (session.account !== account) { setSession({ account, epoch: session.epoch + 1 }); return null }
  if (view !== 'access' && !isUuid(churchId) || ['begin', 'version'].includes(view) && !isUuid(versionId) || ['application', 'response'].includes(view) && !isUuid(applicationId) || view === 'history' && !isUuid(questionnaireId)) return <p role="alert">Endereço de questionário inválido.</p>
  const titles: Record<View, string> = { access: 'Questionários', own: 'Meus questionários', begin: 'Responder questionário', application: 'Minhas respostas', manage: 'Gerenciar questionários', create: 'Criar questionário', version: 'Editar versão do questionário', history: 'Versões do questionário', responses: 'Respostas para consulta e correção', response: 'Consultar e corrigir resposta', export: 'Exportar resultados' }
  return <section className={`occurrences questionnaire-workspace questionnaire-${view}`} key={`${session.epoch}:${view}:${churchId}:${versionId}:${applicationId}:${questionnaireId}`}><header className="questionnaire-page-heading"><p className="questionnaire-eyebrow">Formação e acompanhamento</p><h1 data-page-title={titles[view]}>{titles[view]}</h1><p>Modelos, respostas e acompanhamento dos questionários da igreja.</p></header><p><Link to="/">Início</Link> · <Link to="/questionarios?selecionar=1">Trocar igreja</Link>{churchId && <> · <Link to={route(churchId)}>Minhas respostas nesta igreja</Link></>}</p>
    {view === 'access' ? <Access/> : view === 'own' ? <OwnCatalog church={churchId}/> : view === 'begin' ? <Begin church={churchId} versionId={versionId}/> : view === 'application' || view === 'response' ? <QuestionnaireResponse church={churchId} applicationId={applicationId} staff={view === 'response'}/> : view === 'manage' ? <Management church={churchId}/> : view === 'create' || view === 'version' ? <QuestionnaireEditor church={churchId} versionId={view === 'version' ? versionId : undefined}/> : view === 'history' ? <History church={churchId} id={questionnaireId}/> : view === 'responses' ? <Responses church={churchId}/> : <Export church={churchId}/>}
  </section>
}
