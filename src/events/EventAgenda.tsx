import { useCallback, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ReadResult, useRead } from '../security/SecurityPages'
import { addDays, civilDate, eventDateRange, readAgenda, zoneDate, type Agenda } from './agenda-api'
import { recordRoute, recordSearch, recordStatusLabel } from './record-presentation'
import type { EventRecord } from './record-api'
import './agenda.css'

const civilLabel = (date: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
function EventLink({ value, church, date, agenda, search }: { value: EventRecord; church: string; date: string; agenda: Agenda; search: string }) {
  const time = (value: string) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date(value))
  const continuing = zoneDate(value.startsAt, agenda.timeZone) < date
  return <li><Link aria-label={`Ver evento ${value.name}`} to={`${recordRoute(church)}/${value.id}${search}`}>{value.name}</Link>
    <p>{continuing ? 'Continuação' : time(value.startsAt)} · {recordStatusLabel(value.status)}</p>
    {value.location && <p>{value.location}</p>}
  </li>
}
function Calendar({ church, month }: { church: string; month: boolean }) {
  const [params, setParams] = useSearchParams(), rawDate = params.get('date')
  const date = civilDate(rawDate) ? rawDate : undefined, view = month ? 'MONTH' : 'WEEK'
  const load = useCallback((signal: AbortSignal) => readAgenda(church, view, date, signal), [church, view, date])
  const query = useRead(`${church}:${view}:${date}`, load)
  return <ReadResult query={query} label="agenda">{agenda => {
    const days: string[] = []
    for (let day = agenda.startsOn; day < agenda.endsOnExclusive; day = addDays(day, 1)) days.push(day)
    const selected = params.get('day'), day = selected && days.includes(selected) ? selected : days.includes(agenda.today) ? agenda.today : days[0]
    const navigate = (date?: string) => { const next = new URLSearchParams(params); next.delete('day'); if (date) next.set('date', date); else next.delete('date'); setParams(next) }
    const adjacent = (direction: number) => {
      if (!month) return addDays(agenda.anchorDate, direction * 7)
      const next = new Date(`${agenda.startsOn}T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + direction); return next.toISOString().slice(0, 10)
    }
    const returnParams = new URLSearchParams(params); returnParams.set('date', agenda.anchorDate); returnParams.set('view', month ? 'month' : 'week')
    const search = recordSearch(returnParams)
    const byDay = new Map(days.map(date => [date, [] as EventRecord[]]))
    for (const value of agenda.items) {
      const range = eventDateRange(value, agenda.timeZone)
      for (const date of days) if (range.first <= date && range.last >= date) byDay.get(date)!.push(value)
    }
    const events = (date: string) => byDay.get(date) ?? []
    const links = (date: string) => events(date).map(v => <EventLink key={v.id} value={v} church={church} date={date} agenda={agenda} search={search}/>)
    return <section className="agenda-calendar" aria-label="Calendário de eventos">
      <div className="agenda-period-heading"><h2>{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${agenda.anchorDate}T00:00:00Z`))}</h2><p>Horário de Brasília · Hoje: {agenda.today}</p></div>
      <p role="status">{agenda.total} eventos no período · {agenda.startsOn} até {addDays(agenda.endsOnExclusive, -1)}</p>
      <nav aria-label="Período da agenda"><button onClick={() => navigate(adjacent(-1))}>Anterior</button><button onClick={() => { navigate(); query.refresh() }}>Hoje</button><button onClick={() => navigate(adjacent(1))}>Próximo</button></nav>
      {!agenda.items.length && <p>Nenhum evento neste período.</p>}
      {month && <div className="agenda-weekdays" aria-hidden="true">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(label => <span key={label}>{label}</span>)}</div>}
      <div className={month ? 'agenda-month' : 'agenda-week'}>
        {month && Array.from({ length: (new Date(`${days[0]}T00:00:00Z`).getUTCDay() + 6) % 7 }, (_, i) => <div key={`blank-${i}`} aria-hidden="true" className="agenda-spacer"/>)}
        {days.map(date => <section key={date} className="agenda-day" aria-label={civilLabel(date)}>
          <h2><button type="button" aria-label={civilLabel(date)} onClick={() => { const next = new URLSearchParams(params); next.set('date', agenda.anchorDate); next.set('day', date); setParams(next) }} aria-pressed={date === day}>{month ? Number(date.slice(8)) : civilLabel(date)}</button></h2>
          {month && <p className="agenda-count">{events(date).length} eventos</p>}
          <ul className="agenda-day-events">{links(date)}</ul>
        </section>)}
      </div>
      {month && <section className="agenda-selected" aria-label="Eventos do dia selecionado"><h2>{civilLabel(day)}</h2>
        {events(day).length ? <ul>{links(day)}</ul> : <p>Nenhum evento neste dia.</p>}
      </section>}
    </section>
  }}</ReadResult>
}
export default function EventAgenda({ church, list }: { church: string; list: ReactNode }) {
  const [params, setParams] = useSearchParams(), selected = params.get('view')
  const view = selected === 'month' || selected === 'list' ? selected : 'week'
  return <div className="agenda-workspace"><nav className="agenda-view-switch" aria-label="Visualização dos eventos">{(['week', 'month', 'list'] as const).map(value => <button key={value} aria-pressed={view === value} onClick={() => {
    const next = new URLSearchParams(params); next.set('view', value); next.delete('page'); next.delete('day'); setParams(next)
  }}>{{ week: 'Semana', month: 'Mês', list: 'Lista' }[value]}</button>)}</nav>
    {view === 'list' ? list : <Calendar key={`${church}:${view}`} church={church} month={view === 'month'}/>}
  </div>
}
