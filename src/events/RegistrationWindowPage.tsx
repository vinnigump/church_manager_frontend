import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { ReadResult, useRead } from '../security/SecurityPages'
import { instantNanos, readOccurrence, type Occurrence } from './occurrence-api'
import { readWindow, sameWindow, validateWindow, writeWindow, type WindowDates, type WindowView } from './window-api'
import './occurrences.css'

interface Snapshot { window: WindowView; occurrence: Occurrence }
interface Draft extends Snapshot { opensAt: string; closesAt: string }
function useWindow(churchId: string, occurrenceId: string) {
  const [draft, setDraft] = useState<Draft | null>(null), [stale, setStale] = useState(false), [busy, setBusy] = useState(false), [attempted, setAttempted] = useState(false), [message, setMessage] = useState(''), [result, setResult] = useState<WindowView | null>(null), [epoch, setEpoch] = useState(0)
  const original = useRef<Draft | null>(null), sent = useRef(false), pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const observe = useCallback((snapshot: Snapshot) => {
    if (!original.current) { const next = { ...snapshot, opensAt: snapshot.window.opensAt ?? '', closesAt: snapshot.window.closesAt ?? '' }; original.current = next; setDraft(next) }
    else if (!sent.current && (original.current.window.revision !== snapshot.window.revision || !sameWindow(original.current.window, snapshot.window)
      || original.current.occurrence.startsAt !== snapshot.occurrence.startsAt || original.current.occurrence.participationMode !== snapshot.occurrence.participationMode)) setStale(true)
  }, [])
  function change(key: 'opensAt' | 'closesAt', value: string) {
    if (!original.current || sent.current || pending.current) return
    const next = { ...original.current, [key]: value }; original.current = next; setDraft(next)
  }
  async function run(input: WindowDates | null) {
    if (!original.current || stale || sent.current || pending.current) return
    const before = original.current, controller = new AbortController(); pending.current = controller; sent.current = true; setAttempted(true); setBusy(true); setMessage('')
    try { const value = await writeWindow(churchId, occurrenceId, before.window, before.occurrence, input, controller.signal); if (!controller.signal.aborted) { setResult(value); setEpoch(v => v + 1) } }
    catch (error) { if (!controller.signal.aborted) setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar a janela.'} O resultado pode ter sido gravado. Consulte os dados antes de outra tentativa.`) }
    finally { pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  function reload() { if (pending.current) return; original.current = null; sent.current = false; setDraft(null); setStale(false); setAttempted(false); setMessage(''); setResult(null); setEpoch(v => v + 1) }
  return { draft, stale, busy, attempted, message, result, epoch, observe, change, run, reload }
}
type Control = ReturnType<typeof useWindow>
function Dates({ value }: { value: WindowDates }) { return <p>Abertura: <time dateTime={value.opensAt}>{value.opensAt}</time><br/>Fechamento: <time dateTime={value.closesAt}>{value.closesAt}</time></p> }
function Editor({ current, control }: { current: Snapshot; control: Control }) {
  const [confirmation, setConfirmation] = useState<{ input: WindowDates | null } | null>(null), [error, setError] = useState('')
  if (!control.draft || control.result) return null
  const draft = control.draft, locked = control.stale || control.busy || control.attempted || draft.window.revision !== current.window.revision
  function change(key: 'opensAt' | 'closesAt', value: string) { control.change(key, value); setConfirmation(null); setError('') }
  function review(event: FormEvent) {
    event.preventDefault(); if (locked) return
    try {
      const input = validateWindow({ opensAt: draft.opensAt, closesAt: draft.closesAt })
      if (instantNanos(input.closesAt) > instantNanos(draft.occurrence.startsAt)) throw new Error('O fechamento deve ocorrer até o início da ocorrência.')
      setConfirmation({ input }); setError('')
    } catch (error) { setConfirmation(null); setError(error instanceof Error ? error.message : 'Revise as datas.') }
  }
  return <>
    {current.occurrence.participationMode === 'REGISTRATION_REQUIRED' ? <form aria-label="Configurar janela de inscrição" onSubmit={review}><fieldset disabled={locked}>
      <legend>Configurar os dois limites</legend>
      <p id="window-format">Informe data e hora com fuso explícito, por exemplo 2032-01-01T10:00:00-03:00. Até seis casas decimais; nenhum horário local é convertido automaticamente.</p>
      <label>Abertura da inscrição<input required type="text" aria-describedby="window-format" value={draft.opensAt} onChange={e => change('opensAt', e.target.value)}/></label>
      <label>Fechamento da inscrição<input required type="text" aria-describedby="window-format" value={draft.closesAt} onChange={e => change('closesAt', e.target.value)}/></label>
      <button>Revisar janela de inscrição</button>
    </fieldset></form> : <p>Configuração indisponível: a ocorrência precisa estar no modo com inscrição obrigatória. Nenhum modo será alterado automaticamente.</p>}
    {current.window.configured && <button disabled={locked} onClick={() => { setConfirmation({ input: null }); setError('') }}>Revisar remoção da janela</button>}
    {error && <p role="alert">{error}</p>}
    {confirmation && !locked && <section aria-label="Confirmação da janela"><h2>{confirmation.input ? 'Confirmar janela de inscrição' : 'Confirmar remoção da janela'}</h2>
      <p>Revisão compartilhada original: {draft.window.revision}.</p>
      {confirmation.input ? <Dates value={confirmation.input}/> : <p>Os dois limites serão removidos. Ausência de configuração não significa inscrição pública ilimitada.</p>}
      <p>A operação não publica a ocorrência, inscreve pessoas, altera vagas ou comprova presença. Elegibilidade e demais condições continuam sob validação do servidor.</p>
      <button disabled={control.busy} onClick={() => void control.run(confirmation.input)}>{confirmation.input ? 'Confirmar gravação da janela' : 'Confirmar remoção da janela'}</button>{' '}
      <button onClick={() => setConfirmation(null)}>Voltar sem gravar</button>
    </section>}
  </>
}
function Records({ churchId, occurrenceId, control }: { churchId: string; occurrenceId: string; control: Control }) {
  const { observe } = control
  const load = useCallback(async (signal: AbortSignal) => {
    const window = await readWindow(churchId, occurrenceId, signal), occurrence = await readOccurrence(churchId, occurrenceId, signal)
    if (window.revision !== occurrence.revision) throw new Error('A ocorrência mudou entre as consultas. Recarregue para obter uma revisão consistente.')
    const snapshot = { window, occurrence }; if (!signal.aborted) observe(snapshot); return snapshot
  }, [churchId, occurrenceId, observe])
  const query = useRead(`${churchId}:${occurrenceId}`, load)
  return <ReadResult query={query} label="janela de inscrição">{snapshot => <>
    <h2>Janela da ocorrência {occurrenceId}</h2><p>Revisão compartilhada consultada: {snapshot.window.revision}.</p>
    <p>Início da ocorrência: <time dateTime={snapshot.occurrence.startsAt}>{snapshot.occurrence.startsAt}</time>.</p>
    {snapshot.window.configured ? <Dates value={snapshot.window as WindowDates}/> : <p>Janela não configurada. Ausência não significa inscrição pública ilimitada.</p>}
    <ResourceAccess permissionCode="EVENT_EDIT" resourceType="CHURCH" resourceId={churchId} optional><Editor current={snapshot} control={control}/></ResourceAccess>
  </>}</ReadResult>
}
function Workspace({ churchId, occurrenceId }: { churchId: string; occurrenceId: string }) {
  const control = useWindow(churchId, occurrenceId)
  return <ResourceAccess key={control.epoch} permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId}>
    <button disabled={control.busy} onClick={control.reload}>Descartar tentativa e recarregar janela</button>
    {control.stale && <p role="alert">A ocorrência mudou. Descarte o rascunho e recarregue; a revisão original foi preservada.</p>}
    {control.busy && <p role="status" aria-busy="true">Confirmando janela…</p>}{control.message && <p role="alert">{control.message}</p>}
    {control.result && <p role="status">Janela {control.result.configured ? 'configurada' : 'removida'} confirmada pelo servidor na revisão {control.result.revision}.</p>}
    <Records churchId={churchId} occurrenceId={occurrenceId} control={control}/>
  </ResourceAccess>
}
export default function RegistrationWindowPage() {
  const { churchId = '', occurrenceId = '' } = useParams(), { account } = useAuth()
  return <div className="occurrences"><h1 data-page-title="Janela de inscrição">Janela de inscrição</h1><Link to="/eventos">Voltar a Eventos</Link>
    {!isUuid(churchId) || !isUuid(occurrenceId) ? <p role="alert">Acesso inválido. Abra novamente o detalhe autorizado da ocorrência.</p> : <><p><Link to={`/eventos/igrejas/${churchId}/ocorrencias/${occurrenceId}`}>Voltar à ocorrência</Link></p><Workspace key={`${account?.id}:${churchId}:${occurrenceId}`} churchId={churchId} occurrenceId={occurrenceId}/></>}
  </div>
}
