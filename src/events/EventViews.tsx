import { useId, useState, type ReactNode } from 'react'
import { canDisplayAgenda, dateTime, localDate, type AgendaItem, type CatalogItem, type ChurchContext, type ViewState } from './presentation'
import './events.css'

function Result<T>({ state, children }: { state: ViewState<T>; children: (items: readonly T[]) => ReactNode }) {
  switch (state.kind) {
    case 'unavailable': return <p role="status">Eventos indisponíveis no momento. Tente novamente mais tarde.</p>
    case 'loading': return <p role="status">Carregando eventos…</p>
    case 'error': return <p role="alert">Não foi possível carregar os eventos. Tente novamente mais tarde.</p>
    case 'ready': return children(state.items)
  }
}

// Consumir somente dados previamente autorizados pelo backend. O filtro local é defesa
// de apresentação adicional, nunca prova de acesso. Não montar em rotas públicas.
export function EventCatalog({ church, state }: { church: ChurchContext; state: ViewState<CatalogItem> }) {
  const [origin, setOrigin] = useState('all')
  const id = useId()
  return <section className="events-panel" aria-labelledby={`${id}-title`} aria-busy={state.kind === 'loading'}>
    <h2 id={`${id}-title`}>Catálogo de eventos</h2><p>Igreja: {church.name}</p>
    <label htmlFor={`${id}-origin`}>Origem</label>{' '}
    <select id={`${id}-origin`} value={origin} onChange={event => setOrigin(event.target.value)}>
      <option value="all">Todas as origens</option><option value="denomination">Denominação</option><option value="local">Igreja local</option>
    </select>
    <Result state={state}>{items => {
      const visible = items.filter(item => item.churchId === church.id && (origin === 'all' || item.origin === origin))
      return visible.length ? <ul className="event-list">{visible.map(item => <li key={item.id}>
        <h3>{item.title}</h3><p>{item.origin === 'denomination' ? 'Denominacional · obrigatório no catálogo' : 'Exclusivo da igreja local'}</p>
        <p>Estado: {{ draft: 'Rascunho', published: 'Publicado', discontinued: 'Descontinuado' }[item.status]}</p>
      </li>)}</ul> : <p role="status">Nenhum tipo de evento para os filtros selecionados.</p>
    }}</Result>
  </section>
}

export function EventAgenda({ church, timeZone, state }: { church: ChurchContext; timeZone: string; state: ViewState<AgendaItem> }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const id = useId()
  const invalid = Boolean(start && end && start > end)
  return <section className="events-panel" aria-labelledby={`${id}-title`} aria-busy={state.kind === 'loading'}>
    <h2 id={`${id}-title`}>Agenda de eventos</h2><p>Igreja: {church.name} · Fuso horário: {timeZone}</p>
    <fieldset className="event-filters"><legend>Filtrar por período</legend>
      <label htmlFor={`${id}-start`}>Data inicial<input id={`${id}-start`} type="date" value={start} onChange={event => setStart(event.target.value)} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined}/></label>
      <label htmlFor={`${id}-end`}>Data final<input id={`${id}-end`} type="date" value={end} onChange={event => setEnd(event.target.value)} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined}/></label>
    </fieldset>
    {invalid ? <p id={`${id}-error`} role="alert">A data final deve ser igual ou posterior à inicial.</p> : <Result state={state}>{items => {
      const scoped = items.filter(item => item.churchId === church.id)
      if (!canDisplayAgenda(scoped, timeZone)) return <p role="alert">Não foi possível exibir a agenda: período ou fuso horário inválido. Atualize os dados.</p>
      const visible = scoped
        .filter(item => (!start || localDate(item.endsAt, timeZone) >= start) && (!end || localDate(item.startsAt, timeZone) <= end))
        .slice().sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      return visible.length ? <ol className="event-list">{visible.map(item => <li key={item.id}>
        <h3>{item.title}</h3><p><time dateTime={item.startsAt}>{dateTime(item.startsAt, timeZone)}</time> até <time dateTime={item.endsAt}>{dateTime(item.endsAt, timeZone)}</time></p>
        <p>Estado: {{ draft: 'Rascunho', published: 'Publicado', inProgress: 'Em andamento', completed: 'Concluído', cancelled: 'Cancelado' }[item.status]}</p>
        <p>{item.participation === 'open' ? 'Evento aberto · sem inscrição e sem presença individual' : `Com inscrição · ${item.checkInEnabled ? 'Check-in habilitado · único por ocorrência, inclusive em múltiplos dias' : 'Sem check-in'}`}</p>
      </li>)}</ol> : <p role="status">Nenhuma ocorrência para o período selecionado.</p>
    }}</Result>}
  </section>
}

export default function EventsPage() {
  return <><h1>Eventos</h1><p role="status">O calendário e a programação ainda não estão disponíveis.</p><p>Para consultar o catálogo autorizado, abra o acesso da sua igreja.</p></>
}
