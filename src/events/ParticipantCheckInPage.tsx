import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { confirmParticipantPresence, participants, type Participant } from './participation-api'
import { recordSearch } from './record-presentation'
import './occurrences.css'

function Workspace({ church, occurrence }: { church: string; occurrence: string }) {
  const [search, setSearch] = useState(''), [q, setQ] = useState(''), [page, setPage] = useState(0), [epoch, setEpoch] = useState(0)
  const [selected, setSelected] = useState<Participant | null>(null), [reason, setReason] = useState(''), [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false), [message, setMessage] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const load = useCallback((signal: AbortSignal) => participants(church, occurrence, q, page, signal), [church, occurrence, q, page])
  const query = useRead(JSON.stringify([church, occurrence, q, page, epoch]), load)
  function find(event: FormEvent) { event.preventDefault(); if (pending.current) return; setQ(search.trim()); setPage(0); setSelected(null); setReason(''); setEpoch(v => v + 1) }
  async function confirm() {
    if (!selected || reason !== 'ADMINISTRATIVE_DECISION' || pending.current || blocked) return
    const controller = new AbortController(); pending.current = controller; setBusy(true); setBlocked(true); setMessage('')
    try {
      const result = await confirmParticipantPresence(church, occurrence, selected.registrationId, 'ADMINISTRATIVE_DECISION', controller.signal)
      if (!controller.signal.aborted) { setMessage(result.validated ? `Presença confirmada pelo servidor em ${result.checkedInAt}.` : 'Já existe uma presença legada sem evidência validada. Nenhuma nova presença foi criada.'); setSelected(null); setReason(''); setEpoch(v => v + 1) }
    } catch (error) { if (!controller.signal.aborted) setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar o resultado.'} Consulte a lista antes de outra tentativa; a operação pode ter sido registrada.`) }
    finally { pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  function reload() { if (pending.current) return; setBlocked(false); setSelected(null); setReason(''); setMessage(''); setEpoch(v => v + 1) }
  return <>
    <p>Confira pessoalmente a presença antes de confirmar. O registro utiliza a hora do servidor e só é permitido durante o evento.</p>
    <form onSubmit={find}><fieldset disabled={busy}><legend>Buscar participante inscrito</legend><label>Nome<input maxLength={120} value={search} onChange={event => setSearch(event.target.value)}/></label><button>Pesquisar</button></fieldset></form>
    <button disabled={busy} onClick={reload}>Consultar novamente e liberar nova tentativa</button>
    {busy && <p role="status" aria-busy="true">Registrando presença…</p>}{message && <p role="status">{message}</p>}
    <ResourceAccess key={epoch} permissionCode="EVENT_ATTENDANCE_MANAGE" resourceType="CHURCH" resourceId={church} preserveDuringRecheck>
      <ReadResult query={query} label="participantes">{data => <>
        <h2>{data.name}</h2><p><time dateTime={data.startsAt}>{data.startsAt}</time> até <time dateTime={data.endsAt}>{data.endsAt}</time></p>
        <p>{data.total} inscrições · página {page + 1}</p>
        {data.content.length ? <ul className="event-list">{data.content.map(person => <li key={person.registrationId}>
          <h3>{person.displayName}</h3>
          {person.presence ? <p>Presença registrada em <time dateTime={person.presence.checkedInAt}>{person.presence.checkedInAt}</time>{person.presence.validated ? '.' : ' · registro legado sem evidência validada.'}</p>
            : person.status === 'CONFIRMED' ? <button disabled={busy || blocked} onClick={() => { setSelected(person); setReason('') }}>Conferir presença de {person.displayName}</button> : <p>Inscrição sem confirmação; presença indisponível.</p>}
        </li>)}</ul> : <p>Nenhuma inscrição encontrada nesta página.</p>}
        <Pagination page={page} total={data.total} setPage={value => { if (!pending.current) { setPage(value); setSelected(null); setReason('') } }} label="Páginas dos participantes"/>
        {selected && data.content.some(person => person.registrationId === selected.registrationId && !person.presence && person.status === 'CONFIRMED') && <section aria-label="Confirmar presença manual">
          <h2>Confirmar presença de {selected.displayName}</h2><p>Evento: {data.name}. A confirmação é única nesta ocorrência.</p>
          <label>Justificativa<select disabled={busy || blocked} value={reason} onChange={event => setReason(event.target.value)}><option value="">Selecione após conferir</option><option value="ADMINISTRATIVE_DECISION">Conferência manual pelo operador autorizado</option></select></label>
          <button disabled={busy || blocked || reason !== 'ADMINISTRATIVE_DECISION'} onClick={() => void confirm()}>Confirmar presença conferida</button>{' '}
          <button disabled={busy} onClick={() => { setSelected(null); setReason('') }}>Voltar</button>
        </section>}
      </>}</ReadResult>
    </ResourceAccess>
  </>
}
export default function ParticipantCheckInPage() {
  const { churchId = '', occurrenceId = '' } = useParams(), { account } = useAuth(), [search] = useSearchParams()
  return <div className="occurrences"><h1 data-page-title="Presença no evento">Presença no evento</h1>
    <Link to="/eventos">Eventos</Link>
    {!isUuid(churchId) || !isUuid(occurrenceId) ? <p role="alert">Acesso inválido. Abra novamente o evento autorizado.</p> : <>
      <p><Link to={`/eventos/igrejas/${churchId}/cadastro/${occurrenceId}${recordSearch(search)}`}>Voltar ao evento</Link></p>
      <ResourceAccess permissionCode="EVENT_ATTENDANCE_MANAGE" resourceType="CHURCH" resourceId={churchId}>
        <Workspace key={`${account?.id}:${churchId}:${occurrenceId}`} church={churchId} occurrence={occurrenceId}/>
      </ResourceAccess>
    </>}
  </div>
}
