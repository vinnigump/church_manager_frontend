import { useCallback, useState, type FormEvent } from 'react'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { listChurchCatalog } from './catalog-api'
import { audienceCategories } from './audience-api'
import { offsetOptions, visibilityLabel, type RecordFields } from './record-form'
import type { EventRecord } from './record-api'

function TypePicker({ church, fields, change, fixed }: { church: string; fields: RecordFields; change: (fields: RecordFields) => void; fixed: boolean }) {
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => listChurchCatalog(church, page, signal), [church, page])
  const query = useRead(`${church}:${page}`, load)
  return <ReadResult query={query} label="tipos de evento">{data => <>
    <label>Tipo de evento<select required value={fields.eventTypeId} disabled={fixed} onChange={e => change({ ...fields, eventTypeId: e.target.value })}>
      <option value="">Selecione um tipo</option>
      {fields.eventTypeId && !data.items.some(t => t.id === fields.eventTypeId) && <option value={fields.eventTypeId}>Tipo atual (fora desta página)</option>}
      {data.items.map(t => <option key={t.id} value={t.id} disabled={!t.enabled}>{t.name}{!t.enabled ? ' (indisponível)' : ''}</option>)}
    </select></label>
    {!data.items.length && <p>Nenhum tipo disponível. Solicite a configuração do catálogo à administração.</p>}
    {data.total > 20 && <Pagination page={page} total={data.total} setPage={setPage} label="Páginas de tipos"/>}
  </>}</ReadResult>
}
const categories = { functionIds: 'Funções eclesiásticas', ministryIds: 'Ministérios', departmentIds: 'Departamentos' }
export default function RecordForm({ church, before, fields, change, offset, busy, blocked, onSave }: {
  church: string; before: EventRecord | null; fields: RecordFields; change: (fields: RecordFields) => void
  offset: (value: string) => void; busy: boolean; blocked: boolean; onSave: (draft: boolean) => void
}) {
  const set = (name: keyof RecordFields, value: string | boolean) => change({ ...fields, [name]: value })
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const button = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    // Enter defaults to the safer draft action, never to availability.
    onSave(button?.value !== 'available')
  }
  return <form aria-label="Cadastro de evento" onSubmit={submit}><fieldset disabled={busy || blocked}>
    <legend>Dados do evento</legend><section className="record-form-section"><h2><span>1</span>Dados essenciais</h2>
    <label>Nome do evento<input required maxLength={180} value={fields.name} onChange={e => set('name', e.target.value)}/></label>
    <TypePicker church={church} fields={fields} change={change} fixed={Boolean(before?.recurrenceRuleId)}/>
    <label>Local ou endereço de acesso público<input required maxLength={500} value={fields.location} onChange={e => set('location', e.target.value)} aria-describedby="record-location-help"/></label>
    <p id="record-location-help">Este local será exibido ao público escolhido. Use apenas informações que podem ser compartilhadas.</p>
    <div className="record-grid">
      <label>Início<input type="datetime-local" required step="1" value={fields.startsAt} disabled={Boolean(before?.recurrenceRuleId)} onChange={e => set('startsAt', e.target.value)}/></label>
      <label>Término<input type="datetime-local" required step="1" value={fields.endsAt} disabled={Boolean(before?.recurrenceRuleId)} onChange={e => set('endsAt', e.target.value)}/></label>
    </div>
    <label>Fuso dos horários<select required value={fields.offset} onChange={e => offset(e.target.value)}>
      <option value="">Selecione o fuso</option>{offsetOptions.map(v => <option key={v} value={v}>UTC{v}</option>)}
    </select></label>
    {before?.recurrenceRuleId && <p>Este evento pertence a uma série. Tipo e datas são mantidos neste cadastro.</p>}
    <label>Modalidade<select required value={fields.modality} onChange={e => set('modality', e.target.value)}>
      <option value="">Selecione</option><option value="IN_PERSON">Presencial</option><option value="ONLINE">Online</option><option value="HYBRID">Híbrido</option>
    </select></label>
    </section><section className="record-form-section"><h2><span>2</span>Inscrição e capacidade</h2>
    <label>Como as pessoas participam?<select required value={fields.participationMode} onChange={e => change({ ...fields, participationMode: e.target.value,
      checkInRequired: e.target.value === 'OPEN_EVENT' ? false : fields.checkInRequired })}>
      <option value="">Selecione</option><option value="OPEN_EVENT">Entrada livre, sem inscrição</option><option value="REGISTRATION_REQUIRED">Com inscrição</option>
    </select></label>
    {fields.participationMode === 'REGISTRATION_REQUIRED' && <>
      <label className="record-check"><input type="checkbox" checked={fields.checkInRequired} onChange={e => set('checkInRequired', e.target.checked)}/>Exigir check-in dos participantes</label>
      <p>Após salvar, configure o período de inscrição no detalhe do evento para permitir novas inscrições.</p>
    </>}
    <details><summary>Limite de participantes</summary>
      <label>Capacidade (vazia: sem limite)<input type="number" min="0" max="2147483647" step="1" value={fields.capacity} onChange={e => set('capacity', e.target.value)}/></label>
    </details>
    </section><section className="record-form-section"><h2><span>3</span>Audiência e acesso</h2>
    <label>Quem pode ver o evento?<select required value={fields.visibility} onChange={e => set('visibility', e.target.value)}>
      <option value="">Selecione o público</option>{Object.entries(visibilityLabel).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select></label>
    <details><summary>Requisitos de participação</summary>
      <p>Estes requisitos são preservados ao editar e avaliados na inscrição. A opção “Pessoas que atendem aos requisitos” também limita a visualização.</p>
      <label className="record-check"><input type="checkbox" checked={fields.churchLinkRequired} onChange={e => set('churchLinkRequired', e.target.checked)}/>Exigir vínculo com a igreja</label>
      <label className="record-check"><input type="checkbox" checked={fields.activeMembershipRequired} onChange={e => set('activeMembershipRequired', e.target.checked)}/>Exigir membresia ativa</label>
      <div className="record-grid"><label>Idade mínima<input type="number" min="0" max="2147483647" value={fields.minimumAge} onChange={e => set('minimumAge', e.target.value)}/></label>
        <label>Idade máxima<input type="number" min="0" max="2147483647" value={fields.maximumAge} onChange={e => set('maximumAge', e.target.value)}/></label></div>
      {audienceCategories.filter(key => before?.audience?.[key].length).map(key => <p key={key}>{categories[key]}: {fields[key].length} seleções existentes preservadas.</p>)}
      <p>Novas seleções de ministérios, departamentos e funções ainda não estão disponíveis neste formulário.</p>
    </details>
    </section><p>Rascunhos ficam ocultos. Salvar como disponível mostra o evento conforme o público escolhido.</p>
    <div className="record-actions"><button type="submit" value="draft">Salvar rascunho</button><button type="submit" value="available">Salvar e disponibilizar</button></div>
  </fieldset></form>
}
