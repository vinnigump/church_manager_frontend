import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import UiIcon from '../components/UiIcon'
import { ReadResult, useRead } from '../security/SecurityPages'
import { instantNanos } from './occurrence-api'
import { ownUpcomingEvents, type UpcomingEvent } from './own-upcoming-api'

function EventCard({ value, reference }: { value: UpcomingEvent; reference: string }) {
  const format = (instant: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: value.timeZone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(instant))
  const start = new Date(value.startsAt)
  return <li><div className="home-event-date" aria-hidden="true"><strong>{new Intl.DateTimeFormat('pt-BR',{day:'2-digit',timeZone:value.timeZone}).format(start)}</strong><span>{new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:value.timeZone}).format(start)}</span></div>
    <div className="home-event-content"><span className="home-event-church">{value.churchName}</span><h3>{value.name}</h3>
    {instantNanos(value.startsAt) <= instantNanos(reference) && <p className="home-event-ongoing"><strong>Em andamento</strong></p>}
    <p className="home-event-meta"><UiIcon kind="events"/><span><time dateTime={value.startsAt}>{format(value.startsAt)}</time> até <time dateTime={value.endsAt}>{format(value.endsAt)}</time> ({value.timeZone})</span></p>
    <p>{value.location ?? 'Local ainda não informado'}</p><Link to={`/eventos/participar/igrejas/${value.churchId}`}>Calendário de {value.churchName}<UiIcon kind="arrow"/></Link></div>
  </li>
}
function Preview() {
  const [epoch, setEpoch] = useState(0), load = useCallback((signal: AbortSignal) => ownUpcomingEvents(signal), []), query = useRead(`home-upcoming:${epoch}`, load)
  useEffect(() => { const refresh = () => setEpoch(v => v + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [])
  return <section className="home-upcoming" aria-label="Próximos eventos"><h2>Próximos eventos</h2>
    <ReadResult query={query} label="próximos eventos">{data => <>
      {data.items.length ? <ol>{data.items.map(item => <EventCard key={item.id} value={item} reference={data.referenceAt}/>)}</ol> : <p>Nenhum evento em andamento ou futuro disponível para você.</p>}
      {data.hasMore && <p>Há mais eventos disponíveis nas suas igrejas.</p>}<p><Link to="/eventos">Consultar todos os eventos</Link></p>
    </>}</ReadResult>
  </section>
}
export default function OwnUpcomingEvents() {
  const { account } = useAuth(), [scope, setScope] = useState({ account, epoch: 0 })
  if (scope.account !== account) { setScope({ account, epoch: scope.epoch + 1 }); return null }
  return account ? <Preview key={scope.epoch}/> : null
}
