import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from './catalog-api'
import { createCalendar, isCalendarYear, readCalendar, setCalendarPublished, type AnnualCalendar } from './calendar-api'
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

function useCalendarMutation(churchId: string, year: number) {
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  const active = useRef(false)
  const request = useRef<AbortController | null>(null)
  const refreshRequired = useRef(false)
  useEffect(() => {
    active.current = true
    return () => { active.current = false; request.current?.abort() }
  }, [])
  async function run(calendar: AnnualCalendar | null, published = false) {
    if (request.current || refreshRequired.current || !isCalendarYear(year)) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setFailed(false); setMessage('')
    try {
      if (calendar) await setCalendarPublished(calendar, published, controller.signal)
      else await createCalendar(churchId, year, controller.signal)
      if (active.current) {
        setMessage(calendar ? (published ? 'Planejamento anual publicado.' : 'Publicação do planejamento anual retirada.') : 'Calendário anual criado em rascunho.')
        setRevision(value => value + 1)
      }
    } catch (error) {
      if (active.current) {
        refreshRequired.current = true; setBlocked(true); setFailed(true)
        setMessage(error instanceof ApiError && error.status >= 400 && error.status < 500
          ? `${error.message} Atualize o calendário antes de tentar novamente.`
          : 'O resultado da alteração não pôde ser confirmado. Atualize o calendário antes de tentar novamente.')
      }
    } finally {
      request.current = null
      if (active.current) setBusy(false)
    }
  }
  function refresh() {
    if (request.current) return
    refreshRequired.current = false; setBlocked(false)
    if (failed) { setFailed(false); setMessage('') }
  }
  return { busy, blocked, message, failed, revision, run, refresh }
}
type Mutation = ReturnType<typeof useCalendarMutation>
type Loaded = { key: string } & ({ kind: 'ready'; calendar: AnnualCalendar } | { kind: 'missing' } | { kind: 'error'; message: string })

function PublicationAction({ calendar, mutation }: { calendar: AnnualCalendar; mutation: Mutation }) {
  const [confirm, setConfirm] = useState(false)
  const published = calendar.status === 'PUBLISHED'
  return confirm ? <div role="group" aria-label="Confirmar publicação do planejamento">
    <p>{published ? 'Retirar a publicação do planejamento anual?' : 'Publicar o planejamento anual?'} Esta ação não altera ocorrências, inscrições ou check-in e não concede acesso público por esta tela.</p>
    <button disabled={mutation.busy || mutation.blocked} onClick={() => { void mutation.run(calendar, !published) }}>Confirmar {published ? 'retirada de publicação' : 'publicação'}</button>{' '}
    <button data-tone="secondary" disabled={mutation.busy} onClick={() => setConfirm(false)}>Cancelar alteração</button>
  </div> : <button disabled={mutation.busy || mutation.blocked} onClick={() => setConfirm(true)}>{published ? 'Retirar publicação do planejamento' : 'Publicar planejamento anual'}</button>
}

function CalendarRecords({ churchId, year, mutation }: { churchId: string; year: number; mutation: Mutation }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Loaded | null>(null)
  const { revision } = mutation
  const key = JSON.stringify([churchId, year, attempt, revision])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    readCalendar(churchId, year, controller.signal)
      .then(calendar => { if (active) setResult({ key, kind: 'ready', calendar }) })
      .catch(error => {
        if (!active) return
        setResult(error instanceof ApiError && error.status === 404 ? { key, kind: 'missing' } : { key, kind: 'error', message: error instanceof ApiError ? error.message : 'Não foi possível carregar o calendário. Tente novamente.' })
      })
    return () => { active = false; controller.abort() }
  }, [churchId, year, attempt, revision, key])
  if (!result || result.key !== key) return <p role="status" aria-busy="true">Carregando calendário…</p>
  return <>
    <button data-tone="secondary" disabled={mutation.busy} onClick={() => { mutation.refresh(); setAttempt(value => value + 1) }}>Atualizar calendário</button>
    {result.kind === 'error' ? <p role="alert">{result.message}</p> : result.kind === 'missing' ? <>
      <p>Não há calendário anual para {year} nesta igreja.</p>
      <button disabled={mutation.busy || mutation.blocked} onClick={() => { void mutation.run(null) }}>Criar calendário anual</button>
    </> : <section className="events-panel" aria-labelledby="annual-calendar-title">
      <h2 id="annual-calendar-title">Planejamento de {year}</h2><p className="event-state" data-state={result.calendar.status}>Estado do planejamento: {result.calendar.status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}</p>
      <p>Criado em <time dateTime={result.calendar.createdAt}>{new Date(result.calendar.createdAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC</time></p>
      {result.calendar.publishedAt && <p>Publicado em <time dateTime={result.calendar.publishedAt}>{new Date(result.calendar.publishedAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC</time></p>}
      <PublicationAction key={`${result.calendar.id}:${result.calendar.revision}`} calendar={result.calendar} mutation={mutation}/>
    </section>}
  </>
}

function CalendarWorkspace({ churchId, year }: { churchId: string; year?: string }) {
  const mutation = useCalendarMutation(churchId, Number(year))
  return <ResourceAccess permissionCode="EVENT_CALENDAR_MANAGE" resourceType="CHURCH" resourceId={churchId}>
    <YearNavigation churchId={churchId} year={year}/>
    <ResourceAccess permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId} optional><p><Link to={`/eventos/igrejas/${churchId}/ocorrencias`}>Ocorrências administrativas de todos os períodos</Link></p></ResourceAccess>
    {mutation.message && <p role={mutation.failed ? 'alert' : 'status'}>{mutation.message}</p>}
    {mutation.busy && <p role="status">Salvando calendário…</p>}
    {year && <CalendarRecords churchId={churchId} year={Number(year)} mutation={mutation}/>}
  </ResourceAccess>
}

export default function AnnualCalendarPage() {
  const { churchId = '', year } = useParams()
  const { account } = useAuth()
  const valid = isUuid(churchId) && (year === undefined || (/^[1-9][0-9]{0,3}$/.test(year) && isCalendarYear(Number(year))))
  return <div className="event-admin"><h1 data-page-title="Calendário anual administrativo">Calendário anual administrativo</h1><Link to="/eventos">Voltar a Eventos</Link>
    <p>A publicação do planejamento é independente das ocorrências e não abre inscrições ou check-in. A agenda detalhada e a visão pública ainda não estão disponíveis nesta tela.</p>
    {!valid ? <p role="alert">O acesso ao calendário é inválido. Abra novamente o acesso da sua igreja e informe um ano entre 1 e 9999.</p>
      : <CalendarWorkspace key={`${account?.id}:${churchId}:${year}`} churchId={churchId} year={year}/>}
  </div>
}
