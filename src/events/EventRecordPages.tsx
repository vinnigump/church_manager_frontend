import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { editableRecord, listRecords, readRecord, saveRecord, type EventRecord } from './record-api'
import { changeOffset, fieldsForRecord, recordInput, visibilityLabel, type RecordFields } from './record-form'
import RecordForm from './RecordForm'
import EventAgenda from './EventAgenda'
import { readAgendaReference } from './agenda-api'
import { recordRoute, recordSearch, recordStatusLabel } from './record-presentation'
import './occurrences.css'
import './records.css'
import './stitch-events.css'

function Dates({ value, timeZone }: { value: EventRecord; timeZone: string }) {
  const display = (instant: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone }).format(new Date(instant))
  return <p>Início: <time dateTime={value.startsAt}>{display(value.startsAt)}</time> · Término: <time dateTime={value.endsAt}>{display(value.endsAt)}</time> ({timeZone})</p>
}
function List({ church }: { church: string }) {
  const [search, setSearch] = useSearchParams(), rawPage = search.get('page')
  const page = rawPage && /^\d+$/.test(rawPage) && Number(rawPage) <= 100000 ? Number(rawPage) : 0
  const setPage = (value: number) => { const next = new URLSearchParams(search); next.set('page', String(value)); setSearch(next) }
  const load = useCallback(async (signal: AbortSignal) => {
    const [data, reference] = await Promise.all([listRecords(church, page, signal), readAgendaReference(church, signal)])
    return { ...data, timeZone: reference.timeZone }
  }, [church, page])
  const query = useRead(`${church}:${page}`, load)
  return <ReadResult query={query} label="eventos">{data => <>
    <p role="status">{data.total} eventos · Página {page + 1}</p>
    {data.items.length ? <ul className="event-list">{data.items.map(v => <li key={v.id} className="record-list-item"><div className="record-date-tile" aria-hidden="true"><strong>{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: data.timeZone }).format(new Date(v.startsAt))}</strong><span>{new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: data.timeZone }).format(new Date(v.startsAt))}</span></div><div className="record-list-content">
      <span className="record-badge">{recordStatusLabel(v.status)}</span><h2>{v.name}</h2><Dates value={v} timeZone={data.timeZone}/>
      <p>{v.location ?? 'Local ainda não informado'}</p><Link to={`${recordRoute(church)}/${v.id}${recordSearch(search)}`}>Ver evento {v.name}</Link></div>
    </li>)}</ul> : <p>Nenhum evento cadastrado.</p>}
    <Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos eventos"/>
  </>}</ReadResult>
}
function AgendaWorkspace({ church }: { church: string }) {
  const [search] = useSearchParams()
  return <><ResourceAccess permissionCode="EVENT_CREATE" resourceType="CHURCH" resourceId={church} optional>
    <p className="record-create-action"><Link className="record-primary" to={`${recordRoute(church)}/novo${recordSearch(search)}`}>Criar evento</Link></p>
  </ResourceAccess><EventAgenda church={church} list={<List church={church}/>}/></>
}
function Detail({ church, id }: { church: string; id: string }) {
  const [search] = useSearchParams()
  const load = useCallback(async (signal: AbortSignal) => {
    const [value, reference] = await Promise.all([readRecord(church, id, signal), readAgendaReference(church, signal)])
    return { value, timeZone: reference.timeZone }
  }, [church, id])
  const query = useRead(`${church}:${id}`, load)
  return <ReadResult query={query} label="evento">{({ value: v, timeZone }) => <article className="record-panel">
    <span className="record-badge">{recordStatusLabel(v.status)}</span><h2>{v.name}</h2><Dates value={v} timeZone={timeZone}/>
    <dl><dt>Local</dt><dd>{v.location ?? 'Não informado'}</dd>
      <dt>Modalidade</dt><dd>{v.modality ? { IN_PERSON: 'Presencial', ONLINE: 'Online', HYBRID: 'Híbrido' }[v.modality] : 'Não informada'}</dd>
      <dt>Participação</dt><dd>{v.participationMode === 'OPEN_EVENT' ? 'Entrada livre, sem inscrição' : v.participationMode === 'REGISTRATION_REQUIRED' ? 'Com inscrição' : 'Não informada'}</dd>
      <dt>Check-in obrigatório</dt><dd>{v.checkInRequired === null ? 'Não informado' : v.checkInRequired ? 'Sim' : 'Não'}</dd>
      <dt>Capacidade</dt><dd>{v.capacity === null ? 'Sem limite' : v.capacity}</dd>
      <dt>Público</dt><dd>{v.audience ? visibilityLabel[v.audience.visibility] : 'Ainda não configurado'}</dd>
    </dl>
    {v.draft && <p>Este rascunho fica oculto para os participantes.</p>}
    {editableRecord(v) ? <ResourceAccess permissionCode="EVENT_EDIT" resourceType="CHURCH" resourceId={church} optional>
      <Link to={`${recordRoute(church)}/${id}/editar${recordSearch(search)}`}>Editar evento</Link>
      <Link to={`/eventos/igrejas/${church}/ocorrencias/${id}/inscricao-publica`}>Inscrição sem cadastro prévio</Link>
    </ResourceAccess> : <p>Este estado não permite alterações por este cadastro.</p>}
    {v.participationMode === 'REGISTRATION_REQUIRED' && <section><h3>Inscrições</h3><p>Salvar o evento não abre inscrições automaticamente. O período e os demais requisitos continuam sendo verificados.</p>
      <Link to={`/eventos/igrejas/${church}/ocorrencias/${id}/janela-inscricao?retorno=cadastro${recordSearch(search).replace('?', '&')}`}>Consultar período de inscrição</Link>
    </section>}
    {v.participationMode === 'REGISTRATION_REQUIRED' && v.checkInRequired && <ResourceAccess permissionCode="EVENT_ATTENDANCE_MANAGE" resourceType="CHURCH" resourceId={church} optional>
      <p><Link to={`/eventos/igrejas/${church}/ocorrencias/${id}/check-in${recordSearch(search)}`}>Conferir presença dos participantes</Link></p>
    </ResourceAccess>}
  </article>}</ReadResult>
}
interface Draft { before: EventRecord | null; fields: RecordFields }
interface EditorControl {
  draft: Draft | null; observe: (before: EventRecord | null) => void; busy: boolean; blocked: boolean
  change: (fields: RecordFields) => void; offset: (value: string) => void; save: (draft: boolean) => void; epoch: number
}
function EditorData({ church, id, control }: { church: string; id?: string; control: EditorControl }) {
  const { observe } = control
  const load = useCallback(async (signal: AbortSignal) => {
    const before = id ? await readRecord(church, id, signal) : null
    if (!signal.aborted) observe(before)
    return before
  }, [church, id, observe])
  const query = useRead(`${church}:${id}:${control.epoch}`, load)
  return <ReadResult query={query} label="cadastro">{current => {
    if (current && !editableRecord(current)) return <p role="alert">O estado do evento não permite edição por este cadastro.</p>
    if (!control.draft) return <p role="status">Preparando cadastro…</p>
    const stale = current !== null && current.revision !== control.draft.before?.revision
    return <>{stale && <p role="alert">O evento mudou. Descarte as alterações e recarregue antes de salvar.</p>}
      <RecordForm church={church} before={control.draft.before} fields={control.draft.fields} change={control.change} offset={control.offset}
        busy={control.busy} blocked={control.blocked || stale} onSave={control.save}/>
    </>
  }}</ReadResult>
}
function Editor({ church, id }: { church: string; id?: string }) {
  const [search] = useSearchParams()
  // Draft and command lock live above guards; focus reauthorization cannot reset them.
  const [draft, setDraft] = useState<Draft | null>(null), [epoch, setEpoch] = useState(0), [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [message, setMessage] = useState(''), [saved, setSaved] = useState<EventRecord | null>(null)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  useEffect(() => { const refresh = () => setEpoch(v => v + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [])
  const observe = useCallback((before: EventRecord | null) => setDraft(v => v ?? { before, fields: fieldsForRecord(before) }), [])
  const change = (fields: RecordFields) => { if (!pending.current && !blocked && !saved) setDraft(v => v && ({ ...v, fields })) }
  const offset = (value: string) => { if (draft) change(changeOffset(draft.fields, value)) }
  async function save(asDraft: boolean) {
    if (!draft || pending.current || blocked || saved) return
    let input
    try { input = recordInput(draft.fields, asDraft, draft.before) } catch (e) { setMessage(e instanceof Error ? e.message : 'Revise os dados.'); return }
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('')
    try {
      const v = await saveRecord(church, input, draft.before, controller.signal)
      if (!controller.signal.aborted) { setSaved(v); setMessage(v.draft ? 'Rascunho salvo.' : `Evento salvo: ${recordStatusLabel(v.status)}.`) }
    } catch (e) {
      if (!controller.signal.aborted) { setBlocked(true); setMessage(`${e instanceof ApiError ? e.message : 'Não foi possível confirmar a gravação.'} ${id ? 'Recarregue e confira os dados antes de tentar novamente.' : 'Confira a lista de eventos antes de iniciar outro cadastro; o evento pode ter sido salvo.'}`) }
    } finally { if (pending.current === controller) pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  return <ResourceAccess key={attempt} permissionCode={id ? 'EVENT_EDIT' : 'EVENT_CREATE'} resourceType="CHURCH" resourceId={church} preserveDuringRecheck>
    {message && <p role={saved ? 'status' : 'alert'}>{message}</p>}
    {busy && <p role="status" aria-busy="true">Salvando evento…</p>}
    {saved ? <ResourceAccess permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={church} optional fallback={<p>Cadastro concluído.</p>}>
      <Link to={`${recordRoute(church)}/${saved.id}${recordSearch(search)}`}>Ver evento salvo</Link>
    </ResourceAccess> : <>
      <button type="button" disabled={busy} onClick={() => { setDraft(null); setBlocked(false); setMessage(''); setAttempt(v => v + 1); setEpoch(v => v + 1) }}>Descartar alterações e recarregar</button>
      <EditorData church={church} id={id} control={{ draft, observe, busy, blocked, change, offset, save, epoch }}/>
    </>}
  </ResourceAccess>
}
export default function EventRecordPages({ view }: { view: 'list' | 'detail' | 'create' | 'edit' }) {
  const { churchId = '', recordId = '' } = useParams(), { account } = useAuth()
  const [search] = useSearchParams()
  const [session, setSession] = useState({ account, epoch: 0 })
  // A new login object, even for the same account, starts a new UI scope.
  if (session.account !== account) { setSession({ account, epoch: session.epoch + 1 }); return null }
  const title = { list: 'Eventos da igreja', detail: 'Detalhes do evento', create: 'Criar evento', edit: 'Editar evento' }[view]
  const valid = isUuid(churchId) && (view === 'list' || view === 'create' || isUuid(recordId))
  return <div className={`occurrences records records-${view}`}><header className="record-page-heading"><p className="record-eyebrow">Agenda eclesiástica</p><h1 data-page-title={title}>{title}</h1><p>{view === 'list' ? 'Gestão da agenda de cultos, encontros e reuniões ministeriais.' : view === 'detail' ? 'Informações e participação no evento.' : 'Organize as informações, a participação e o público do evento.'}</p></header>
    <nav aria-label="Navegação dos eventos"><Link to="/eventos">Minhas igrejas</Link>
      {valid && <ResourceAccess permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId} optional><Link to={`${recordRoute(churchId)}${recordSearch(search)}`}>Todos os eventos</Link></ResourceAccess>}
    </nav>
    {!valid ? <p role="alert">O acesso ao evento é inválido. Volte a Eventos e escolha sua igreja.</p> : <div key={`${session.epoch}:${churchId}:${recordId}:${view}`}>
      {view === 'create' || view === 'edit' ? <Editor church={churchId} id={view === 'edit' ? recordId : undefined}/> :
        <ResourceAccess permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId} preserveDuringRecheck>
          {view === 'list' ? <AgendaWorkspace church={churchId}/> : <Detail church={churchId} id={recordId}/>}
        </ResourceAccess>}
    </div>}
  </div>
}
