import ItemLink from '../components/ItemLink'
import UnsavedChangesGuard from '../components/UnsavedChangesGuard'
import { DefaultChurchAccess } from '../church-context'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { LoginRedirect, useAuth } from '../auth'
import { consultAuthorization, ResourceAccess } from '../authorization'
import { discoverResources } from '../AuthorizedResources'
import { ContextOperation } from '../components/ContextOperation'
import { isUuid } from '../validation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { command, createTask, destinations, listMine, listTasks, readTask, type CreateTask, type Destination, type TaskState, type WorkItem } from './work-item-api'
import TaskOptionPicker from './TaskOptionPicker'
import '../events/events.css'
import '../events/occurrences.css'
import './tasks.css'

const label = { OPEN: 'Para assumir', ASSIGNED: 'Com responsável', COMPLETED: 'Concluída' }
const destinationLabel: Record<Destination, string> = { USER_ACCOUNT: 'Usuário', GROUP: 'Grupo', MINISTRY: 'Ministério', DEPARTMENT: 'Departamento' }
const route = (church: string) => `/tarefas/igrejas/${church}`
function TaskAccess() {
  const load = useCallback(async (_id: string, signal: AbortSignal) => {
    const churches = (await discoverResources(signal)).filter(v => v.resourceType === 'CHURCH')
    return (await Promise.all(churches.map(async v => {
      const [view, create] = await Promise.all(['TASK_VIEW', 'TASK_CREATE'].map(permissionCode => consultAuthorization({ permissionCode, resourceType: 'CHURCH', resourceId: v.resourceId }, signal)))
      return { ...v, view, create }
    }))).filter(v => v.view || v.create)
  }, [])
  return <ContextOperation contextId="task-churches" operation={load}>{state => {
    if (state.kind === 'loading') return <p role="status">Carregando acessos de gestão…</p>
    if (state.kind === 'error') return <p role="alert">Não foi possível consultar os acessos de gestão.</p>
    return state.data.length ? <section><h2>Organizar tarefas</h2><DefaultChurchAccess auto={false} label="Organizar tarefas da minha igreja" options={state.data.map(v => ({ churchId: v.resourceId, path: v.view ? route(v.resourceId) : `${route(v.resourceId)}/nova` }))}><ul>{state.data.map(v => <li key={v.resourceId}>
      <Link to={v.view ? route(v.resourceId) : `${route(v.resourceId)}/nova`}>{v.label}</Link>
    </li>)}</ul></DefaultChurchAccess></section> : null
  }}</ContextOperation>
}
function Filter({ value, change }: { value: TaskState | undefined; change: (v: TaskState | undefined) => void }) {
  return <label>Situação<select value={value ?? ''} onChange={e => change((e.target.value || undefined) as TaskState | undefined)}>
    <option value="">Todas</option>{Object.entries(label).map(([v, text]) => <option key={v} value={v}>{text}</option>)}
  </select></label>
}
function List({ actor, church, epoch }: { actor: string; church?: string; epoch: number }) {
  const [page, setPage] = useState(0), [state, setState] = useState<TaskState>()
  const load = useCallback((signal: AbortSignal) => church ? listTasks(church, page, state, signal) : listMine(actor, page, state, signal), [actor, church, page, state])
  const query = useRead(`${church ?? actor}:${page}:${state}:${epoch}`, load)
  return <><Filter value={state} change={v => { setState(v); setPage(0) }}/>
    <ReadResult query={query} label="tarefas">{data => <>
      <p role="status">{data.total} tarefas · Página {page + 1}</p>
      {data.items.length ? <ul className="event-list">{data.items.map(v => <li key={v.id} className="navigation-card" data-task-state={v.state}><span className="task-state">{label[v.state]}</span><h2>{v.title}</h2>
        <p>Destino: {v.destinationName ?? destinationLabel[v.destinationKind]} · Executor: {v.executorName ?? (v.executorAccountId ? 'Atribuído' : 'Aguardando atribuição')}</p>
        {v.participantName && <p>Participante da trilha: {v.participantName}</p>}
        {v.canClaim && <p>Você pode assumir esta tarefa da equipe.</p>}
        <ItemLink to={church ? `${route(church)}/${v.id}` : `/minhas-tarefas/${v.id}`}>Ver tarefa {v.title}</ItemLink>
      </li>)}</ul> : <p>Nenhuma tarefa nesta consulta.</p>}
      <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das tarefas"/>
    </>}</ReadResult>
  </>
}
function useCommands(actor: string, church?: string) {
  const [value, setValue] = useState<WorkItem | null>(null), [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [message, setMessage] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  async function run(before: WorkItem, action: 'claim' | 'assign' | 'complete', assignee?: string) {
    if (pending.current || blocked) return
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('')
    try {
      const result = await command(before, action, controller.signal, church, assignee, actor)
      if (!controller.signal.aborted) { setValue(result); setMessage(action === 'complete' ? 'Conclusão registrada.' : 'Responsável registrado.') }
    } catch (error) {
      if (!controller.signal.aborted) { setBlocked(true); setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar a operação.'} Atualize a tarefa e confira a atribuição antes de tentar novamente.`) }
    } finally { if (pending.current === controller) pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  return { value, busy, blocked, message, run, reset: () => { if (pending.current) return; setValue(null); setBlocked(false); setMessage('') } }
}
function Detail({ id, actor, church, epoch }: { id: string; actor: string; church?: string; epoch: number }) {
  const load = useCallback((signal: AbortSignal) => readTask(id, signal, church, church ? undefined : actor), [id, actor, church])
  const query = useRead(`${id}:${epoch}`, load), control = useCommands(actor, church)
  const [assignee, setAssignee] = useState('')
  const refresh = () => { if (control.busy) return; control.reset(); setAssignee(''); query.refresh() }
  const message = control.message && <p role={control.blocked ? 'alert' : 'status'}>{control.message}</p>
  if (query.state.kind === 'loading') return <>{message}<p role="status">Carregando tarefa…</p></>
  if (query.state.kind === 'error') return <>{message}<p role="alert">{query.state.message}</p><button disabled={control.busy} onClick={refresh}>Tentar novamente</button></>
  const v = control.value && control.value.revision >= query.state.data.revision ? control.value : query.state.data
  return <article>{message}<h2>{v.title}</h2>
    <p className="task-detail-meta"><span className="task-state">{label[v.state]}</span></p><dl className="task-responsibility"><dt>Para quem é</dt><dd>{v.destinationName ?? destinationLabel[v.destinationKind]} · {destinationLabel[v.destinationKind]}</dd><dt>Quem vai executar</dt><dd>{v.executorAccountId === actor ? (v.executorName ? `${v.executorName} (você)` : 'Você') : v.executorAccountId ? (v.executorName ?? 'Responsável atribuído') : 'Aguardando um integrante assumir ou receber a atribuição'}</dd></dl><p style={{ whiteSpace: 'pre-wrap' }}>{v.instructions}</p>
    {v.participantName && <p>Participante da trilha: {v.participantName}</p>}
    {v.completionMode === 'ADMINISTRATIVE' && <p>Conclusão administrativa registrada.</p>}
    {control.busy && <p role="status" aria-busy="true">Registrando operação…</p>}
    {!church && <>
      {v.canClaim && <button disabled={control.busy || control.blocked} onClick={() => void control.run(v, 'claim')}>Assumir tarefa</button>}
      {v.canComplete && <button disabled={control.busy || control.blocked} onClick={() => void control.run(v, 'complete')}>Concluir tarefa</button>}
      {v.state === 'ASSIGNED' && v.executorAccountId === actor && !v.canComplete && <p>A atribuição precisa de regularização antes da conclusão. Procure a administração.</p>}
    </>}
    {church && v.state === 'OPEN' && v.destinationKind !== 'USER_ACCOUNT' && <ResourceAccess permissionCode="TASK_ASSIGN" resourceType="CHURCH" resourceId={church} optional preserveDuringRecheck>
      <fieldset disabled={control.busy || control.blocked}><legend>Escolher responsável da equipe</legend>
        <TaskOptionPicker church={church} kind={v.destinationKind} task={id} value={assignee} change={setAssignee} label="Integrante"/>
        <button disabled={!assignee} onClick={() => void control.run(v, 'assign', assignee)}>Atribuir tarefa</button>
      </fieldset>
    </ResourceAccess>}
    {church && v.state !== 'COMPLETED' && <ResourceAccess permissionCode="TASK_COMPLETE_ADMIN" resourceType="CHURCH" resourceId={church} optional preserveDuringRecheck>
      <p>Esta ação registra a conclusão administrativa, preservando o responsável e o autor real.</p>
      <button disabled={control.busy || control.blocked} onClick={() => void control.run(v, 'complete')}>Concluir administrativamente</button>
    </ResourceAccess>}
    {control.blocked && <button className="secondary" disabled={control.busy} onClick={refresh}>Conferir resultado</button>}
  </article>
}
function Create({ church }: { church: string }) {
  const [input, setInput] = useState(() => ({ requestId: crypto.randomUUID(), title: '', instructions: '', destinationKind: '', destinationId: '' }))
  const [result, setResult] = useState<WorkItem | null>(null), [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [message, setMessage] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  async function submit(e: FormEvent) {
    e.preventDefault(); if (pending.current || blocked || result) return
    if (!input.title.trim() || !input.instructions.trim() || !input.destinationKind || !input.destinationId) { setMessage('Preencha todos os dados da tarefa.'); return }
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('')
    try { const value = await createTask(church, input as CreateTask, controller.signal); if (!controller.signal.aborted) setResult(value) }
    catch (error) { if (!controller.signal.aborted) { setBlocked(true); setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar o cadastro.'} Confira a lista antes de iniciar outro cadastro.`) } }
    finally { if (pending.current === controller) pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  return <ResourceAccess permissionCode="TASK_CREATE" resourceType="CHURCH" resourceId={church} preserveDuringRecheck>
    <UnsavedChangesGuard dirty={!result && Boolean(input.title || input.instructions || input.destinationKind || input.destinationId)}/>
    {result ? <><p role="status">Tarefa registrada.</p><ResourceAccess permissionCode="TASK_VIEW" resourceType="CHURCH" resourceId={church} optional>
      <Link to={`${route(church)}/${result.id}`}>Ver tarefa registrada</Link>
    </ResourceAccess></> : <><p>Uma tarefa para usuário já fica atribuída a ele. Na equipe, um integrante pode assumir ou receber a atribuição do gestor.</p>
      {message && <p role="alert">{message}</p>}{busy && <p role="status">Criando tarefa…</p>}
      <form onSubmit={e => void submit(e)}><fieldset disabled={busy || blocked}><legend>Dados da tarefa</legend>
        <label>Título<input required maxLength={180} value={input.title} onChange={e => setInput({ ...input, title: e.target.value })}/></label>
        <label>Instruções<textarea required maxLength={10000} rows={6} value={input.instructions} onChange={e => setInput({ ...input, instructions: e.target.value })}/></label>
        <label>Destinar a<select required value={input.destinationKind} onChange={e => setInput({ ...input, destinationKind: e.target.value, destinationId: '' })}>
          <option value="">Selecione</option>{destinations.map(v => <option key={v} value={v}>{destinationLabel[v]}</option>)}
        </select></label>
        {input.destinationKind && <TaskOptionPicker key={input.destinationKind} church={church} kind={input.destinationKind as Destination} value={input.destinationId} change={destinationId => setInput(v => ({ ...v, destinationId }))}/>}
        <button>Criar tarefa</button>
      </fieldset></form>
    </>}
  </ResourceAccess>
}
export default function WorkItemPages({ view }: { view: 'mine' | 'ownDetail' | 'list' | 'detail' | 'create' }) {
  const { churchId = '', taskId = '' } = useParams(), { account } = useAuth()
  const [scope, setScope] = useState({ account, session: 0 }), [epoch, setEpoch] = useState(0)
  useEffect(() => { const refresh = () => setEpoch(v => v + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [])
  if (scope.account !== account) { setScope({ account, session: scope.session + 1 }); return null }
  if (!account) return <LoginRedirect/>
  const personal = view === 'mine' || view === 'ownDetail', detail = view === 'ownDetail' || view === 'detail'
  const valid = (personal || isUuid(churchId)) && (!detail || isUuid(taskId))
  const title = view === 'create' ? 'Criar tarefa' : personal ? 'Minhas tarefas' : 'Tarefas da igreja'
  return <div className="occurrences task-workspace"><header className="task-page-header"><span className="task-eyebrow">Organização e cuidado</span><h1 data-page-title={title}>{title}</h1><p>{view === 'create' ? 'Defina as instruções e o destino da tarefa para organizar o trabalho da equipe.' : 'Acompanhe as atividades, assuma responsabilidades e registre as conclusões.'}</p></header><nav aria-label="Navegação das tarefas">
    <Link to="/">Voltar ao Início</Link><Link to="/minhas-tarefas">Minhas tarefas</Link>{!personal && <Link to="/minhas-tarefas?selecionar=1" className="legacy-context-switch">Trocar igreja</Link>}
    {!personal && valid && <ResourceAccess permissionCode="TASK_VIEW" resourceType="CHURCH" resourceId={churchId} optional><Link to={route(churchId)}>Tarefas da igreja</Link></ResourceAccess>}
  </nav>
    {!valid ? <p role="alert">Acesso inválido. Abra novamente sua lista de tarefas.</p> : <div key={`${scope.session}:${churchId}:${taskId}:${view}`}>
      {personal ? view === 'mine' ? <><List actor={account.id} epoch={epoch}/><TaskAccess key={epoch}/></> : <Detail id={taskId} actor={account.id} epoch={epoch}/> : view === 'create' ? <Create church={churchId}/> : <>
        <ResourceAccess permissionCode="TASK_CREATE" resourceType="CHURCH" resourceId={churchId} optional><p><Link to={`${route(churchId)}/nova`}>Criar tarefa</Link></p></ResourceAccess>
        <ResourceAccess permissionCode="TASK_VIEW" resourceType="CHURCH" resourceId={churchId} preserveDuringRecheck>
          {detail ? <Detail id={taskId} actor={account.id} church={churchId} epoch={epoch}/> : <List actor={account.id} church={churchId} epoch={epoch}/>}
        </ResourceAccess>
      </>}
    </div>}
  </div>
}
