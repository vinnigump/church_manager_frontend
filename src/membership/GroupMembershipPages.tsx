import { formatDateTime } from '../time'
import UiIcon from '../components/UiIcon'
import './membership-visual.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { ResourceAccess } from '../authorization'
import { useAuth } from '../auth'
import { isUuid } from '../validation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import GroupAccess from './GroupAccess'
import { groupRoute, isGroupKind, includeMinistryPerson, listEligibleMinistryPeople, readMinistryUnit, listGroupMembers, readGroupHistory, readGroupMembership, releaseGroupMember, type GroupContext, type GroupMembership, type GroupStatus, type EligiblePerson } from './group-api'
import '../events/occurrences.css'

function useRelease(context: GroupContext) {
  const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [message, setMessage] = useState(''), [failed, setFailed] = useState(false), [version, setVersion] = useState(0)
  const request = useRef<AbortController | null>(null), locked = useRef(false)
  useEffect(() => () => request.current?.abort(), [])
  async function run(before: GroupMembership, reason: string) {
    if (request.current || locked.current) return
    const controller = new AbortController(); request.current = controller; setBusy(true); setMessage(''); setFailed(false)
    try {
      await releaseGroupMember(context, before, reason, controller.signal)
      if (!controller.signal.aborted) { setMessage('Desvinculação confirmada. O histórico foi preservado.'); setVersion(v => v + 1) }
    } catch (error) {
      if (!controller.signal.aborted) { locked.current = true; setBlocked(true); setFailed(true); setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar a desvinculação.'} Atualize e confira o vínculo antes de tentar novamente.`) }
    } finally { request.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  async function include(person: EligiblePerson, reason: string) {
    if (request.current || locked.current) return
    const controller = new AbortController(); request.current = controller; setBusy(true); setMessage(''); setFailed(false)
    try {
      const value = await includeMinistryPerson(context, person, reason, controller.signal)
      if (!controller.signal.aborted) { setMessage(value.changed ? 'Integrante incluído.' : 'Esta pessoa já integra a unidade.'); setVersion(v => v + 1) }
    } catch (error) {
      if (!controller.signal.aborted) { locked.current = true; setBlocked(true); setFailed(true); setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar a inclusão.'} Atualize e confira os integrantes antes de tentar novamente.`) }
    } finally { request.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  function refresh() { if (request.current) return; locked.current = false; setBlocked(false); setMessage(''); setFailed(false); setVersion(v => v + 1) }
  return { busy, blocked, message, failed, version, run, include, refresh }
}
type Command = ReturnType<typeof useRelease>
function Release({ item, command }: { item: GroupMembership; command: Command }) {
  const [reason, setReason] = useState(''), [confirmation, setConfirmation] = useState<string | null>(null)
  if (item.status !== 'ACTIVE') return <p>Vínculo encerrado; histórico preservado. Novo ingresso exige outro vínculo.</p>
  return <section aria-label="Desvinculação direta"><h2>Registrar saída do grupo</h2>
    <p>Registre a saída comunicada fora da aplicação. Não há solicitação ou aprovação de saída neste fluxo.</p>
    <label>Motivo opcional<textarea maxLength={500} disabled={command.busy || command.blocked} value={reason} onChange={e => { setReason(e.target.value); setConfirmation(null) }}/></label>
    <p>O motivo fica no histórico autorizado. Não inclua documentos ou informações pessoais desnecessárias.</p>
    {confirmation === null ? <button disabled={command.busy || command.blocked} onClick={() => setConfirmation(reason)}>Revisar desvinculação</button> : <>
      <p>Confirmar saída de {item.displayName} desta unidade? A membresia formal, cargos, permissões, outros grupos e inscrições permanecem.</p>
      <button disabled={command.busy || command.blocked} onClick={() => void command.run(item, confirmation)}>Confirmar desvinculação</button>{' '}
      <button disabled={command.busy} onClick={() => setConfirmation(null)}>Voltar sem desvincular</button>
    </>}
  </section>
}
function List({ context, page, setPage, filter }: { context: GroupContext; page: number; setPage: (page: number) => void; filter?: GroupStatus }) {
  const load = useCallback((signal: AbortSignal) => listGroupMembers(context, filter, page, signal), [context, filter, page])
  const query = useRead(JSON.stringify([context, filter, page]), load)
  return <ReadResult query={query} label="vínculos do grupo">{data => <>
    <p>Página {data.page + 1} · {data.total} vínculos no filtro {filter === 'ACTIVE' ? 'ativos' : filter === 'INACTIVE' ? 'inativos' : 'todos, incluindo histórico'}.</p>
    {data.items.length ? <ul className="event-list ministry-members-list">{data.items.map(item => <li key={item.id}><span className="ministry-member-avatar"><UiIcon kind="account"/></span>
      <h2>{item.displayName}</h2><p>Estado {item.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}.</p>
      <p>Ingresso registrado em <time dateTime={item.linkedAt}>{formatDateTime(item.linkedAt)}</time>.</p>
      <Link to={`${groupRoute(context)}/${item.id}`}>Consultar vínculo de {item.displayName}</Link>
    </li>)}</ul> : <p>Nenhum vínculo nesta página e filtro.</p>}
    <Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos vínculos do grupo"/>
  </>}</ReadResult>
}
function Detail({ context, id, page, setPage, command }: { context: GroupContext; id: string; page: number; setPage: (page: number) => void; command: Command }) {
  const load = useCallback(async (signal: AbortSignal) => {
    const item = await readGroupMembership(context, id, signal)
    const history = await readGroupHistory(context, item, page, signal)
    return { item, history }
  }, [context, id, page])
  const query = useRead(JSON.stringify([context, id, page]), load)
  return <ReadResult query={query} label="vínculo e histórico">{({ item, history }) => <>
    <h2>{item.displayName}</h2><p>Estado {item.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}.</p>
    <p>Vinculado em {formatDateTime(item.linkedAt)} por {item.linkedByName ?? 'Equipe autorizada'}.</p>{item.releasedAt && <p>Desvinculado em {formatDateTime(item.releasedAt)} por {item.releasedByName ?? 'Equipe autorizada'}.</p>}
    <Release key={`${item.id}:${item.revision}`} item={item} command={command}/>
    <h2>Histórico autorizado</h2><p>Confira as entradas e saídas registradas para esta pessoa.</p>
    <p>Página {history.page + 1} · {history.total} registros.</p>
    {history.items.length ? <ol>{history.items.map(entry => <li key={entry.id}><h3>{entry.action === 'LINKED' ? 'Ingresso' : 'Saída registrada'}</h3><p>{entry.beforeStatus === 'ACTIVE' ? 'Ativo' : entry.beforeStatus === 'INACTIVE' ? 'Inativo' : 'Sem vínculo anterior'} → {entry.afterStatus === 'ACTIVE' ? 'Ativo' : 'Inativo'}.</p><p>{formatDateTime(entry.occurredAt)} · por {entry.actorName ?? 'Equipe autorizada'}.</p><p>Motivo: {entry.reason ?? 'Não informado'}</p></li>)}</ol> : <p>Nenhum registro de histórico nesta página.</p>}
    <Pagination page={page} total={history.total} setPage={setPage} label="Páginas do histórico do vínculo"/>
  </>}</ReadResult>
}
function Include({ context, command }: { context: GroupContext; command: Command }) {
  const [open, setOpen] = useState(false), [field, setField] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(0)
  const [selected, setSelected] = useState<EligiblePerson | null>(null), [reason, setReason] = useState('')
  const load = useCallback((signal: AbortSignal) => listEligibleMinistryPeople(context, search, page, signal), [context, search, page])
  return <section><button disabled={command.busy || command.blocked} onClick={() => setOpen(v => !v)}>{open ? 'Fechar inclusão de integrante' : 'Adicionar integrante'}</button>
    {open && <><h2>Escolher integrante</h2><form onSubmit={e => { e.preventDefault(); setSelected(null); setPage(0); setSearch(field) }}><fieldset disabled={command.busy || command.blocked}><label>Pesquisar membro pelo nome<input type="search" maxLength={120} value={field} onChange={e => setField(e.target.value)}/></label><button>Pesquisar membros</button></fieldset></form>
      <Eligible context={JSON.stringify([context, search, page])} load={load} page={page} setPage={setPage} select={setSelected} disabled={command.busy || command.blocked}/>
      {selected && <section><p>Adicionar {selected.displayName} a esta unidade?</p><label>Motivo da inclusão (opcional)<textarea maxLength={500} disabled={command.busy || command.blocked} value={reason} onChange={e => setReason(e.target.value)}/></label><button disabled={command.busy || command.blocked} onClick={() => void command.include(selected, reason)}>Confirmar inclusão de {selected.displayName}</button></section>}
    </>}
  </section>
}
function Eligible({ context, load, page, setPage, select, disabled }: { context: string; load: (signal: AbortSignal) => ReturnType<typeof listEligibleMinistryPeople>; page: number; setPage: (v: number) => void; select: (v: EligiblePerson) => void; disabled: boolean }) {
  const query = useRead(context, load)
  return <ReadResult query={query} label="membros disponíveis">{data => <fieldset disabled={disabled}><legend>Membros ativos disponíveis</legend>{data.items.length ? <ul>{data.items.map(v => <li key={v.personId}>{v.displayName} <button onClick={() => select(v)}>Selecionar {v.displayName}</button></li>)}</ul> : <p>Nenhum membro ativo disponível neste filtro.</p>}<Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos membros disponíveis"/></fieldset>}</ReadResult>
}
function WorkspaceData({ context, id, command }: { context: GroupContext; id?: string; command: Command }) {
  const [page, setPage] = useState(0), [field, setField] = useState<GroupStatus | ''>(''), [filter, setFilter] = useState<GroupStatus | undefined>()
  const load = useCallback((signal: AbortSignal) => readMinistryUnit(context, signal), [context]), query = useRead(JSON.stringify(context), load)
  return <>
    {command.message && <p role={command.failed ? 'alert' : 'status'}>{command.message}</p>}{command.busy && <p role="status" aria-busy="true">Registrando alteração…</p>}
    {(command.failed || query.state.kind === 'error') && <button disabled={command.busy} onClick={command.refresh}>Conferir dados</button>}
    {query.state.kind === 'loading' ? <p role="status">Carregando unidade…</p> : query.state.kind === 'error' ? <p role="alert">{query.state.message}</p> : <>
      <h2>{query.state.data.name}</h2><nav className="ministry-tabs" aria-label="Ações da unidade"><ResourceAccess permissionCode="MINISTRY_UNIT_MANAGE" resourceType="CHURCH" resourceId={context.churchId} optional><Link to={`/ministerios/estrutura/igrejas/${context.churchId}`}>Organizar departamentos</Link></ResourceAccess><ResourceAccess permissionCode="SERVICE_ROSTER_VIEW" resourceType="CHURCH" resourceId={context.churchId} optional><Link to={`/ministerios/igrejas/${context.churchId}/escalas`}>Escalas da igreja</Link></ResourceAccess><ResourceAccess permissionCode="TASK_VIEW" resourceType="CHURCH" resourceId={context.churchId} optional><Link to={`/tarefas/igrejas/${context.churchId}`}>Tarefas da igreja</Link></ResourceAccess></nav><p>{query.state.data.churchName}{context.kind === 'DEPARTMENT' && ` · Ministério ${query.state.data.ministryName}`}</p>{!query.state.data.active && <p>Unidade inativa. Consulte os vínculos e seu histórico.</p>}
      {id ? <><p><Link to={groupRoute(context)}>Voltar aos integrantes</Link></p><Detail context={context} id={id} page={page} setPage={setPage} command={command}/></> : <>
        {query.state.data.active && <Include context={context} command={command}/>}
        <form onSubmit={e => { e.preventDefault(); setPage(0); setFilter(field || undefined) }}><fieldset disabled={command.busy}><label>Estado do vínculo<select value={field} onChange={e => setField(e.target.value as GroupStatus | '')}><option value="">Todos</option><option value="ACTIVE">Ativos</option><option value="INACTIVE">Inativos</option></select></label><button>Aplicar filtro de vínculos</button></fieldset></form>
        <List context={context} page={page} setPage={setPage} filter={filter}/>
      </>}
    </>}
  </>
}
function Workspace({ context, id }: { context: GroupContext; id?: string }) {
  const command = useRelease(context)
  return <GroupAccess key={command.version} churchId={context.churchId}><WorkspaceData context={context} id={id} command={command}/></GroupAccess>
}
export default function GroupMembershipPages() {
  const { churchId = '', kind = '', groupId = '', membershipId } = useParams(); const { account } = useAuth()
  const [session, setSession] = useState({ account, epoch: 0 })
  if (session.account !== account) { setSession({ account, epoch: session.epoch + 1 }); return null }
  const valid = isUuid(churchId) && isGroupKind(kind) && isUuid(groupId) && (membershipId === undefined || isUuid(membershipId))
  // Remount the entire context, including pending commands, when route/account changes.
  const context = valid ? { churchId, kind, groupId } as GroupContext : null
  return <div className="occurrences ministry-visual"><h1 data-page-title="Integrantes">Integrantes do ministério ou departamento</h1><Link to="/">Voltar ao início</Link>
    {valid && <p><Link to={`/ministerios/igrejas/${churchId}`}>Voltar aos ministérios e departamentos</Link></p>}
    <p>Vínculo de grupo não concede cargo, permissão ou presença e não substitui membresia formal. O estado ativo não expira por data histórica.</p>
    {!context ? <p role="alert">O acesso ao grupo é inválido. Abra um contexto autorizado de ministério ou departamento.</p> : <Workspace key={`${session.epoch}:${churchId}:${kind}:${groupId}:${membershipId ?? ''}`} context={context} id={membershipId}/>}
  </div>
}
