import { formatDateTime } from '../time'
import { useCallback, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { ReadResult, useRead } from '../security/SecurityPages'
import { isUuid } from './catalog-api'
import { isCalendarYear, readCalendar } from './calendar-api'
import './events.css'
import './event-admin.css'

function YearNavigation({ churchId, year }: { churchId: string; year?: string }) {
  const id = useId()
  const navigate = useNavigate()
  const [value, setValue] = useState(year ?? '')
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^[1-9][0-9]{0,3}$/.test(value) || !isCalendarYear(Number(value))) { setError('Informe um ano entre 1 e 9999.'); return }
    setError(''); navigate(`/eventos/igrejas/${churchId}/calendarios/${Number(value)}`)
  }
  return <form className="events-panel event-year-form" onSubmit={submit}>
    <label htmlFor={`${id}-year`}>Ano do calendário</label>
    <input id={`${id}-year`} type="number" min={1} max={9999} step={1} required value={value} onChange={event => setValue(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}/>
    {error && <p id={`${id}-error`} role="alert">{error}</p>}
    <button>Consultar ano</button>
  </form>
}

function CalendarRecords({ churchId, year }: { churchId: string; year: number }) {
  const load = useCallback((signal: AbortSignal) => readCalendar(churchId, year, signal).catch(error => { if (error instanceof ApiError && error.status === 404) return null; throw error }), [churchId, year])
  const query = useRead(JSON.stringify([churchId, year]), load)
  return <ReadResult query={query} label="calendário histórico">{calendar => calendar ? <section className="events-panel" aria-labelledby="annual-calendar-title">
    <h2 id="annual-calendar-title">Planejamento de {year}</h2><p>Estado do planejamento: {calendar.status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}</p>
    <p>Criado em <time dateTime={calendar.createdAt}>{formatDateTime(calendar.createdAt)} (Brasília)</time></p>
    {calendar.publishedAt && <p>Publicado em <time dateTime={calendar.publishedAt}>{formatDateTime(calendar.publishedAt)} (Brasília)</time></p>}
  </section> : <p>Não há calendário anual para {year} nesta igreja.</p>}</ReadResult>
}
function CalendarWorkspace({ churchId, year }: { churchId: string; year?: string }) {
  return <ResourceAccess permissionCode="EVENT_CALENDAR_MANAGE" resourceType="CHURCH" resourceId={churchId}>
    <YearNavigation churchId={churchId} year={year}/>
    <ResourceAccess permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId} optional><p><Link to={`/eventos/igrejas/${churchId}/cadastro`}>Consultar eventos atuais</Link></p></ResourceAccess>
    {year && <CalendarRecords churchId={churchId} year={Number(year)}/>}
  </ResourceAccess>
}
export default function AnnualCalendarPage() {
  const { churchId = '', year } = useParams()
  const { account } = useAuth()
  const valid = isUuid(churchId) && (year === undefined || (/^[1-9][0-9]{0,3}$/.test(year) && isCalendarYear(Number(year))))
  return <div className="event-admin"><h1 data-page-title="Calendário anual administrativo">Calendário anual administrativo</h1><Link to="/eventos">Voltar a Eventos</Link>
    <p>Consulta histórica somente para leitura. O fluxo antigo de criação e publicação de calendários foi retirado; organize os eventos na agenda atual.</p>
    {!valid ? <p role="alert">O acesso ao calendário é inválido. Abra novamente o acesso da sua igreja e informe um ano entre 1 e 9999.</p>
      : <CalendarWorkspace key={`${account?.id}:${churchId}:${year}`} churchId={churchId} year={year}/>}
  </div>
}
