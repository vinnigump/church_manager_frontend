import { DefaultChurchAccess, ChurchSwitchLink } from '../church-context'
import { formatDateTime } from '../time'
import '../membership/membership-visual.css'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess, consultAuthorization } from '../authorization'
import { discoverResources } from '../AuthorizedResources'
import { ContextOperation } from '../components/ContextOperation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { isUuid } from '../validation'
import { listRosters, markRosterPresence, readRoster, saveRoster, type Roster } from './roster-api'
import { fieldsFor, writeFor, type Fields } from './roster-fields'
import RosterForm from './RosterForm'
import OwnServiceRosters, { RosterDates } from './OwnServiceRosters'
import './rosters.css'

export const rosterRoute = (church: string) => `/ministerios/igrejas/${church}/escalas`
function Access() {
  const [params] = useSearchParams(), creating = params.get('acao') === 'criar'
  const { account } = useAuth(), [epoch, setEpoch] = useState(0)
  const load = useCallback(async (_context: string, signal: AbortSignal) => {
    if (!account) return []
    const churches = (await discoverResources(signal)).filter(v => v.resourceType === 'CHURCH')
    const rows = await Promise.all(churches.map(async v => {
      const permission = (permissionCode: string) => consultAuthorization({ permissionCode, resourceType: 'CHURCH', resourceId: v.resourceId }, signal)
      const [canView, canManage] = await Promise.all([permission('SERVICE_ROSTER_VIEW'), permission('SERVICE_ROSTER_MANAGE')]); return { ...v, canView, canManage }
    }))
    return rows.filter(v => creating ? v.canManage : v.canView || v.canManage)
  }, [account, creating])
  useEffect(() => { const refresh = () => setEpoch(v => v + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [])
  return <><button type="button" onClick={() => setEpoch(v => v + 1)}>Atualizar acessos às escalas</button><ContextOperation contextId={String(epoch)} operation={load}>{state => {
    if (state.kind === 'loading') return <p role="status">Consultando seus acessos…</p>
    if (state.kind === 'error') return <p role="alert">Não foi possível consultar seus acessos às escalas.</p>
    return state.data.length ? <DefaultChurchAccess options={state.data.map(v => ({ churchId: v.resourceId, path: !creating && v.canView ? rosterRoute(v.resourceId) : `${rosterRoute(v.resourceId)}/nova` }))}><ul>{state.data.map(v => <li key={v.resourceId}><h2>{v.label}</h2>
      {v.canView && !creating && <p><Link to={rosterRoute(v.resourceId)}>Consultar escalas de {v.label}</Link></p>}
      {v.canManage && <p><Link to={`${rosterRoute(v.resourceId)}/nova`}>Criar escala em {v.label}</Link></p>}
    </li>)}</ul></DefaultChurchAccess> : <p>Você ainda não tem acesso à gestão de escalas. Suas próprias atuações continuam em Minhas escalas.</p>
  }}</ContextOperation></>
}
function List({ church }: { church: string }) {
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listRosters(church, page, signal), [church, page])
  const query = useRead(`${church}:${page}`, load)
  return <ReadResult query={query} label="escalas">{data => <>
    <p role="status">{data.total} escalas · Página {page + 1}</p>
    {data.items.length ? <ul className="event-list">{data.items.map(v => <li key={v.id}><h2>{v.departmentName ?? v.ministryName}</h2>
      <RosterDates value={v}/><p>{v.participants.length} pessoas previstas</p>
      {v.eventId && <p>{v.eventName ? `Evento: ${v.eventName}` : 'Atuação vinculada a evento restrito'}</p>}
      <Link to={`${rosterRoute(church)}/${v.id}`}>Ver escala de {v.departmentName ?? v.ministryName}</Link>
    </li>)}</ul> : <p>Nenhuma escala cadastrada.</p>}
    <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das escalas"/>
  </>}</ReadResult>
}
function Detail({ church, id }: { church: string; id: string }) {
  const [epoch, setEpoch] = useState(0), [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [message, setMessage] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const load = useCallback((signal: AbortSignal) => readRoster(church, id, signal), [church, id])
  const query = useRead(`${church}:${id}:${epoch}`, load)
  async function mark(before: Roster, account: string) {
    if (pending.current || blocked) return
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('')
    try { await markRosterPresence(church, before, account, controller.signal); if (!controller.signal.aborted) { setMessage('Presença manual registrada.'); setEpoch(v => v + 1) } }
    catch (e) { if (!controller.signal.aborted) { setBlocked(true); setMessage(`${e instanceof ApiError ? e.message : 'Não foi possível confirmar a presença.'} Atualize antes de tentar novamente.`) } }
    finally { if (pending.current === controller) pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  return <>{message && <p role="status">{message}</p>}{busy && <p role="status" aria-busy="true">Registrando presença…</p>}
    <button type="button" disabled={busy} onClick={() => { setBlocked(false); setEpoch(v => v + 1) }}>Recarregar escala</button>
    <ReadResult query={query} label="escala">{v => <article><h2>{v.departmentName ? `${v.departmentName} · ${v.ministryName}` : v.ministryName}</h2>
      <RosterDates value={v}/>{v.eventId && <p>{v.eventName ? `Evento associado: ${v.eventName}` : 'Atuação vinculada a evento restrito'}</p>}
      <p>Registro manual de atuação. Não movimenta crachá nem realiza check-in como participante de evento.</p>
      {!v.participants.some(p => p.present) ? <ResourceAccess permissionCode="SERVICE_ROSTER_MANAGE" resourceType="CHURCH" resourceId={church} optional>
        <Link to={`${rosterRoute(church)}/${id}/editar`}>Editar escala</Link>
      </ResourceAccess> : <p>Há presença registrada. Correção e alteração da previsão não estão disponíveis neste cadastro.</p>}
      <ul>{v.participants.map(p => <li key={p.accountId}><h3>{p.displayName}</h3>
        {p.present ? <p>Presença registrada manualmente em <time dateTime={p.recordedAt!}>{formatDateTime(p.recordedAt!)}</time>.</p> : <>
          <p>Presença ainda não registrada</p><ResourceAccess permissionCode="SERVICE_ROSTER_ATTENDANCE" resourceType="CHURCH" resourceId={church} optional>
            <button type="button" disabled={busy || blocked} onClick={() => void mark(v, p.accountId)}>Registrar presença de {p.displayName}</button>
          </ResourceAccess>
        </>}
      </li>)}</ul>
    </article>}</ReadResult>
  </>
}
function RosterReadAccess({ church, children }: { church: string; children: ReactNode }) {
  return <ResourceAccess permissionCode="SERVICE_ROSTER_MANAGE" resourceType="CHURCH" resourceId={church} optional preserveDuringRecheck
    fallback={<ResourceAccess permissionCode="SERVICE_ROSTER_VIEW" resourceType="CHURCH" resourceId={church} preserveDuringRecheck>{children}</ResourceAccess>}>
    {children}
  </ResourceAccess>
}
interface Draft { before: Roster | null; fields: Fields }
function EditorData({ church, id, draft, observe, change, submit, disabled }: {
  church: string; id?: string; draft: Draft | null; observe: (value: Roster | null) => void; change: (fields: Fields) => void; submit: (e: FormEvent) => void; disabled: boolean
}) {
  const load = useCallback(async (signal: AbortSignal) => { const value = id ? await readRoster(church, id, signal) : null; if (!signal.aborted) observe(value); return value }, [church, id, observe])
  const query = useRead(`${church}:${id}`, load)
  return <ReadResult query={query} label="cadastro de escala">{current => {
    if (!draft) return <p role="status">Preparando escala…</p>
    if (current?.participants.some(p => p.present)) return <p role="alert">Há presença registrada. A escala não pode ser alterada por este cadastro.</p>
    const stale = current !== null && current.revision !== draft.before?.revision
    return <>{stale && <p role="alert">A escala mudou. Descarte as alterações e recarregue.</p>}<RosterForm church={church} fields={draft.fields} change={change} submit={submit} disabled={disabled || stale}/></>
  }}</ReadResult>
}
function Editor({ church, id }: { church: string; id?: string }) {
  const [draft, setDraft] = useState<Draft | null>(null), [epoch, setEpoch] = useState(0), [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [message, setMessage] = useState(''), [saved, setSaved] = useState<Roster | null>(null)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const observe = useCallback((value: Roster | null) => setDraft(d => d ?? { before: value, fields: fieldsFor(value) }), [])
  const change = (fields: Fields) => { if (!pending.current && !blocked && !saved) setDraft(d => d && ({ ...d, fields })) }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!draft || pending.current || blocked || saved) return
    let input
    try { input = writeFor(draft.fields, draft.before) } catch (e) { setMessage(e instanceof Error ? e.message : 'Revise os dados da escala.'); return }
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('')
    try { const v = await saveRoster(church, input, draft.before, controller.signal); if (!controller.signal.aborted) { setSaved(v); setMessage('Escala salva.') } }
    catch (e) { if (!controller.signal.aborted) { setBlocked(true); setMessage(`${e instanceof ApiError ? e.message : 'Não foi possível confirmar a gravação.'} Confira as escalas antes de repetir a operação.`) } }
    finally { if (pending.current === controller) pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  return <ResourceAccess key={epoch} permissionCode="SERVICE_ROSTER_MANAGE" resourceType="CHURCH" resourceId={church} preserveDuringRecheck>
    {message && <p role={saved ? 'status' : 'alert'}>{message}</p>}{busy && <p role="status" aria-busy="true">Salvando escala…</p>}
    {saved ? <Link to={`${rosterRoute(church)}/${saved.id}`}>Ver escala salva</Link> : <>
      <button type="button" disabled={busy} onClick={() => { setDraft(null); setBlocked(false); setMessage(''); setEpoch(v => v + 1) }}>Descartar alterações e recarregar escala</button>
      <EditorData key={epoch} church={church} id={id} draft={draft} observe={observe} change={change} submit={submit} disabled={busy || blocked}/>
    </>}
  </ResourceAccess>
}
export default function RosterPages({ view }: { view: 'access' | 'list' | 'detail' | 'create' | 'edit' | 'own' }) {
  const { churchId = '', rosterId = '' } = useParams(), { account } = useAuth()
  const [scope, setScope] = useState({ account, epoch: 0 })
  if (scope.account !== account) { setScope({ account, epoch: scope.epoch + 1 }); return null }
  const valid = view === 'access' || view === 'own' || isUuid(churchId) && (view === 'list' || view === 'create' || isUuid(rosterId))
  const title = { access: 'Escalas', list: 'Escalas da igreja', detail: 'Detalhes da escala', create: 'Criar escala', edit: 'Editar escala', own: 'Minhas escalas' }[view]
  return <div className="occurrences rosters ministry-visual"><h1 data-page-title={title}>{title}</h1><nav className="ministry-tabs" aria-label="Navegação de escalas"><Link to="/ministerios">Ministérios</Link><Link to="/ministerios/escalas">Gestão de escalas</Link><Link to="/minhas-escalas">Minhas escalas</Link></nav>
    {!valid ? <p role="alert">Acesso à escala inválido. Escolha novamente sua igreja.</p> : <div key={`${scope.epoch}:${churchId}:${rosterId}:${view}`}>
      {view === 'access' ? <Access/> : view === 'own' ? <OwnServiceRosters full/> : <>
        <p>{view === 'create' ? <Link to="/ministerios/escalas?acao=criar&selecionar=1">Trocar igreja</Link> : <ChurchSwitchLink to="/ministerios/escalas"/>}</p>
        <ResourceAccess permissionCode="SERVICE_ROSTER_VIEW" resourceType="CHURCH" resourceId={churchId} optional><p><Link to={rosterRoute(churchId)}>Listar escalas desta igreja</Link></p></ResourceAccess>
        <ResourceAccess permissionCode="SERVICE_ROSTER_MANAGE" resourceType="CHURCH" resourceId={churchId} optional><p><Link to={`${rosterRoute(churchId)}/nova`}>Criar escala</Link></p></ResourceAccess>
        {view === 'create' || view === 'edit' ? <Editor church={churchId} id={view === 'edit' ? rosterId : undefined}/> : view === 'list'
          ? <ResourceAccess permissionCode="SERVICE_ROSTER_VIEW" resourceType="CHURCH" resourceId={churchId} preserveDuringRecheck><List church={churchId}/></ResourceAccess>
          : <RosterReadAccess church={churchId}><Detail church={churchId} id={rosterId}/></RosterReadAccess>}
      </>}
    </div>}
  </div>
}
