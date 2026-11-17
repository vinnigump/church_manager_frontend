import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { isUuid } from '../validation'
import { confirmRegistration, registrationOptions, type OwnRegistration, type RegistrationOption } from './participation-api'

export interface EventTaskRegistrationProps {
  churchId: string; eventTypeId: string; taskInstanceId: string
  onRegistered?: (registration: OwnRegistration) => void
  onBusyChange?: (busy: boolean) => void
}
/** Mount only in an available own EVENT step. Server validates persisted tuple independently. */
export default function EventTaskRegistration(props: EventTaskRegistrationProps) {
  const { account } = useAuth()
  if (!isUuid(props.churchId) || !isUuid(props.eventTypeId) || !isUuid(props.taskInstanceId)) return <p role="alert">Etapa de evento indisponível.</p>
  return <Picker key={`${account?.id}:${props.churchId}:${props.eventTypeId}:${props.taskInstanceId}`} {...props}/>
}
function Picker({ churchId, eventTypeId, taskInstanceId, onRegistered, onBusyChange }: EventTaskRegistrationProps) {
  const [page, setPage] = useState(0), [epoch, setEpoch] = useState(0), [selected, setSelected] = useState<RegistrationOption | null>(null)
  const [busy, setBusy] = useState(false), [attempted, setAttempted] = useState(false), [message, setMessage] = useState(''), [result, setResult] = useState<OwnRegistration | null>(null)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false) }, [busy, onBusyChange])
  const load = useCallback((signal: AbortSignal) => registrationOptions(churchId, eventTypeId, page, signal), [churchId, eventTypeId, page])
  const query = useRead(JSON.stringify([churchId, eventTypeId, taskInstanceId, page, epoch]), load)
  async function confirm() {
    if (!selected || pending.current || attempted) return
    const controller = new AbortController(); pending.current = controller; setBusy(true); setAttempted(true); setMessage('')
    try {
      const registration = await confirmRegistration(churchId, selected.id, taskInstanceId, controller.signal)
      if (!controller.signal.aborted) { setResult(registration); onRegistered?.(registration) }
    } catch (error) { if (!controller.signal.aborted) setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar o resultado.'} A inscrição pode ter sido registrada. Consulte novamente antes de outra tentativa.`) }
    finally { pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  function refresh() { if (pending.current) return; setAttempted(false); setSelected(null); setMessage(''); setEpoch(v => v + 1) }
  return <section aria-label="Inscrição na etapa de evento">
    <h3>Escolher evento para esta etapa</h3>
    <p>Escolha e confirme uma ocorrência. A inscrição reserva sua participação; a etapa exige presença nominal registrada durante o evento.</p>
    {result ? <p role="status">Inscrição confirmada e vinculada à etapa. Aguarde o evento e realize o check-in de participante.</p> : <>
      <button disabled={busy} onClick={refresh}>Consultar opções novamente</button>
      {busy && <p role="status" aria-busy="true">Confirmando inscrição…</p>}{message && <p role="alert">{message}</p>}
      <ReadResult query={query} label="opções de evento">{data => <>
        {data.items.length ? <ul className="event-list">{data.items.map(option => <li key={option.id}>
          <h4>{option.name}</h4><p><time dateTime={option.startsAt}>{option.startsAt}</time> até <time dateTime={option.endsAt}>{option.endsAt}</time></p><p>{option.location ?? 'Local ainda não informado'}</p>
          <button disabled={busy || attempted} onClick={() => setSelected(option)}>Escolher {option.name}</button>
        </li>)}</ul> : <p>Nenhuma ocorrência disponível para sua inscrição nesta página.</p>}
        <Pagination page={page} total={data.total} setPage={value => { if (!pending.current) { setSelected(null); setPage(value) } }} label="Páginas das opções de evento"/>
        {selected && data.items.some(option => option.id === selected.id) && <section aria-label="Confirmar inscrição no evento">
          <h4>Confirmar inscrição em {selected.name}</h4><p>Início: {selected.startsAt}. Vagas e requisitos serão conferidos pelo servidor.</p>
          <button disabled={busy || attempted} onClick={() => void confirm()}>Confirmar minha inscrição</button>{' '}<button disabled={busy} onClick={() => setSelected(null)}>Voltar</button>
        </section>}
      </>}</ReadResult>
    </>}
  </section>
}
