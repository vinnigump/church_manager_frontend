import { useCallback, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { editableOccurrence } from './occurrence-api'
import { readSeries, validateSeriesConfig, validateSeriesSelections, type SeriesPage as SeriesData } from './series-api'
import { useSeriesEditor, type SeriesEditor, type SeriesFields, type SeriesIntent } from './useSeriesEditor'
import './occurrences.css'

function PatternForm({ control }: { control: SeriesEditor }) {
  const f = control.fields
  const change = (field: keyof SeriesFields, value: string) => control.change(field, value)
  return <form aria-label="Proposta de horários da série" onSubmit={event => { event.preventDefault(); void control.calculate() }}><fieldset disabled={control.busy || control.attempted || control.rootStale || !control.root}>
    <legend>Calcular horários sem gravar</legend>
    <label>Ano da proposta<input required type="number" min="1" max="9999" step="1" readOnly={Boolean(control.root?.pattern)} value={f.year} onChange={e => change('year', e.target.value)}/></label>
    <label>Frequência<select required value={f.frequency} onChange={e => change('frequency', e.target.value)}><option value="">Selecione</option><option value="DAILY">Diária</option><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensal</option></select></label>
    <label>Intervalo entre repetições<input required type="number" min="1" max="366" step="1" value={f.interval} onChange={e => change('interval', e.target.value)}/></label>
    <label>Primeiro início civil no fuso da série<input required placeholder="AAAA-MM-DDTHH:mm:ss.ffffff" value={f.firstStartsAt} onChange={e => change('firstStartsAt', e.target.value)}/></label>
    <label>Última data nominal inclusiva<input required type="date" value={f.through} onChange={e => change('through', e.target.value)}/></label>
    <label>Duração em minutos<input required type="number" min="1" max="527040" step="1" value={f.durationMinutes} onChange={e => change('durationMinutes', e.target.value)}/></label>
    <button>Calcular prévia sem gravar</button>
  </fieldset></form>
}
function SelectionForm({ data, control }: { data: SeriesData; control: SeriesEditor }) {
  const [confirmation, setConfirmation] = useState<SeriesIntent | null>(null)
  const [error, setError] = useState('')
  const fields = control.fields
  const entries = Object.values(control.selected)
  function changed() { setConfirmation(null); setError('') }
  function field(name: keyof SeriesFields, value: string) { control.change(name, value); changed() }
  function review(event: FormEvent) {
    event.preventDefault(); changed()
    if (!control.root || !control.preview || control.rootStale || control.stale.length || control.attempted || control.busy) return
    try {
      if (fields.capacity !== '' && !/^\d+$/.test(fields.capacity)) throw new Error('Informe capacidade inteira ou deixe vazia para ilimitada.')
      if (!['true', 'false'].includes(fields.checkInRequired)) throw new Error('Selecione explicitamente o check-in.')
      const config = validateSeriesConfig({ capacity: fields.capacity === '' ? null : Number(fields.capacity), modality: fields.modality as SeriesIntent['config']['modality'], participationMode: fields.participationMode as SeriesIntent['config']['participationMode'], checkInRequired: fields.checkInRequired === 'true' })
      validateSeriesSelections(data.churchId, control.root, control.preview, entries)
      setConfirmation({ before: control.root, preview: control.preview, config, selections: entries })
    } catch (error) { setError(error instanceof Error ? error.message : 'Revise a seleção.') }
  }
  return <><form aria-label="Seleção explícita da série" onSubmit={review}><fieldset disabled={control.busy || control.attempted || control.rootStale}>
    <legend>Configuração e seleção das ocorrências</legend>
    <label>Capacidade (vazia: ilimitada)<input type="number" min="0" max="2147483647" step="1" value={fields.capacity} onChange={e => field('capacity', e.target.value)}/></label>
    <label>Modalidade<select required value={fields.modality} onChange={e => field('modality', e.target.value)}><option value="">Selecione</option><option value="IN_PERSON">Presencial</option><option value="ONLINE">Online</option><option value="HYBRID">Híbrido</option></select></label>
    <label>Participação<select required value={fields.participationMode} onChange={e => field('participationMode', e.target.value)}><option value="">Selecione</option><option value="REGISTRATION_REQUIRED">Inscrição obrigatória</option><option value="OPEN_EVENT">Evento aberto</option></select></label>
    <label>Check-in obrigatório<select required value={fields.checkInRequired} onChange={e => field('checkInRequired', e.target.value)}><option value="">Selecione explicitamente</option><option value="false">Não</option><option value="true">Sim</option></select></label>
    <p>A configuração acima será aplicada a todas as selecionadas, incluindo seus ajustes individuais. O servidor revalida capacidade, inscrições existentes e disponibilidade do tipo.</p>
    {data.items.map(item => <p key={item.id}><label><input type="checkbox" checked={Boolean(control.selected[item.id])} disabled={!control.selected[item.id] && (!editableOccurrence(item) || entries.length >= 366)} onChange={e => { control.selection(item.id, e.target.checked ? { before: item, slotIndex: -1 } : null); changed() }}/>Selecionar ocorrência {item.id}</label></p>)}
    <h3>Associações explícitas ({entries.length})</h3><p>Nenhum horário é associado automaticamente. Cada destino pode ser usado uma vez; seleções fora da página continuam abaixo.</p>
    {entries.map(entry => <div key={entry.before.id}>
      <p>Origem {entry.before.id} · revisão original {entry.before.revision} · {entry.before.startsAt} até {entry.before.endsAt}.</p>
      <label>Destino para {entry.before.id}<select value={entry.slotIndex < 0 ? '' : entry.slotIndex} onChange={e => { control.selection(entry.before.id, { ...entry, slotIndex: e.target.value === '' ? -1 : Number(e.target.value) }); changed() }}>
        <option value="">Selecione um horário calculado</option>{control.preview?.slots.map(slot => <option key={slot.index} value={slot.index}>Índice {slot.index}: {slot.startsAt} até {slot.endsAt}{slot.adjusted ? ' (ajustado)' : ''}</option>)}
      </select></label>{' '}<button type="button" onClick={() => { control.selection(entry.before.id, null); changed() }}>Remover seleção {entry.before.id}</button>
    </div>)}
    {control.stale.length > 0 && <p role="alert">Há seleção alterada na consulta atual. Remova e selecione novamente para revisar os novos dados. Revisões originais não foram substituídas.</p>}
    {error && <p role="alert">{error}</p>}
    <button disabled={!control.preview || !entries.length || control.stale.length > 0}>Revisar edição selecionada</button>
  </fieldset></form>
    {confirmation && !control.attempted && !control.rootStale && !control.stale.length && control.preview === confirmation.preview && <section aria-label="Confirmar edição seletiva">
      <h2>Confirmar somente {confirmation.selections.length} ocorrências</h2>
      <p>Revisão da série {confirmation.before.revision} · ano {confirmation.preview.pattern.year} · fuso {confirmation.preview.timezone} · {confirmation.preview.pattern.frequency} a cada {confirmation.preview.pattern.interval}, de {confirmation.preview.pattern.firstStartsAt} até {confirmation.preview.pattern.through}, duração {confirmation.preview.pattern.durationMinutes} minutos.</p>
      <p>Capacidade {confirmation.config.capacity ?? 'ilimitada'} · modalidade {confirmation.config.modality} · participação {confirmation.config.participationMode} · check-in {confirmation.config.checkInRequired ? 'obrigatório' : 'não obrigatório'}.</p>
      <ul>{confirmation.selections.map(entry => { const slot = confirmation.preview.slots.find(value => value.index === entry.slotIndex)!; return <li key={entry.before.id}>{entry.before.id} (revisão {entry.before.revision}) → índice {slot.index}: {slot.startsAt} até {slot.endsAt}.</li> })}</ul>
      <p>Publicadas e não selecionadas permanecem intactas. Tipo, versão vinculada e espaço são preservados. Não cria ou exclui ocorrências, inscrições, presenças ou notificações. Prévia não reserva horário.</p>
      <button disabled={control.busy} onClick={() => void control.apply(confirmation)}>Confirmar edição da seleção</button>{' '}<button disabled={control.busy} onClick={() => setConfirmation(null)}>Voltar sem gravar</button>
    </section>}
  </>
}
function Records({ churchId, seriesId, control }: { churchId: string; seriesId: string; control: SeriesEditor }) {
  const { page, observe } = control
  const load = useCallback(async (signal: AbortSignal) => { const data = await readSeries(churchId, seriesId, page, signal); if (!signal.aborted) observe(data); return data }, [churchId, seriesId, page, observe])
  const query = useRead(`${churchId}:${seriesId}:${page}`, load)
  return <ReadResult query={query} label="série">{data => <>
    <h2>Série {data.id}</h2><p>Revisão consultada {data.revision} · fuso persistido {data.timezone} · ano delimitado {data.boundedYear ?? 'não demonstrado'} · indicador ativo {data.active ? 'sim' : 'não'}.</p>
    <p>Regra descritiva: {data.rrule}. Não é reinterpretada pelo navegador.</p>
    {data.pattern === null && <p>Série legada sem parâmetros completos. Informe proposta explícita; o servidor valida seu limite anual e fuso.</p>}
    <p>Página {data.page + 1} · {data.total} ocorrências em todos os estados. Total não representa rascunhos editáveis.</p>
    {data.items.length ? <ul className="event-list">{data.items.map(item => <li key={item.id}><Link to={`/eventos/igrejas/${churchId}/ocorrencias/${item.id}`}>Ocorrência {item.id}</Link><p>Estado {item.status} · revisão {item.revision} · {item.startsAt} até {item.endsAt}.</p><p>{editableOccurrence(item) ? 'Rascunho nunca publicado; seleção permitida com edição.' : 'Consulta preservada; não pode ser selecionada para edição.'}</p></li>)}</ul> : <p>Nenhuma ocorrência nesta página da série.</p>}
    <Pagination page={page} total={data.total} setPage={control.setPage} label="Páginas da série"/>
    {!control.result && <><PatternForm control={control}/>
      {control.preview && <section aria-label="Prévia calculada"><h2>Horários calculados sem gravação</h2><p>{control.preview.slots.length} destinos · fuso {control.preview.timezone}. Datas inexistentes avançam ao próximo válido; ambíguas usam primeiro offset, conforme servidor.</p><ul>{control.preview.slots.map(slot => <li key={slot.index}>Índice {slot.index}: {slot.startsAt} até {slot.endsAt} · {slot.adjusted ? 'Ajustado pelo servidor' : 'Sem ajuste'}.</li>)}</ul></section>}
      <ResourceAccess permissionCode="EVENT_EDIT" resourceType="CHURCH" resourceId={churchId} optional><SelectionForm key={`${data.revision}:${page}`} data={data} control={control}/></ResourceAccess>
    </>}
  </>}</ReadResult>
}
function Workspace({ churchId, seriesId }: { churchId: string; seriesId: string }) {
  const control = useSeriesEditor(churchId, seriesId)
  return <ResourceAccess key={control.epoch} permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId}>
    <button disabled={control.busy} onClick={control.reload}>Descartar proposta e recarregar série</button>
    {control.rootStale && <p role="alert">A revisão da série mudou. Descarte a proposta e recarregue antes de continuar.</p>}
    {control.message && <p role="alert">{control.message}</p>}{control.busy && <p role="status" aria-busy="true">Processando proposta…</p>}
    {control.result && <section aria-label="Edição confirmada"><h2>Edição confirmada pelo servidor</h2><p>Revisão da série {control.result.revision} · padrão {control.result.patternChanged ? 'alterado' : 'preservado'}.</p><ul>{control.result.items.map(item => <li key={item.id}>{item.id}: revisão {item.beforeRevision} → {item.revision}, índice {item.slotIndex}, {item.changed ? 'alterada' : 'sem alteração'}.</li>)}</ul><p>Recarregue a série para consultar os registros atuais antes de outra edição.</p></section>}
    {control.attempted && !control.result && <p>Nova escrita bloqueada. Confira os registros antes de descartar esta tentativa.</p>}
    <Records churchId={churchId} seriesId={seriesId} control={control}/>
  </ResourceAccess>
}
export default function SeriesPage() {
  const { churchId = '', seriesId = '' } = useParams(); const { account } = useAuth()
  return <div className="occurrences"><h1 data-page-title="Série anual">Consulta e edição seletiva de série anual</h1><Link to="/eventos">Voltar a Eventos</Link>
    {!isUuid(churchId) || !isUuid(seriesId) ? <p role="alert">O acesso à série é inválido. Abra a série vinculada de uma ocorrência autorizada.</p> : <Workspace key={`${account?.id}:${churchId}:${seriesId}`} churchId={churchId} seriesId={seriesId}/>}
  </div>
}
