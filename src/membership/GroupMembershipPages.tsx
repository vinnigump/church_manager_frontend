import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { isUuid } from '../validation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import GroupAccess from './GroupAccess'
import { groupRoute, isGroupKind, listGroupMembers, readGroupHistory, readGroupMembership, releaseGroupMember, type GroupContext, type GroupMembership, type GroupStatus } from './group-api'
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
  function refresh() { if (request.current) return; locked.current = false; setBlocked(false); setMessage(''); setFailed(false); setVersion(v => v + 1) }
  return { busy, blocked, message, failed, version, run, refresh }
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
      <p>Confirmar saída da pessoa {item.personId} deste grupo na revisão {item.revision}? A membresia formal, cargos, permissões, outros grupos e inscrições permanecem.</p>
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
    {data.items.length ? <ul className="event-list">{data.items.map(item => <li key={item.id}>
      <h2>Pessoa {item.personId}</h2><p>Estado {item.status === 'ACTIVE' ? 'Ativo' : 'Inativo'} · revisão {item.revision}.</p>
      <p>Ingresso registrado em <time dateTime={item.linkedAt}>{item.linkedAt}</time>.</p>
      <Link to={`${groupRoute(context)}/${item.id}`}>Consultar vínculo {item.id}</Link>
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
    <h2>Vínculo {item.id}</h2><p>Pessoa {item.personId} · estado {item.status} · revisão consultada {item.revision}.</p>
    <p>Vinculado em {item.linkedAt} por {item.linkedBy}.</p>{item.releasedAt && <p>Desvinculado em {item.releasedAt} por {item.releasedBy}.</p>}
    <Release key={`${item.id}:${item.revision}`} item={item} command={command}/>
    <h2>Histórico autorizado</h2><p>Consulta de vínculo e histórico ocorre em pedidos separados; alterações concorrentes podem aparecer entre eles. O servidor revalida a revisão antes de desvincular.</p>
    <p>Página {history.page + 1} · {history.total} registros.</p>
    {history.items.length ? <ol>{history.items.map(entry => <li key={entry.id}><h3>{entry.action === 'LINKED' ? 'Ingresso' : 'Saída registrada'}</h3><p>{entry.beforeStatus ?? 'Sem estado anterior'} → {entry.afterStatus} · revisão {entry.revision}.</p><p>{entry.occurredAt} · ator {entry.actorId}.</p><p>Motivo: {entry.reason ?? 'Não informado'}</p></li>)}</ol> : <p>Nenhum registro de histórico nesta página.</p>}
    <Pagination page={page} total={history.total} setPage={setPage} label="Páginas do histórico do vínculo"/>
  </>}</ReadResult>
}
function Workspace({ context, id }: { context: GroupContext; id?: string }) {
  const [page, setPage] = useState(0), [field, setField] = useState<GroupStatus | ''>(''), [filter, setFilter] = useState<GroupStatus | undefined>()
  const command = useRelease(context)
  return <GroupAccess key={command.version} churchId={context.churchId}>
    <p>Igreja {context.churchId} · {context.kind === 'MINISTRY' ? 'Ministério' : 'Departamento'} {context.groupId}.</p>
    {command.message && <p role={command.failed ? 'alert' : 'status'}>{command.message}</p>}{command.busy && <p role="status" aria-busy="true">Registrando saída…</p>}
    <button disabled={command.busy} onClick={command.refresh}>Atualizar dados e reavaliar acesso</button>
    {id ? <><p><Link to={groupRoute(context)}>Voltar aos vínculos do grupo</Link></p><Detail context={context} id={id} page={page} setPage={setPage} command={command}/></> : <>
      <form onSubmit={e => { e.preventDefault(); setPage(0); setFilter(field || undefined) }}><label>Estado do vínculo<select value={field} onChange={e => setField(e.target.value as GroupStatus | '')}><option value="">Todos</option><option value="ACTIVE">Ativos</option><option value="INACTIVE">Inativos</option></select></label><button>Aplicar filtro de vínculos</button></form>
      <List context={context} page={page} setPage={setPage} filter={filter}/>
    </>}
  </GroupAccess>
}
export default function GroupMembershipPages() {
  const { churchId = '', kind = '', groupId = '', membershipId } = useParams(); const { account } = useAuth()
  const valid = isUuid(churchId) && isGroupKind(kind) && isUuid(groupId) && (membershipId === undefined || isUuid(membershipId))
  // Remount the entire context, including pending commands, when route/account changes.
  const context = valid ? { churchId, kind, groupId } as GroupContext : null
  return <div className="occurrences"><h1 data-page-title="Vínculos do grupo">Vínculos de participantes com o grupo</h1><Link to="/">Voltar ao início</Link>
    <p>Vínculo de grupo não concede cargo, permissão ou presença e não substitui membresia formal. O estado ativo não expira por data histórica.</p>
    {!context ? <p role="alert">O acesso ao grupo é inválido. Abra um contexto autorizado de ministério ou departamento.</p> : <Workspace key={`${account?.id}:${churchId}:${kind}:${groupId}:${membershipId ?? ''}`} context={context} id={membershipId}/>}
  </div>
}
