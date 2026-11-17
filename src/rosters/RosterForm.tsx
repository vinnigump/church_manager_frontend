import { useCallback, useEffect, useState, type FormEvent } from 'react'
import BrazilianDateTimeField from '../components/BrazilianDateTimeField'
import { wallTimeBR } from '../time'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { selectAccounts, selectUnits, selectEvents, selectedEvent } from './roster-api'
import { type Fields } from './roster-fields'

type Change = (fields: Fields) => void
function UnitPicker({ church, fields, change }: { church: string; fields: Fields; change: Change }) {
  const [query, setQuery] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => selectUnits(church, query, page, signal), [church, query, page])
  const result = useRead(`${church}:${query}:${page}`, load)
  return <section><h2>Ministério ou departamento</h2>
    <label>Pesquisar unidade<input maxLength={120} value={search} onChange={e => setSearch(e.target.value)}/></label>
    <button type="button" onClick={() => { setPage(0); setQuery(search) }}>Pesquisar unidades</button>
    <ReadResult query={result} label="unidades da escala">{data => <>
      <label>Unidade da escala<select required value={fields.unit ? `${fields.unit.kind}:${fields.unit.id}` : ''} onChange={e => {
        const unit = data.items.find(v => `${v.kind}:${v.id}` === e.target.value); change({ ...fields, unit: unit ?? null })
      }}><option value="">Selecione</option>
        {fields.unit && !data.items.some(v => v.id === fields.unit?.id && v.kind === fields.unit?.kind) && <option value={`${fields.unit.kind}:${fields.unit.id}`}>{fields.unit.name} (seleção atual)</option>}
        {data.items.map(v => <option key={`${v.kind}:${v.id}`} value={`${v.kind}:${v.id}`}>{v.kind === 'DEPARTMENT' ? `${v.name} · ${v.ministryName}` : v.name}</option>)}
      </select></label>{!data.items.length && <p>Nenhuma unidade ativa encontrada.</p>}
      <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das unidades da escala"/>
    </>}</ReadResult>
  </section>
}
function AccountPicker({ church, fields, change }: { church: string; fields: Fields; change: Change }) {
  const [query, setQuery] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => selectAccounts(church, query, page, signal), [church, query, page])
  const result = useRead(`${church}:${query}:${page}`, load)
  return <section><h2>Quem vai atuar?</h2>
    {fields.accounts.length > 0 && <ul>{fields.accounts.map(v => <li key={v.accountId}>{v.displayName} <button type="button" aria-label={`Remover ${v.displayName}`} onClick={() => change({ ...fields, accounts: fields.accounts.filter(p => p.accountId !== v.accountId) })}>Remover</button></li>)}</ul>}
    <label>Pesquisar pessoas<input maxLength={120} value={search} onChange={e => setSearch(e.target.value)}/></label>
    <button type="button" onClick={() => { setPage(0); setQuery(search) }}>Pesquisar pessoas da igreja</button>
    <ReadResult query={result} label="pessoas da escala">{data => <>
      {data.items.length ? data.items.map(v => <label className="roster-check" key={v.accountId}><input type="checkbox" checked={fields.accounts.some(p => p.accountId === v.accountId)} onChange={e => change({ ...fields,
        accounts: e.target.checked ? [...fields.accounts, v] : fields.accounts.filter(p => p.accountId !== v.accountId) })}/>{v.displayName}</label>) : <p>Nenhuma conta ativa associada à igreja encontrada.</p>}
      <Pagination page={page} total={data.total} setPage={setPage} label="Páginas das pessoas da escala"/>
    </>}</ReadResult>
  </section>
}
function EventPicker({ church, fields, change }: { church: string; fields: Fields; change: Change }) {
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => selectEvents(church, page, signal), [church, page])
  const result = useRead(`${church}:${page}`, load)
  const loadSelected = useCallback((signal: AbortSignal) => fields.eventId ? selectedEvent(church, fields.eventId, signal) : Promise.resolve(null), [church, fields.eventId])
  const selected = useRead(church + ':' + fields.eventId, loadSelected)
  useEffect(() => {
    if (selected.state.kind !== 'ready' || !selected.state.data || selected.state.data.id !== fields.eventId) return
    const event = selected.state.data
    if (!fields.eventResolved || fields.eventStartsAt !== event.startsAt || fields.eventEndsAt !== event.endsAt)
      change({ ...fields, eventResolved: true, eventName: event.name, eventStartsAt: event.startsAt, eventEndsAt: event.endsAt, startsAt: wallTimeBR(event.startsAt), endsAt: wallTimeBR(event.endsAt) })
  }, [selected.state, fields, change])
  return <><ReadResult query={selected} label="período do evento">{() => null}</ReadResult><ReadResult query={result} label="eventos para a escala">{data => <>
    <label>Evento associado<select required value={fields.eventId} onChange={e => { const value = data.items.find(v => v.id === e.target.value); change({ ...fields, eventId: value?.id ?? '', eventName: value?.name ?? '', eventResolved: Boolean(value), eventStartsAt: value?.startsAt, eventEndsAt: value?.endsAt, startsAt: value ? wallTimeBR(value.startsAt) : fields.startsAt, endsAt: value ? wallTimeBR(value.endsAt) : fields.endsAt }) }}>
      <option value="">Selecione</option>{fields.eventId && !data.items.some(v => v.id === fields.eventId) && <option value={fields.eventId}>{fields.eventName || 'Evento já vinculado'}</option>}
      {data.items.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
    </select></label><Pagination page={page} total={data.total} setPage={setPage} label="Páginas dos eventos da escala"/>
  </>}</ReadResult></>
}
export default function RosterForm({ church, fields, change, disabled, submit }: {
  church: string; fields: Fields; change: Change; disabled: boolean; submit: (e: FormEvent) => void
}) {
  return <form aria-label="Cadastro de escala" onSubmit={submit}><fieldset disabled={disabled}><legend>Previsão de atuação</legend>
    <UnitPicker church={church} fields={fields} change={change}/>
    <label>Início<BrazilianDateTimeField required disabled={fields.eventEnabled} value={fields.startsAt} onChange={e => change({ ...fields, startsAt: e.target.value })}/></label>
    <label>Término<BrazilianDateTimeField required disabled={fields.eventEnabled} value={fields.endsAt} onChange={e => change({ ...fields, endsAt: e.target.value })}/></label>
    <p>Horários de Brasília (24 horas).{fields.eventEnabled && ' O período acompanha exatamente o evento associado.'}</p>
    <AccountPicker church={church} fields={fields} change={change}/>
    <label className="roster-check"><input type="checkbox" checked={fields.eventEnabled} onChange={e => change({ ...fields, eventEnabled: e.target.checked })}/>Associar a um evento</label>
    {fields.eventEnabled && <EventPicker church={church} fields={fields} change={change}/>}
    <p>Salvar organiza a escala prevista. A presença será registrada separadamente por uma pessoa autorizada.</p>
    <button type="submit">Salvar escala</button>
  </fieldset></form>
}
