import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api'
import { editableOccurrence } from './occurrence-api'
import { previewSeries, saveSeries, type SeriesChange, type SeriesConfig, type SeriesPage, type SeriesPreview, type SeriesSelection } from './series-api'
import { validateAnnualPattern, type AnnualPattern, type Frequency } from './generation-api'

export interface SeriesFields { year: string; frequency: string; interval: string; firstStartsAt: string; through: string; durationMinutes: string; capacity: string; modality: string; participationMode: string; checkInRequired: string }
const empty: SeriesFields = { year: '', frequency: '', interval: '', firstStartsAt: '', through: '', durationMinutes: '', capacity: '', modality: '', participationMode: '', checkInRequired: '' }
export interface SeriesIntent { before: SeriesPage; preview: SeriesPreview; config: SeriesConfig; selections: SeriesSelection[] }
export function patternFor(fields: SeriesFields): AnnualPattern {
  for (const key of ['year', 'interval', 'durationMinutes'] as const) if (!/^\d+$/.test(fields[key])) throw new Error('Informe ano, intervalo e duração inteiros.')
  return validateAnnualPattern({ year: Number(fields.year), frequency: fields.frequency as Frequency, interval: Number(fields.interval), firstStartsAt: fields.firstStartsAt, through: fields.through, durationMinutes: Number(fields.durationMinutes) })
}
export function useSeriesEditor(churchId: string, seriesId: string) {
  const [fields, setFields] = useState(empty)
  const [root, setRoot] = useState<SeriesPage | null>(null)
  const rootRef = useRef<SeriesPage | null>(null)
  const [page, setPage] = useState(0)
  const [epoch, setEpoch] = useState(0)
  const [selected, setSelected] = useState<Record<string, SeriesSelection>>({})
  const selectedRef = useRef<Record<string, SeriesSelection>>({})
  const [stale, setStale] = useState<string[]>([])
  const [rootStale, setRootStale] = useState(false)
  const rootStaleRef = useRef(false)
  const [preview, setPreview] = useState<SeriesPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<SeriesChange | null>(null)
  const pending = useRef<AbortController | null>(null)
  const sent = useRef(false)
  useEffect(() => () => pending.current?.abort(), [])
  const observe = useCallback((data: SeriesPage) => {
    if (data.id !== seriesId || data.churchId !== churchId) return
    if (!rootRef.current) {
      rootRef.current = data; setRoot(data)
      const p = data.pattern
      setFields({ ...empty, year: String(p?.year ?? data.boundedYear ?? ''), frequency: p?.frequency ?? '', interval: p ? String(p.interval) : '',
        firstStartsAt: p?.firstStartsAt ?? '', through: p?.through ?? '', durationMinutes: p ? String(p.durationMinutes) : '' })
    } else if (rootRef.current.revision !== data.revision) { rootStaleRef.current = true; setRootStale(true) }
    const changed = data.items.filter(item => selectedRef.current[item.id] && (selectedRef.current[item.id].before.revision !== item.revision || !editableOccurrence(item))).map(item => item.id)
    if (changed.length) setStale(old => [...new Set([...old, ...changed])])
  }, [seriesId, churchId])
  function change(field: keyof SeriesFields, value: string) {
    if (pending.current || sent.current) return
    setFields(old => ({ ...old, [field]: value })); setMessage('')
    if (['capacity', 'modality', 'participationMode', 'checkInRequired'].includes(field)) return
    setPreview(null)
    const next = Object.fromEntries(Object.entries(selectedRef.current).map(([id, entry]) => [id, { ...entry, slotIndex: -1 }]))
    selectedRef.current = next; setSelected(next)
  }
  function selection(id: string, entry: SeriesSelection | null) {
    if (pending.current || sent.current) return
    if (entry && !selectedRef.current[id] && Object.keys(selectedRef.current).length >= 366) return
    const next = { ...selectedRef.current }; if (entry) next[id] = entry; else delete next[id]
    selectedRef.current = next; setSelected(next); if (!entry) setStale(old => old.filter(value => value !== id))
  }
  async function calculate() {
    if (!rootRef.current || pending.current || sent.current || rootStaleRef.current) return
    setMessage(''); setPreview(null)
    try {
      const pattern = patternFor(fields); const before = rootRef.current
      const controller = new AbortController(); pending.current = controller; setBusy(true)
      const value = await previewSeries(churchId, before, pattern, controller.signal)
      if (!controller.signal.aborted && !rootStaleRef.current) {
        setPreview(value)
        const next = Object.fromEntries(Object.entries(selectedRef.current).map(([id, entry]) => [id, { ...entry, slotIndex: -1 }]))
        selectedRef.current = next; setSelected(next)
      }
    } catch (error) { if (!pending.current?.signal.aborted) setMessage(error instanceof ApiError || error instanceof Error ? error.message : 'Não foi possível calcular a prévia.') }
    finally { const aborted = pending.current?.signal.aborted; pending.current = null; if (!aborted) setBusy(false) }
  }
  async function apply(intent: SeriesIntent) {
    if (pending.current || sent.current || rootStaleRef.current || stale.length) return
    sent.current = true; setAttempted(true); setBusy(true); setMessage('')
    const controller = new AbortController(); pending.current = controller
    try {
      const value = await saveSeries(churchId, intent.before, intent.preview, intent.config, intent.selections, controller.signal)
      if (!controller.signal.aborted) setResult(value)
    } catch (error) {
      if (!controller.signal.aborted) setMessage(`${error instanceof ApiError ? error.message : 'Não foi possível confirmar a edição.'} O resultado pode ter sido gravado. Confira a série e as ocorrências antes de iniciar outra tentativa.`)
    } finally { pending.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  function reload() {
    if (pending.current) return
    rootRef.current = null; rootStaleRef.current = false; selectedRef.current = {}; sent.current = false
    setRoot(null); setRootStale(false); setSelected({}); setStale([]); setPreview(null); setMessage(''); setResult(null); setAttempted(false); setFields(empty); setEpoch(v => v + 1)
  }
  return { fields, root, page, setPage, epoch, selected, stale, rootStale, preview, busy, attempted, message, result, observe, change, selection, calculate, apply, reload }
}
export type SeriesEditor = ReturnType<typeof useSeriesEditor>
