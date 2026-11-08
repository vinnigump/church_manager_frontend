import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { listChurchCatalog } from './catalog-api'
import { editableOccurrence, listOccurrences, readOccurrence, saveOccurrence, validateOccurrenceWrite, type Modality, type Occurrence, type OccurrenceWrite, type Participation } from './occurrence-api'
import './events.css'
import './occurrences.css'
import { canRequestTransition, transitionPermission, type Transition } from './lifecycle-api'

export const occurrenceRoute = (churchId: string) => `/eventos/igrejas/${churchId}/ocorrencias`
const modalityLabel = (v: Occurrence['modality']) => v === null ? 'Não informada' : { IN_PERSON: 'Presencial', ONLINE: 'Online', HYBRID: 'Híbrido' }[v]
const participationLabel = (v: Occurrence['participationMode']) => v === null ? 'Não informado' : { REGISTRATION_REQUIRED: 'Inscrição obrigatória', OPEN_EVENT: 'Evento aberto' }[v]
function Dates({ value }: { value: Occurrence }) {
  return <p>Início: <time dateTime={value.startsAt}>{value.startsAt}</time><br/>Término: <time dateTime={value.endsAt}>{value.endsAt}</time></p>
}
function Details({ value }: { value: Occurrence }) {
  return <><Dates value={value}/><dl>
    <dt>Estado registrado</dt><dd>{value.status}</dd><dt>Configuração</dt><dd>{value.configured ? 'Informada' : 'Incompleta; valores legados preservados'}</dd>
    <dt>Tipo vinculado</dt><dd>{value.eventTypeId}</dd><dt>Versão vinculada</dt><dd>{value.eventTypeVersionId ?? 'Sem versão vinculada'}</dd>
    <dt>Modalidade</dt><dd>{modalityLabel(value.modality)}</dd><dt>Participação</dt><dd>{participationLabel(value.participationMode)}</dd>
    <dt>Check-in obrigatório</dt><dd>{value.checkInRequired === null ? 'Não informado' : value.checkInRequired ? 'Sim' : 'Não'}</dd>
    <dt>Capacidade</dt><dd>{value.capacity === null ? 'Ilimitada' : value.capacity < 0 ? `Valor legado inválido: ${value.capacity}` : value.capacity}</dd>
    <dt>Primeira publicação</dt><dd>{value.firstPublishedAt ?? 'Sem marco registrado'}</dd>
    <dt>Série vinculada</dt><dd>{value.recurrenceRuleId ?? 'Sem série vinculada'}</dd><dt>Revisão</dt><dd>{value.revision}</dd>
  </dl></>
}
function OccurrenceList({ churchId }: { churchId: string }) {
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listOccurrences(churchId, page, signal), [churchId, page])
  const query = useRead(`${churchId}:${page}`, load)
  return <><ResourceAccess permissionCode="EVENT_CREATE" resourceType="CHURCH" resourceId={churchId} optional><p><Link to={`${occurrenceRoute(churchId)}/nova`}>Criar rascunho de ocorrência</Link></p></ResourceAccess>
    <ReadResult query={query} label="ocorrências">{data => <><p role="status">Página {data.page + 1} · {data.total} ocorrências.</p>
      {data.items.length ? <ul className="event-list">{data.items.map(value => <li key={value.id}><h2>Ocorrência {value.id}</h2><p>Estado registrado: {value.status}</p><Dates value={value}/>
        {!value.configured && <p>Configuração incompleta; legado preservado.</p>}<Link to={`${occurrenceRoute(churchId)}/${value.id}`}>Consultar ocorrência {value.id}</Link></li>)}</ul> : <p>Nenhuma ocorrência nesta página.</p>}
      <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das ocorrências"/>
    </>}</ReadResult></>
}
function OccurrenceDetails({ churchId, id }: { churchId: string; id: string }) {
  const load = useCallback((signal: AbortSignal) => readOccurrence(churchId, id, signal), [churchId, id])
  const query = useRead(`${churchId}:${id}`, load)
  return <ReadResult query={query} label="ocorrência">{value => <><h2>Ocorrência {value.id}</h2><Details value={value}/>
    <p><Link to={`${occurrenceRoute(churchId)}/${id}/planejamento`}>Consultar espaço e sobreposições</Link></p>
    {(['unpublish', 'cancel', 'complete'] as Transition[]).filter(action => canRequestTransition(value, action)).map(action => <ResourceAccess key={action} permissionCode={transitionPermission[action]} resourceType="CHURCH" resourceId={churchId} optional><p><Link to={`${occurrenceRoute(churchId)}/${id}/transicoes/${action}`}>{{ unpublish: 'Despublicar ocorrência', cancel: 'Cancelar ocorrência', complete: 'Concluir ocorrência' }[action]}</Link></p></ResourceAccess>)}
    {editableOccurrence(value) ? <ResourceAccess permissionCode="EVENT_EDIT" resourceType="CHURCH" resourceId={churchId} optional><p><Link to={`${occurrenceRoute(churchId)}/${id}/planejamento/espaco`}>Configurar espaço do rascunho</Link></p><Link to={`${occurrenceRoute(churchId)}/${id}/editar`}>Editar rascunho</Link></ResourceAccess>
      : <p>A edição aceita somente rascunhos sem marco de primeira publicação.</p>}
  </>}</ReadResult>
}
interface Fields { eventTypeId: string; startsAt: string; endsAt: string; capacity: string; modality: string; participationMode: string; checkInRequired: string }
interface Draft { before: Occurrence | null; fields: Fields }
// Keep the exact original Instant (including microseconds) when a date field is unchanged.
const inputDate = (value: string) => new Date(value).toISOString().slice(0, 19)
const resolveDate = (value: string, before?: string) => before && value === inputDate(before) ? before : `${value.length === 16 ? `${value}:00` : value}Z`
const fieldsFor = (v: Occurrence | null): Fields => ({ eventTypeId: v?.eventTypeId ?? '', startsAt: v ? inputDate(v.startsAt) : '', endsAt: v ? inputDate(v.endsAt) : '',
  capacity: v?.capacity == null ? '' : String(v.capacity), modality: v?.modality ?? '', participationMode: v?.participationMode ?? '', checkInRequired: v?.checkInRequired == null ? '' : String(v.checkInRequired) })
function writeFor(draft: Draft): OccurrenceWrite {
  const f = draft.fields
  if (!f.modality || !f.participationMode || !['true', 'false'].includes(f.checkInRequired) || !f.startsAt || !f.endsAt
    || (f.capacity !== '' && !/^\d+$/.test(f.capacity))) throw new Error('Preencha todas as configurações explicitamente. Capacidade vazia significa ilimitada.')
  return validateOccurrenceWrite({ eventTypeId: f.eventTypeId, startsAt: resolveDate(f.startsAt, draft.before?.startsAt), endsAt: resolveDate(f.endsAt, draft.before?.endsAt),
    capacity: f.capacity === '' ? null : Number(f.capacity), modality: f.modality as Modality, participationMode: f.participationMode as Participation, checkInRequired: f.checkInRequired === 'true' })
}
function TypePicker({ churchId, draft, change, disabled }: { churchId: string; draft: Draft; change: (field: keyof Fields, value: string) => void; disabled: boolean }) {
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listChurchCatalog(churchId, page, signal), [churchId, page])
  const query = useRead(`${churchId}:${page}`, load)
  const fixed = draft.before?.recurrenceRuleId != null
  return <section aria-label="Tipo da ocorrência"><h3>Tipo da ocorrência</h3>
    <p>Escolha um tipo habilitado no catálogo da igreja. O servidor valida sua disponibilidade e vincula a versão aplicável.</p>
    {fixed && <p>O tipo de uma ocorrência vinculada a série não pode ser trocado por esta tela.</p>}
    <ReadResult query={query} label="tipos disponíveis">{data => <>
      <label>Tipo de evento<select required value={draft.fields.eventTypeId} disabled={disabled || fixed} onChange={e => change('eventTypeId', e.target.value)}>
        <option value="">Selecione explicitamente</option>
        {draft.fields.eventTypeId && !data.items.some(v => v.id === draft.fields.eventTypeId) && <option value={draft.fields.eventTypeId}>Tipo selecionado fora desta página: {draft.fields.eventTypeId} (disponibilidade a validar)</option>}
        {data.items.map(v => <option key={v.id} value={v.id} disabled={!v.enabled}>{v.name} · {v.scopeType === 'CHURCH' ? 'Local' : 'Denominacional'} · {v.enabled ? 'Habilitado' : 'Desabilitado'}</option>)}
      </select></label><p>Página {page + 1} · {data.total} tipos.</p>
      <Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos tipos da ocorrência"/>
    </>}</ReadResult>
  </section>
}
interface EditorControl { draft: Draft | null; initialize: (before: Occurrence | null) => void; change: (field: keyof Fields, value: string) => void; busy: boolean; blocked: boolean; submit: (e: FormEvent) => void }
function EditorRecords({ churchId, id, control }: { churchId: string; id?: string; control: EditorControl }) {
  const { initialize } = control
  const load = useCallback(async (signal: AbortSignal) => {
    const value = id ? await readOccurrence(churchId, id, signal) : null
    if (!signal.aborted) initialize(value)
    return value
  }, [churchId, id, initialize])
  const query = useRead(`${churchId}:${id}`, load)
  if (query.state.kind !== 'ready') return <ReadResult query={query} label="rascunho">{() => null}</ReadResult>
  const current = query.state.data
  const draft = control.draft
  if (!draft) return <p role="status">Preparando configuração…</p>
  if (current && !editableOccurrence(current)) return <><Details value={current}/><p role="alert">A ocorrência não é mais um rascunho editável.</p></>
  const stale = current !== null && current.revision !== draft.before?.revision
  return <>{stale && <p role="alert">A revisão mudou. Recarregue o rascunho e descarte as alterações locais antes de salvar.</p>}
    <form onSubmit={control.submit}><fieldset disabled={control.busy || control.blocked || stale}><legend>Configuração explícita do rascunho</legend>
      <TypePicker churchId={churchId} draft={draft} change={control.change} disabled={control.busy || control.blocked || stale}/>
      <p>Datas em UTC. Valores originais com microssegundos são preservados quando o campo não é alterado.</p>
      <label>Início (UTC)<input type="datetime-local" step="1" required value={draft.fields.startsAt} onChange={e => control.change('startsAt', e.target.value)}/></label>
      <label>Término (UTC)<input type="datetime-local" step="1" required value={draft.fields.endsAt} onChange={e => control.change('endsAt', e.target.value)}/></label>
      <label>Capacidade (vazia: ilimitada)<input type="number" min="0" max="2147483647" step="1" value={draft.fields.capacity} onChange={e => control.change('capacity', e.target.value)}/></label>
      <label>Modalidade<select required value={draft.fields.modality} onChange={e => control.change('modality', e.target.value)}><option value="">Selecione</option><option value="IN_PERSON">Presencial</option><option value="ONLINE">Online</option><option value="HYBRID">Híbrido</option></select></label>
      <label>Participação<select required value={draft.fields.participationMode} onChange={e => control.change('participationMode', e.target.value)}><option value="">Selecione</option><option value="REGISTRATION_REQUIRED">Inscrição obrigatória</option><option value="OPEN_EVENT">Evento aberto</option></select></label>
      <label>Check-in obrigatório<select required value={draft.fields.checkInRequired} onChange={e => control.change('checkInRequired', e.target.value)}><option value="">Selecione explicitamente</option><option value="false">Não</option><option value="true">Sim</option></select></label>
      <p>Evento aberto exige check-in “Não”. Salvar não publica nem abre inscrições. A versão vinculada é definida pelo servidor; manter o mesmo tipo conserva a versão anterior.</p>
      <button type="submit">{id ? 'Salvar rascunho' : 'Criar rascunho'}</button>
    </fieldset></form>
  </>
}
function EditorWorkspace({ churchId, id }: { churchId: string; id?: string }) {
  // Above both guards: focus must not release the command lock or erase dirty fields.
  const [draft, setDraft] = useState<Draft | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState<Occurrence | null>(null)
  const pending = useRef(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const initialize = useCallback((before: Occurrence | null) => setDraft(value => value ?? { before, fields: fieldsFor(before) }), [])
  const change = (field: keyof Fields, value: string) => setDraft(d => d && ({ ...d, fields: { ...d.fields, [field]: value } }))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (pending.current || blocked || saved || !draft) return
    let input: OccurrenceWrite
    try { input = writeFor(draft) } catch (error) { setMessage(error instanceof Error ? error.message : 'Revise a configuração.'); return }
    pending.current = true; setBusy(true); setMessage(''); controller.current = new AbortController()
    const signal = controller.current.signal
    try {
      const value = await saveOccurrence(churchId, input, draft.before, signal)
      if (!signal.aborted) { setSaved(value); setMessage('Rascunho salvo. Nenhuma publicação foi realizada.') }
    } catch (error) {
      if (!signal.aborted) { setBlocked(true); setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar a gravação.'} ${id ? 'Recarregue e confira os dados antes de nova tentativa.' : 'A ocorrência pode ter sido criada. Consulte a lista antes de iniciar outra criação.'}`) }
    } finally { pending.current = false; if (!signal.aborted) setBusy(false) }
  }
  return <ResourceAccess key={attempt} permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId}>
    <ResourceAccess permissionCode={id ? 'EVENT_EDIT' : 'EVENT_CREATE'} resourceType="CHURCH" resourceId={churchId}>
      {message && <p role={saved ? 'status' : 'alert'}>{message}</p>}{busy && <p role="status" aria-busy="true">Salvando rascunho…</p>}
      {saved ? <Link to={`${occurrenceRoute(churchId)}/${saved.id}`}>Consultar rascunho salvo</Link> : <>
        <button disabled={busy} onClick={() => { setDraft(null); setBlocked(false); setMessage(''); setAttempt(v => v + 1) }}>Recarregar rascunho e descartar alterações locais</button>
        <EditorRecords key={attempt} churchId={churchId} id={id} control={{ draft, initialize, change, busy, blocked, submit }}/>
      </>}
    </ResourceAccess>
  </ResourceAccess>
}
export default function OccurrencePages({ view }: { view: 'list' | 'detail' | 'create' | 'edit' }) {
  const { churchId = '', occurrenceId = '' } = useParams()
  const { account } = useAuth()
  const title = { list: 'Ocorrências administrativas', detail: 'Detalhes da ocorrência', create: 'Criar rascunho de ocorrência', edit: 'Editar rascunho de ocorrência' }[view]
  const valid = isUuid(churchId) && (view === 'list' || view === 'create' || isUuid(occurrenceId))
  return <div className="occurrences"><h1 data-page-title={title}>{title}</h1><Link to="/eventos">Voltar a Eventos</Link>
    <p>Consulta administrativa de todos os períodos. Não é a agenda pública nem um filtro do planejamento anual. Não inclui links de acesso ou participantes.</p>
    {!valid ? <p role="alert">O acesso às ocorrências é inválido. Abra novamente o acesso da sua igreja.</p> : <>
      <nav aria-label="Navegação das ocorrências"><Link to={occurrenceRoute(churchId)}>Listar ocorrências</Link><Link to={`/eventos/igrejas/${churchId}/catalogo`}>Catálogo da igreja</Link></nav>
      {view === 'create' || view === 'edit' ? <EditorWorkspace key={`${account?.id}:${churchId}:${occurrenceId}:${view}`} churchId={churchId} id={view === 'edit' ? occurrenceId : undefined}/> :
        <ResourceAccess permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId}><div key={`${account?.id}:${churchId}:${occurrenceId}:${view}`}>
          {view === 'list' ? <OccurrenceList churchId={churchId}/> : <OccurrenceDetails churchId={churchId} id={occurrenceId}/>}
        </div></ResourceAccess>}
    </>}
  </div>
}
