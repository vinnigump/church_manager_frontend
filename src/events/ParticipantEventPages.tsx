import { formatDateTime } from '../time'
import { eventDurationLabel } from './event-duration'
import { DefaultChurchAccess } from '../church-context'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { isUuid } from '../validation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { confirmRegistration } from './participation-api'
import { cancelOwnRegistration, eventChurches, ownEventRegistrations, ownOccurrenceOption, participantEvents, type OwnEventRegistration, type PublicEvent } from './participant-events-api'
import './events.css'
import './stitch-events.css'
import ItemLink from '../components/ItemLink'
import { ResourceAccess } from '../authorization'
import { participantEvent } from './participant-events-api'

const eventState = (value: string) => ({ AVAILABLE: 'Disponível', PUBLISHED: 'Disponível', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' }[value] ?? value)
const registrationState = (value: string) => ({ CONFIRMED: 'Confirmada', PENDING: 'Pendente', WAITLISTED: 'Em espera', CANCELLED: 'Cancelada' }[value] ?? value)
function Dates({ value }: { value: { startsAt: string; endsAt: string } }) { return <p><time dateTime={value.startsAt}>{formatDateTime(value.startsAt)}</time> · Duração: {eventDurationLabel(value.startsAt,value.endsAt)} (horário de Brasília)</p> }

export function ParticipantEventAccess() {
  const { account } = useAuth()
  const [scope, setScope] = useState({ account, epoch: 0 })
  if (scope.account !== account) { setScope({ account, epoch: scope.epoch + 1 }); return null }
  return <section className="events-panel"><h2>Participar dos eventos</h2><p><Link to="/minhas-inscricoes">Minhas inscrições</Link></p>
    {account && <Churches key={`${account.id}:${scope.epoch}`}/>}
  </section>
}
function Churches() {
  const load = useCallback((signal: AbortSignal) => eventChurches(signal), []), query = useRead('own-event-churches', load)
  return <ReadResult query={query} label="igrejas para participar">{items => items.length ? <DefaultChurchAccess auto={false} label="Ver eventos da minha igreja" options={items.filter(v => v.active).map(v => ({ churchId: v.churchId, path: `/eventos/participar/igrejas/${v.churchId}` }))}><ul className="event-list">{items.map(church => <li key={church.churchId}>
    <h3>{church.name}</h3>{church.active ? <Link to={`/eventos/participar/igrejas/${church.churchId}`}>Consultar eventos de {church.name}</Link> : <p>Igreja indisponível para novas participações. Suas inscrições anteriores permanecem no histórico.</p>}
  </li>)}</ul></DefaultChurchAccess> : <p>Não há igrejas associadas ao seu cadastro para consultar aqui.</p>}</ReadResult>
}
function Registration({ church, event, onBusyChange }: { church: string; event: PublicEvent; onBusyChange: (busy: boolean) => void }) {
  const [epoch, setEpoch] = useState(0), [attempted, setAttempted] = useState(false), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [message, setMessage] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const load = useCallback((signal: AbortSignal) => ownOccurrenceOption(church, event.id, signal), [church, event.id])
  const query = useRead(JSON.stringify([church, event.id, epoch]), load)
  async function confirm() {
    if (attempted || pending.current || query.state.kind !== 'ready' || !query.state.data) return
    const controller = new AbortController(); pending.current = controller; setAttempted(true); setBusy(true); onBusyChange(true); setMessage('')
    try { await confirmRegistration(church, event.id, null, controller.signal); if (!controller.signal.aborted) setDone(true) }
    catch (error) { if (!controller.signal.aborted) setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar o resultado.'} Consulte Minhas inscrições antes de outra tentativa; o registro pode ter sido realizado.`) }
    finally { pending.current = null; if (!controller.signal.aborted) { setBusy(false); onBusyChange(false) } }
  }
  return <section aria-label={`Inscrição em ${event.name}`}>
    {done ? <p role="status">Inscrição confirmada pelo servidor. <Link to="/minhas-inscricoes">Consultar minhas inscrições</Link></p> : <>
      <ReadResult query={query} label="disponibilidade da inscrição">{option => option ? <><p>Confirme sua inscrição em {option.name}, com início em {formatDateTime(option.startsAt)}. Vagas e requisitos serão conferidos novamente.</p><button disabled={attempted || busy} onClick={() => void confirm()}>Confirmar minha inscrição neste evento</button></> : <p>Inscrição indisponível para seu cadastro ou fora do período. Se já se inscreveu, consulte Minhas inscrições.</p>}</ReadResult>
      {busy && <p role="status" aria-busy="true">Confirmando inscrição…</p>}{message && <p role="alert">{message} <Link to="/minhas-inscricoes">Minhas inscrições</Link></p>}
      {attempted && !busy && <button onClick={() => { setAttempted(false); setMessage(''); setEpoch(v => v + 1) }}>Consultar disponibilidade antes de tentar novamente</button>}
    </>}
    <p>Inscrição não comprova presença. A etapa de trilha exige o registro nominal de participação.</p>
  </section>
}
function Events({ church }: { church: string }) {
  const [page, setPage] = useState(0), [selected, setSelected] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const load = useCallback((signal: AbortSignal) => participantEvents(church, page, signal), [church, page]), query = useRead(`${church}:${page}`, load)
  return <fieldset disabled={busy}><legend>Eventos da igreja</legend><ReadResult query={query} label="eventos disponíveis para você">{data => <>
    <p>{data.total} eventos · todos os períodos · página {page + 1}</p>
    {data.items.length ? <ul className="event-list">{data.items.map(event => <li key={event.id} className="navigation-card">
      <h2><ItemLink to={`/eventos/participar/igrejas/${church}/eventos/${event.id}`}>{event.name}</ItemLink></h2><Dates value={event}/><p>{event.location ?? 'Local ainda não informado'} · {eventState(event.status)}</p>
      {event.participationMode === 'OPEN_EVENT' ? <p>Entrada livre, sem inscrição e sem presença individual.</p> : <>
        <p>Com inscrição{event.checkInRequired ? ' e check-in de participante.' : '.'}</p>
        {['AVAILABLE', 'PUBLISHED'].includes(event.status) && <button onClick={() => setSelected(event.id)}>Consultar minha inscrição em {event.name}</button>}
        {selected === event.id && <Registration key={event.id} church={church} event={event} onBusyChange={setBusy}/>}
      </>}
    </li>)}</ul> : <p>Nenhum evento visível para você nesta página.</p>}
    <Pagination page={page} total={data.total} setPage={value => { setSelected(null); setPage(value) }} label="Páginas dos eventos para participar"/>
  </>}</ReadResult></fieldset>
}
function History() {
  const [page, setPage] = useState(0), [epoch, setEpoch] = useState(0), [selected, setSelected] = useState<OwnEventRegistration | null>(null)
  const [busy, setBusy] = useState(false), [attempted, setAttempted] = useState(false), [message, setMessage] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const load = useCallback((signal: AbortSignal) => ownEventRegistrations(page, signal), [page]), query = useRead(`own-registrations:${page}:${epoch}`, load)
  async function cancel() {
    if (!selected || attempted || pending.current) return
    const controller = new AbortController(); pending.current = controller; setBusy(true); setAttempted(true); setMessage('')
    try { await cancelOwnRegistration(selected, controller.signal); if (!controller.signal.aborted) { setSelected(null); setMessage('Inscrição cancelada pelo servidor. O histórico foi preservado e nenhuma etapa foi concluída ou dispensada.'); setEpoch(v => v + 1) } }
    catch (error) { if (!controller.signal.aborted) setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar o resultado.'} Consulte novamente antes de outra tentativa; o cancelamento pode ter sido registrado.`) }
    finally { pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  function reload() { if (pending.current) return; setSelected(null); setAttempted(false); setMessage(''); setEpoch(v => v + 1) }
  return <>{message && <p role="status">{message}</p>}{busy && <p role="status" aria-busy="true">Cancelando inscrição…</p>}
    <fieldset disabled={busy}><legend>Histórico de inscrições</legend><ReadResult query={{ ...query, refresh: reload }} label="minhas inscrições">{data => <>
    <p>{data.total} inscrições · página {page + 1}</p>
    {data.items.length ? <ul className="event-list">{data.items.map(item => <li key={item.id}>
      <h2>{item.eventName}</h2><p>{item.churchName} · Inscrição {registrationState(item.status)}</p><Dates value={item}/>
      <p>Registrada em <time dateTime={item.registeredAt}>{formatDateTime(item.registeredAt)}</time>.</p>
      {item.taskInstanceId && <p>Inscrição vinculada a uma etapa da sua trilha.</p>}
      {item.presence ? <p>Presença registrada em <time dateTime={item.presence.checkedInAt}>{formatDateTime(item.presence.checkedInAt)}</time>{item.presence.validated ? '.' : ' · registro legado sem evidência validada.'}</p> : <p>Sem presença nominal registrada. A inscrição não comprova presença.</p>}
      {item.cancellationAvailable && <button disabled={attempted} onClick={() => setSelected(item)}>Revisar cancelamento de {item.eventName}</button>}
    </li>)}</ul> : <p>Nenhuma inscrição nesta página.</p>}
    <Pagination page={page} total={data.total} setPage={value => { setSelected(null); setPage(value) }} label="Páginas das minhas inscrições"/>
    {selected && data.items.some(item => item.id === selected.id && item.cancellationAvailable) && <section aria-label="Confirmar cancelamento da inscrição"><h2>Cancelar minha inscrição em {selected.eventName}</h2>
      <p>O cancelamento libera sua vaga e preserva o histórico. Não conclui nem dispensa uma etapa da trilha. Reinscrição após cancelar não está disponível.</p>
      <button disabled={attempted} onClick={() => void cancel()}>Confirmar cancelamento da minha inscrição</button>{' '}<button onClick={() => setSelected(null)}>Voltar</button>
    </section>}
  </>}</ReadResult></fieldset></>
}
function ParticipantDetail({ church, id }: { church: string; id: string }) {
  const [busy,setBusy]=useState(false)
  const load=useCallback((signal:AbortSignal)=>participantEvent(church,id,signal),[church,id])
  const query=useRead(`${church}:${id}`,load)
  return <fieldset disabled={busy}><legend>Informações do evento</legend><ReadResult query={query} label="detalhe do evento">{event=><article className="record-panel">
    <h2>{event.name}</h2><Dates value={event}/><p>{event.location??'Local ainda não informado'}</p><p>{eventState(event.status)}</p>
    {event.participationMode==='OPEN_EVENT'?<p>Entrada livre, sem inscrição e sem presença individual.</p>:<>
      <p>Com inscrição{event.checkInRequired?' e check-in de participante.':'.'}</p>
      {['AVAILABLE','PUBLISHED'].includes(event.status)&&<fieldset disabled={busy}><legend>Minha inscrição</legend><Registration church={church} event={event} onBusyChange={setBusy}/></fieldset>}
    </>}
    <ResourceAccess permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={church} optional fallback={<Link to={`/eventos/participar/igrejas/${church}`}>Ver todos os eventos</Link>}>
      <Link to={`/eventos/igrejas/${church}/cadastro`}>Ver calendário completo</Link>
    </ResourceAccess>
  </article>}</ReadResult></fieldset>
}
export default function ParticipantEventPages({ view }: { view: 'events' | 'registrations' | 'detail' }) {
  const { churchId = '', occurrenceId = '' } = useParams(), { account } = useAuth()
  const [scope, setScope] = useState({ account, epoch: 0 })
  if (scope.account !== account) { setScope({ account, epoch: scope.epoch + 1 }); return null }
  const title=view==='detail'?'Detalhe do evento':view==='events'?'Participar dos eventos':'Minhas inscrições'
  return <div className="events-panel"><h1 data-page-title={title}>{title}</h1>
    <nav aria-label="Eventos do participante"><Link to="/eventos?selecionar=1" className="legacy-context-switch">Trocar igreja</Link>{' · '}<Link to="/minhas-inscricoes">Minhas inscrições</Link></nav>
    {view === 'registrations' ? <><p>Seu histórico permanece disponível mesmo após mudança de igreja ou do público do evento.</p><History key={`${account?.id}:${scope.epoch}`}/></>
      : !isUuid(churchId) || view==='detail'&&!isUuid(occurrenceId) ? <p role="alert">Acesso inválido. Abra novamente a lista de eventos.</p> : view==='detail'?<ParticipantDetail key={`${account?.id}:${scope.epoch}:${churchId}:${occurrenceId}`} church={churchId} id={occurrenceId}/>:<Events key={`${account?.id}:${scope.epoch}:${churchId}`} church={churchId}/>}
  </div>
}
