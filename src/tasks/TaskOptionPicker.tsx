import { useCallback, useState } from 'react'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { options, type Destination } from './work-item-api'

export default function TaskOptionPicker({ church, kind, task, value, change, label = 'Destinatário' }: {
  church: string; kind: Destination; task?: string; value: string; change: (id: string) => void; label?: string
}) {
  const [text, setText] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(0), [selectedLabel, setSelectedLabel] = useState('Seleção atual')
  const load = useCallback((signal: AbortSignal) => options(church, kind, search, page, signal, task), [church, kind, search, page, task])
  const query = useRead(`${church}:${kind}:${task}:${search}:${page}`, load)
  return <section aria-label={`Escolher ${label.toLowerCase()}`}>
    <label>Buscar {label.toLowerCase()}<input maxLength={120} value={text} onChange={e => setText(e.target.value)}/></label>
    <button type="button" onClick={() => { setSearch(text); setPage(0) }}>Buscar</button>
    <ReadResult query={query} label={label.toLowerCase()}>{data => <>
      <label>{label}<select required value={value} onChange={e => { change(e.target.value); setSelectedLabel(data.items.find(v => v.id === e.target.value)?.label ?? 'Seleção atual') }}>
        <option value="">Selecione</option>
        {value && !data.items.some(v => v.id === value) && <option value={value}>{selectedLabel}</option>}
        {data.items.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select></label>
      {!data.items.length && <p>Nenhuma opção disponível nesta busca.</p>}
      {data.total > 20 && <Pagination page={page} total={data.total} setPage={setPage} label={`Páginas de ${label.toLowerCase()}`}/>}
    </>}</ReadResult>
  </section>
}
