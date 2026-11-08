import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { listOccurrences, type Occurrence } from './occurrence-api'
import { copyAnnualDrafts, validateCopySources, type CopyResult } from './copy-api'
import './occurrences.css'

interface Selection { sourceYear: number; targetYear: number; sources: Occurrence[] }
function useCopy(churchId: string) {
  const [sourceYear, setSourceYear] = useState('')
  const [targetYear, setTargetYear] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Record<string, Occurrence>>({})
  const selectedRef = useRef<Record<string, Occurrence>>({})
  const [stale, setStale] = useState<string[]>([])
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<CopyResult | null>(null)
  const request = useRef<AbortController | null>(null)
  const sent = useRef(false)
  useEffect(() => () => request.current?.abort(), [])
  function toggle(item: Occurrence, checked: boolean) {
    if (sent.current || (checked && (item.status !== 'DRAFT' || Object.keys(selectedRef.current).length >= 100))) return
    const next = { ...selectedRef.current }
    if (checked) next[item.id] = item; else delete next[item.id]
    selectedRef.current = next; setSelected(next); setStale(v => v.filter(id => id !== item.id))
  }
  const observe = useCallback((items: Occurrence[]) => {
    const changed = items.filter(v => selectedRef.current[v.id] && (v.revision !== selectedRef.current[v.id].revision || v.status !== 'DRAFT')).map(v => v.id)
    if (changed.length) setStale(before => [...new Set([...before, ...changed])])
  }, [])
  async function run(selection: Selection) {
    if (sent.current || stale.length) return
    sent.current = true; setAttempted(true); setBusy(true); setMessage('')
    const controller = new AbortController(); request.current = controller
    try {
      const value = await copyAnnualDrafts(churchId, selection.sourceYear, selection.targetYear, selection.sources, controller.signal)
      if (!controller.signal.aborted) setResult(value)
    } catch (error) {
      if (!controller.signal.aborted) setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar a cópia.'} O lote pode ter sido criado. Consulte as ocorrências antes de iniciar outra cópia; reenviar pode duplicar o planejamento.`)
    } finally { request.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  return { sourceYear, setSourceYear, targetYear, setTargetYear, page, setPage, selected, stale, toggle, observe, attempted, busy, message, result, run }
}
type Copy = ReturnType<typeof useCopy>
function Candidates({ churchId, control, changed }: { churchId: string; control: Copy; changed: () => void }) {
  const { page, observe } = control
  const load = useCallback(async (signal: AbortSignal) => {
    const data = await listOccurrences(churchId, page, signal)
    if (!signal.aborted) observe(data.items)
    return data
  }, [churchId, page, observe])
  const query = useRead(`${churchId}:${page}`, load)
  return <ReadResult query={query} label="origens para cópia">{data => <section aria-label="Origens disponíveis"><h2>Selecionar origens manualmente</h2>
    <p>Página {data.page + 1} · {data.total} ocorrências em todos os estados. Somente DRAFT pode ser selecionado. O total não representa quantidade de rascunhos.</p>
    {data.items.length ? <ul className="event-list">{data.items.map(item => <li key={item.id}>
      <label><input type="checkbox" checked={Boolean(control.selected[item.id])} disabled={control.attempted || (!control.selected[item.id] && (item.status !== 'DRAFT' || Object.keys(control.selected).length >= 100))} onChange={e => { control.toggle(item, e.target.checked); changed() }}/>Selecionar origem {item.id}</label>
      <p>Estado {item.status} · revisão consultada {item.revision}. Início <time dateTime={item.startsAt}>{item.startsAt}</time> · término <time dateTime={item.endsAt}>{item.endsAt}</time>.</p>
      {!item.configured && <p>Configuração legada ausente será preservada, sem preencher valores automaticamente.</p>}
    </li>)}</ul> : <p>Nenhuma ocorrência nesta página.</p>}
    <Pagination page={page} total={data.total} setPage={value => { control.setPage(value); changed() }} label="Páginas das origens"/>
  </section>}</ReadResult>
}
function CopyForm({ churchId, control }: { churchId: string; control: Copy }) {
  const [confirmation, setConfirmation] = useState<Selection | null>(null)
  const [error, setError] = useState('')
  const sources = Object.values(control.selected)
  function changed() { setConfirmation(null); setError('') }
  function prepare(event: FormEvent) {
    event.preventDefault()
    if (control.attempted || control.stale.length) return
    try {
      if (!/^\d+$/.test(control.sourceYear) || !/^\d+$/.test(control.targetYear)) throw new Error('Informe os anos de origem e destino.')
      const selection = { sourceYear: Number(control.sourceYear), targetYear: Number(control.targetYear), sources }
      validateCopySources(churchId, selection.sourceYear, selection.targetYear, sources)
      setConfirmation(selection); setError('')
    } catch (error) { setConfirmation(null); setError(error instanceof Error ? error.message : 'Revise a seleção.') }
  }
  return <><form onSubmit={prepare} aria-label="Cópia manual de planejamento"><fieldset disabled={control.attempted}>
    <legend>Criar novo lote a partir de rascunhos</legend>
    <label>Ano de origem<input required type="number" min="1" max="9999" step="1" value={control.sourceYear} onChange={e => { control.setSourceYear(e.target.value); changed() }}/></label>
    <label>Ano de destino<input required type="number" min="1" max="9999" step="1" value={control.targetYear} onChange={e => { control.setTargetYear(e.target.value); changed() }}/></label>
    <p>O servidor valida que todas as origens pertencem ao ano informado no fuso cadastrado da igreja. A lista abaixo cobre todos os períodos; os instantes exibidos não são convertidos para o fuso do navegador.</p>
    <Candidates churchId={churchId} control={control} changed={changed}/>
    <section aria-label="Seleção para cópia"><h2>{sources.length} origens selecionadas (máximo 100)</h2>
      <p>Seleção conservada ao paginar. Cada origem mantém a revisão escolhida; alterações concorrentes não atualizam essa revisão silenciosamente.</p>
      <ul>{sources.map(source => <li key={source.id}>Origem {source.id} · revisão selecionada {source.revision} <button type="button" onClick={() => { control.toggle(source, false); changed() }}>Remover origem {source.id}</button></li>)}</ul>
    </section>
    {control.stale.length > 0 && <p role="alert">Uma origem selecionada mudou de revisão ou estado. Remova-a e selecione novamente após conferir os dados; nenhum lote será enviado com essa seleção conhecida como obsoleta.</p>}
    {error && <p role="alert">{error}</p>}
    <button disabled={sources.length === 0 || control.stale.length > 0}>Revisar cópia</button>
  </fieldset></form>
    {confirmation && !control.attempted && <section aria-label="Confirmar cópia manual"><h2>Confirmar novo lote de rascunhos</h2>
      <p>Copiar {confirmation.sources.length} origens selecionadas de {confirmation.sourceYear} para {confirmation.targetYear}? Cada confirmação cria um lote novo; não há proteção contra duplicação por reenvio.</p>
      <p>Originais permanecem intactos. Destinos independentes da série original, com versão vigente do template e sem inscrições, presenças ou notificações.</p>
      <button disabled={control.stale.length > 0} onClick={() => { void control.run(confirmation) }}>Confirmar criação das cópias</button>{' '}<button onClick={() => setConfirmation(null)}>Voltar à seleção</button>
    </section>}
  </>
}
function Workspace({ churchId }: { churchId: string }) {
  const control = useCopy(churchId)
  return <ResourceAccess permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId}><ResourceAccess permissionCode="EVENT_CREATE" resourceType="CHURCH" resourceId={churchId}>
    <p>Cópia manual cria apenas rascunhos independentes. Configuração, capacidade e espaço são preservados; o servidor usa o fuso da igreja e ajusta datas/horários inexistentes ao próximo válido, mantendo a duração.</p>
    {control.busy && <p role="status" aria-busy="true">Criando cópias…</p>}{control.message && <p role="alert">{control.message}</p>}
    <p><Link to={`/eventos/igrejas/${churchId}/ocorrencias`}>Conferir ocorrências antes de outra cópia</Link></p>
    {control.result ? <section aria-label="Cópias criadas"><h2>Lote de cópias criado em rascunho</h2><p>{control.result.items.length} cópias · ano {control.result.year} · fuso {control.result.timezone}.</p>
      <ul className="event-list">{control.result.items.map(item => <li key={item.id}><Link to={`/eventos/igrejas/${churchId}/ocorrencias/${item.id}`}>Consultar cópia {item.id}</Link><p>Origem {item.sourceOccurrenceId} · DRAFT · revisão zero · {item.adjusted ? 'Data ou horário ajustado pelo servidor' : 'Sem ajuste de data ou horário'}.</p><p><time dateTime={item.startsAt}>{item.startsAt}</time> até <time dateTime={item.endsAt}>{item.endsAt}</time></p></li>)}</ul>
    </section> : <CopyForm churchId={churchId} control={control}/>}
  </ResourceAccess></ResourceAccess>
}
export default function AnnualCopyPage() {
  const { churchId = '' } = useParams(); const { account } = useAuth()
  return <div className="occurrences"><h1 data-page-title="Copiar planejamento anual">Copiar planejamento anual em rascunho</h1><Link to="/eventos">Voltar a Eventos</Link>
    {!isUuid(churchId) ? <p role="alert">O acesso à cópia é inválido. Abra novamente o acesso autorizado da igreja.</p> : <Workspace key={`${account?.id}:${churchId}`} churchId={churchId}/>}
  </div>
}
