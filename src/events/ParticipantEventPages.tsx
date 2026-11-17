import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { isUuid } from '../validation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { confirmRegistration } from './participation-api'
import { eventChurches, ownEventRegistrations, ownOccurrenceOption, participantEvents, type PublicEvent } from './participant-events-api'
import './events.css'

const eventState = (value: string) => ({ AVAILABLE: 'Disponível', PUBLISHED: 'Disponível', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' }[value] ?? value)
const registrationState = (value: string) => ({ CONFIRMED: 'Confirmada', PENDING: 'Pendente', WAITLISTED: 'Em espera', CANCELLED: 'Cancelada' }[value] ?? value)
function Dates({ value }: { value: { startsAt: string; endsAt: string } }) { return <p><time dateTime={value.startsAt}>{new Date(value.startsAt).toLocaleString('pt-BR')}</time> até <time dateTime={value.endsAt}>{new Date(value.endsAt).toLocaleString('pt-BR')}</time> (horário deste dispositivo)</p> }

export function ParticipantEventAccess() {
  const { account } = useAuth()
  return <section className="events-panel"><h2>Participar dos eventos</h2><p><Link to="/minhas-inscricoes">Minhas inscrições</Link></p>
    {account && <Churches key={account.id}/>}
  </section>
}
function Churches() {
  const load = useCallback((signal: AbortSignal) => eventChurches(signal), []), query = useRead('own-event-churches', load)
  return <ReadResult query={query} label="igrejas para participar">{items => items.length ? <ul className="event-list">{items.map(church => <li key={church.churchId}>
    <h3>{church.name}</h3>{church.active ? <Link to={`/eventos/participar/igrejas/${church.churchId}`}>Consultar eventos de {church.name}</Link> : <p>Igreja indisponível para novas participações. Suas inscrições anteriores permanecem no histórico.</p>}
  </li>)}</ul> : <p>Não há igrejas associadas ao seu cadastro para consultar aqui.</p>}</ReadResult>
}
function Registration({ church, event }: { church: string; event: PublicEvent }) {
  const [epoch, setEpoch] = useState(0), [attempted, setAttempted] = useState(false), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [message, setMessage] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const load = useCallback((signal: AbortSignal) => ownOccurrenceOption(church, event.id, signal), [church, event.id])
  const query = useRead(JSON.stringify([church, event.id, epoch]), load)
  async function confirm() {
    if (attempted || pending.current || query.state.kind !== 'ready' || !query.state.data) return
    const controller = new AbortController(); pending.current = controller; setAttempted(true); setBusy(true); setMessage('')
    try { await confirmRegistration(church, event.id, null, controller.signal); if (!controller.signal.aborted) setDone(true) }
    catch (error) { if (!controller.signal.aborted) setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar o resultado.'} Consulte Minhas inscrições antes de outra tentativa; o registro pode ter sido realizado.`) }
    finally { pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  return <section aria-label={`Inscrição em ${event.name}`}>
    {done ? <p role="status">Inscrição confirmada pelo servidor. <Link to="/minhas-inscricoes">Consultar minhas inscrições</Link></p> : <>
      <ReadResult query={query} label="disponibilidade da inscrição">{option => option ? <><p>Confirme sua inscrição em {option.name}, com início em {new Date(option.startsAt).toLocaleString('pt-BR')}. Vagas e requisitos serão conferidos novamente.</p><button disabled={attempted || busy} onClick={() => void confirm()}>Confirmar minha inscrição neste evento</button></> : <p>Inscrição indisponível para seu cadastro ou fora do período. Se já se inscreveu, consulte Minhas inscrições.</p>}</ReadResult>
      {busy && <p role="status" aria-busy="true">Confirmando inscrição…</p>}{message && <p role="alert">{message} <Link to="/minhas-inscricoes">Minhas inscrições</Link></p>}
      {attempted && !busy && <button onClick={() => { setAttempted(false); setMessage(''); setEpoch(v => v + 1) }}>Consultar disponibilidade antes de tentar novamente</button>}
    </>}
    <p>Inscrição não comprova presença. A etapa de trilha exige o registro nominal de participação.</p>
  </section>
}
function Events({ church }: { church: string }) {
  const [page, setPage] = useState(0), [selected, setSelected] = useState<string | null>(null)
  const load = useCallback((signal: AbortSignal) => participantEvents(church, page, signal), [church, page]), query = useRead(`${church}:${page}`, load)
  return <ReadResult query={query} label="eventos disponíveis para você">{data => <>
    <p>{data.total} eventos · todos os períodos · página {page + 1}</p>
    {data.items.length ? <ul className="event-list">{data.items.map(event => <li key={event.id}>
      <h2>{event.name}</h2><Dates value={event}/><p>{event.location ?? 'Local ainda não informado'} · {eventState(event.status)}</p>
      {event.participationMode === 'OPEN_EVENT' ? <p>Entrada livre, sem inscrição e sem presença individual.</p> : <>
        <p>Com inscrição{event.checkInRequired ? ' e check-in de participante.' : '.'}</p>
        {['AVAILABLE', 'PUBLISHED'].includes(event.status) && <button onClick={() => setSelected(event.id)}>Consultar minha inscrição em {event.name}</button>}
        {selected === event.id && <Registration key={event.id} church={church} event={event}/>}
      </>}
    </li>)}</ul> : <p>Nenhum evento visível para você nesta página.</p>}
    <Pagination page={page} total={data.total} setPage={value => { setSelected(null); setPage(value) }} label="Páginas dos eventos para participar"/>
  </>}</ReadResult>
}
function History() {
  const [page, setPage] = useState(0), load = useCallback((signal: AbortSignal) => ownEventRegistrations(page, signal), [page]), query = useRead(`own-registrations:${page}`, load)
  return <ReadResult query={query} label="minhas inscrições">{data => <>
    <p>{data.total} inscrições · página {page + 1}</p>
    {data.items.length ? <ul className="event-list">{data.items.map(item => <li key={item.id}>
      <h2>{item.eventName}</h2><p>{item.churchName} · Inscrição {registrationState(item.status)}</p><Dates value={item}/>
      <p>Registrada em <time dateTime={item.registeredAt}>{new Date(item.registeredAt).toLocaleString('pt-BR')}</time>.</p>
      {item.taskInstanceId && <p>Inscrição vinculada a uma etapa da sua trilha.</p>}
      {item.presence ? <p>Presença registrada em <time dateTime={item.presence.checkedInAt}>{new Date(item.presence.checkedInAt).toLocaleString('pt-BR')}</time>{item.presence.validated ? '.' : ' · registro legado sem evidência validada.'}</p> : <p>Sem presença nominal registrada. A inscrição não comprova presença.</p>}
    </li>)}</ul> : <p>Nenhuma inscrição nesta página.</p>}
    <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das minhas inscrições"/>
  </>}</ReadResult>
}
export default function ParticipantEventPages({ view }: { view: 'events' | 'registrations' }) {
  const { churchId = '' } = useParams(), { account } = useAuth()
  return <div className="events-panel"><h1 data-page-title={view === 'events' ? 'Participar dos eventos' : 'Minhas inscrições'}>{view === 'events' ? 'Participar dos eventos' : 'Minhas inscrições'}</h1>
    <nav aria-label="Eventos do participante"><Link to="/eventos">Eventos</Link>{' · '}<Link to="/minhas-inscricoes">Minhas inscrições</Link></nav>
    {view === 'registrations' ? <><p>Seu histórico permanece disponível mesmo após mudança de igreja ou do público do evento.</p><History key={account?.id}/></>
      : !isUuid(churchId) ? <p role="alert">Igreja inválida. Abra novamente a lista de eventos.</p> : <Events key={`${account?.id}:${churchId}`} church={churchId}/>}
  </div>
}
