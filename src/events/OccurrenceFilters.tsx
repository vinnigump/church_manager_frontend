import { useId, useState, type FormEvent } from 'react'
import { occurrenceStatuses, validateOccurrenceFilters, type OccurrenceFilters, type Modality } from './occurrence-api'

interface Fields { from: string; to: string; modality: string; status: string }
const empty = { from: '', to: '', modality: '', status: '' }
const utc = (value: string) => `${value.length === 16 ? `${value}:00` : value}Z`
export function useOccurrenceFilters() {
  // Above ResourceAccess: focus reauthorization must not erase unapplied fields.
  const [fields, setFields] = useState<Fields>(empty)
  const [filters, setFilters] = useState<OccurrenceFilters>({})
  const [page, setPage] = useState(0)
  const [error, setError] = useState('')
  function apply(event: FormEvent) {
    event.preventDefault()
    try {
      const next = validateOccurrenceFilters({ ...(fields.from && { from: utc(fields.from) }), ...(fields.to && { to: utc(fields.to) }),
        ...(fields.modality && { modality: fields.modality as Modality }), ...(fields.status && { status: fields.status as OccurrenceFilters['status'] }) })
      setFilters(next); setPage(0); setError('')
    } catch { setError('Informe limites UTC válidos, com até microssegundos e término posterior ao início.') }
  }
  function clear() { setFields(empty); setFilters({}); setPage(0); setError('') }
  return { fields, setFields, filters, page, setPage, error, apply, clear }
}
export type OccurrenceFilterControl = ReturnType<typeof useOccurrenceFilters>
export default function OccurrenceFiltersForm({ control }: { control: OccurrenceFilterControl }) {
  const id = useId()
  const change = (field: keyof Fields, value: string) => control.setFields(v => ({ ...v, [field]: value }))
  return <form className="events-panel" onSubmit={control.apply} aria-label="Filtros das ocorrências">
    <h2>Filtrar ocorrências administrativas</h2>
    <p>Limites opcionais em UTC. O período inclui ocorrências que o atravessam: o término deve ser posterior ao limite inicial e o início anterior ao limite final. Eventos apenas adjacentes ficam fora.</p>
    <p>Formato sem offset: AAAA-MM-DDTHH:mm, com segundos e até seis casas decimais opcionais. Exemplo: 2026-11-08T10:00:00.123456.</p>
    <div className="event-filters">
      <label htmlFor={`${id}-from`}>Limite inicial (UTC)<input id={`${id}-from`} type="text" placeholder="AAAA-MM-DDTHH:mm:ss.ffffff" value={control.fields.from} onChange={e => change('from', e.target.value)} aria-invalid={Boolean(control.error)} aria-describedby={control.error ? `${id}-error` : undefined}/></label>
      <label htmlFor={`${id}-to`}>Limite final exclusivo (UTC)<input id={`${id}-to`} type="text" placeholder="AAAA-MM-DDTHH:mm:ss.ffffff" value={control.fields.to} onChange={e => change('to', e.target.value)} aria-invalid={Boolean(control.error)} aria-describedby={control.error ? `${id}-error` : undefined}/></label>
      <label htmlFor={`${id}-modality`}>Modalidade do filtro<select id={`${id}-modality`} value={control.fields.modality} onChange={e => change('modality', e.target.value)}><option value="">Todas as modalidades</option><option value="IN_PERSON">Presencial</option><option value="ONLINE">Online</option><option value="HYBRID">Híbrido</option></select></label>
      <label htmlFor={`${id}-status`}>Estado do filtro<select id={`${id}-status`} value={control.fields.status} onChange={e => change('status', e.target.value)}><option value="">Todos os estados</option>{occurrenceStatuses.map(status => <option key={status} value={status}>{status}{['OPEN', 'CLOSED'].includes(status) ? ' (legado)' : ''}</option>)}</select></label>
    </div>
    <p>Os filtros são combinados. Alterar os campos só modifica a consulta ao aplicar; a totalização vem do servidor. OPEN/CLOSED são estados legados, não modos de participação.</p>
    {control.error && <p id={`${id}-error`} role="alert">{control.error}</p>}
    <button>Aplicar filtros</button>{' '}<button type="button" onClick={control.clear}>Limpar filtros</button>
  </form>
}
