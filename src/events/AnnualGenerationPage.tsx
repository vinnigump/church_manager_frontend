import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { listChurchCatalog } from './catalog-api'
import { generateAnnualSeries, validateGeneration, type GenerationInput, type GenerationResult } from './generation-api'
import './occurrences.css'

interface Fields { year: string; frequency: string; interval: string; firstStartsAt: string; through: string; durationMinutes: string; eventTypeId: string; capacity: string; modality: string; participationMode: string; checkInRequired: string }
const initial: Fields = { year: '', frequency: '', interval: '1', firstStartsAt: '', through: '', durationMinutes: '', eventTypeId: '', capacity: '', modality: '', participationMode: '', checkInRequired: '' }
function inputFor(fields: Fields) {
  if (![fields.year, fields.interval, fields.durationMinutes].every(v => /^\d+$/.test(v)) || (fields.capacity !== '' && !/^\d+$/.test(fields.capacity)) || !['true', 'false'].includes(fields.checkInRequired)) throw new Error('Preencha a configuração explicitamente. Capacidade vazia representa ilimitada.')
  return validateGeneration({ ...fields, year: Number(fields.year), interval: Number(fields.interval), durationMinutes: Number(fields.durationMinutes), capacity: fields.capacity === '' ? null : Number(fields.capacity),
    frequency: fields.frequency as GenerationInput['frequency'], modality: fields.modality as GenerationInput['modality'], participationMode: fields.participationMode as GenerationInput['participationMode'], checkInRequired: fields.checkInRequired === 'true' })
}
function useGeneration(churchId: string) {
  const [fields, setFields] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<GenerationResult | null>(null)
  const request = useRef<AbortController | null>(null)
  const sent = useRef(false)
  useEffect(() => () => request.current?.abort(), [])
  async function run(input: GenerationInput) {
    if (sent.current) return
    sent.current = true; setAttempted(true); setBusy(true); setMessage('')
    const controller = new AbortController(); request.current = controller
    try {
      const value = await generateAnnualSeries(churchId, input, controller.signal)
      if (!controller.signal.aborted) setResult(value)
    } catch (error) {
      if (!controller.signal.aborted) setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar a geração.'} A tentativa pode ter criado a série. Consulte as ocorrências antes de abrir nova geração; reenviar pode duplicar o planejamento.`)
    } finally { request.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  return { fields, setFields, busy, attempted, message, result, run }
}
type Generation = ReturnType<typeof useGeneration>
function TypePicker({ churchId, control, changed }: { churchId: string; control: Generation; changed: () => void }) {
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listChurchCatalog(churchId, page, signal), [churchId, page])
  const query = useRead(`${churchId}:${page}`, load)
  return <ReadResult query={query} label="tipos para geração">{data => <section>
    <label>Tipo da série<select required disabled={control.attempted} value={control.fields.eventTypeId} onChange={e => { control.setFields(v => ({ ...v, eventTypeId: e.target.value })); changed() }}>
      <option value="">Selecione um tipo habilitado</option>
      {control.fields.eventTypeId && !data.items.some(v => v.id === control.fields.eventTypeId) && <option value={control.fields.eventTypeId}>Tipo selecionado fora desta página (disponibilidade revalidada pelo servidor)</option>}
      {data.items.map(v => <option key={v.id} value={v.id} disabled={!v.enabled}>{v.name} · {v.scopeType === 'CHURCH' ? 'Local' : 'Denominacional'}</option>)}
    </select></label><p>Página {page + 1} · {data.total} tipos.</p><Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos tipos da série"/>
  </section>}</ReadResult>
}
function GenerationForm({ churchId, control }: { churchId: string; control: Generation }) {
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<GenerationInput | null>(null)
  const change = (field: keyof Fields, value: string) => { control.setFields(v => ({ ...v, [field]: value })); setError(''); setConfirmation(null) }
  function prepare(event: FormEvent) {
    event.preventDefault()
    if (control.attempted) return
    try { setConfirmation(inputFor(control.fields)); setError('') }
    catch (error) { setConfirmation(null); setError(error instanceof Error ? error.message : 'Revise a configuração.') }
  }
  return <><form onSubmit={prepare} aria-label="Configuração da série anual"><fieldset disabled={control.attempted}>
    <legend>Nova série de rascunhos</legend><TypePicker churchId={churchId} control={control} changed={() => setConfirmation(null)}/>
    <label>Ano da série<input type="number" min="1" max="9999" step="1" required value={control.fields.year} onChange={e => change('year', e.target.value)}/></label>
    <label>Frequência<select required value={control.fields.frequency} onChange={e => change('frequency', e.target.value)}><option value="">Selecione</option><option value="DAILY">Diária</option><option value="WEEKLY">Semanal (dia da primeira data)</option><option value="MONTHLY">Mensal (dia nominal da primeira data)</option></select></label>
    <label>Intervalo entre repetições<input type="number" min="1" max="366" step="1" required value={control.fields.interval} onChange={e => change('interval', e.target.value)}/></label>
    <label>Primeiro início (hora civil da igreja)<input required type="text" placeholder="AAAA-MM-DDTHH:mm:ss.ffffff" value={control.fields.firstStartsAt} onChange={e => change('firstStartsAt', e.target.value)}/></label>
    <label>Última data nominal inclusiva<input required type="date" value={control.fields.through} onChange={e => change('through', e.target.value)}/></label>
    <label>Duração de cada ocorrência (minutos)<input required type="number" min="1" max="527040" step="1" value={control.fields.durationMinutes} onChange={e => change('durationMinutes', e.target.value)}/></label>
    <label>Capacidade (vazia: ilimitada)<input type="number" min="0" max="2147483647" step="1" value={control.fields.capacity} onChange={e => change('capacity', e.target.value)}/></label>
    <label>Modalidade<select required value={control.fields.modality} onChange={e => change('modality', e.target.value)}><option value="">Selecione</option><option value="IN_PERSON">Presencial</option><option value="ONLINE">Online</option><option value="HYBRID">Híbrido</option></select></label>
    <label>Participação<select required value={control.fields.participationMode} onChange={e => change('participationMode', e.target.value)}><option value="">Selecione</option><option value="REGISTRATION_REQUIRED">Inscrição obrigatória</option><option value="OPEN_EVENT">Evento aberto</option></select></label>
    <label>Check-in obrigatório<select required value={control.fields.checkInRequired} onChange={e => change('checkInRequired', e.target.value)}><option value="">Selecione explicitamente</option><option value="false">Não</option><option value="true">Sim</option></select></label>
    <p>Capacidade ilimitada não abre inscrições. Evento aberto exige check-in Não.</p>
    {error && <p role="alert">{error}</p>}<button>Revisar geração</button>
  </fieldset></form>
    {confirmation && !control.attempted && <section aria-label="Confirmar geração anual"><h2>Confirmar nova série</h2>
      <p>Ano {confirmation.year} · {confirmation.frequency} a cada {confirmation.interval} · primeiro início civil {confirmation.firstStartsAt} · até {confirmation.through} · duração {confirmation.durationMinutes} minutos.</p>
      <p>Tipo selecionado: {confirmation.eventTypeId}. Cada confirmação cria um novo lote; não há proteção contra duplicação por reenvio. Nenhuma ocorrência será publicada.</p>
      <button onClick={() => { void control.run(confirmation) }}>Confirmar criação da série</button>{' '}<button onClick={() => setConfirmation(null)}>Voltar à configuração</button>
    </section>}
  </>
}
function Workspace({ churchId }: { churchId: string }) {
  const control = useGeneration(churchId)
  return <ResourceAccess permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId}><ResourceAccess permissionCode="EVENT_CREATE" resourceType="CHURCH" resourceId={churchId}>
    <p>O servidor usa o fuso cadastrado da igreja, não o relógio do navegador. Datas e horários inexistentes avançam ao próximo válido; o dia nominal permanece ancorado à primeira data. Horários ambíguos usam o primeiro offset. Duração decorrida preservada.</p>
    <p>Até 366 rascunhos dentro do ano. Não altera séries existentes, ocorrências publicadas, inscrições ou presenças e não publica o calendário.</p>
    {control.busy && <p role="status" aria-busy="true">Gerando série…</p>}{control.message && <p role="alert">{control.message}</p>}
    <p><Link to={`/eventos/igrejas/${churchId}/ocorrencias`}>Consultar ocorrências antes de outra geração</Link></p>
    {control.result ? <section aria-label="Série criada"><h2>Série criada em rascunho</h2><p>{control.result.items.length} ocorrências · ano {control.result.year} · fuso {control.result.timezone}.</p>
      <p>Série {control.result.recurrenceRuleId}. Os intervalos abaixo são os instantes confirmados pelo servidor.</p>
      <ul className="event-list">{control.result.items.map(item => <li key={item.id}><Link to={`/eventos/igrejas/${churchId}/ocorrencias/${item.id}`}>Consultar ocorrência {item.id}</Link><p><time dateTime={item.startsAt}>{item.startsAt}</time> até <time dateTime={item.endsAt}>{item.endsAt}</time></p><p>Rascunho · revisão zero · {item.adjusted ? 'Data ou horário ajustado pelo servidor' : 'Sem ajuste de data ou horário'}</p></li>)}</ul>
    </section> : <GenerationForm churchId={churchId} control={control}/>}
  </ResourceAccess></ResourceAccess>
}
export default function AnnualGenerationPage() {
  const { churchId = '' } = useParams(); const { account } = useAuth()
  return <div className="occurrences"><h1 data-page-title="Gerar série anual">Gerar série anual em rascunho</h1><Link to="/eventos">Voltar a Eventos</Link>
    {!isUuid(churchId) ? <p role="alert">O acesso à geração é inválido. Abra novamente o catálogo autorizado da igreja.</p> : <Workspace key={`${account?.id}:${churchId}`} churchId={churchId}/>}
  </div>
}
