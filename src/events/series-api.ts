import { api, type ApiClient } from '../api'
import { isInstant, isUuid } from '../validation'
import { isCalendarYear } from './calendar-api'
import { validateAnnualPattern, type AnnualPattern } from './generation-api'
import { editableOccurrence, instantNanos, parseOccurrence, type Modality, type Occurrence, type Participation } from './occurrence-api'

// event-series-v1 1.0.0, integrated backend #113.
export interface SeriesPage { id: string; churchId: string; eventTypeId: string; timezone: string; rrule: string; active: boolean; revision: number; pattern: AnnualPattern | null; boundedYear: number | null; items: Occurrence[]; page: number; size: number; total: number }
export interface SeriesSlot { index: number; startsAt: string; endsAt: string; adjusted: boolean }
export interface SeriesPreview { id: string; revision: number; timezone: string; slots: SeriesSlot[]; pattern: AnnualPattern }
export interface SeriesConfig { capacity: number | null; modality: Modality; participationMode: Participation; checkInRequired: boolean }
export interface SeriesSelection { before: Occurrence; slotIndex: number }
export interface SeriesChange { id: string; revision: number; patternChanged: boolean; items: { id: string; beforeRevision: number; revision: number; slotIndex: number; changed: boolean }[] }
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const invalid = () => new Error('Não foi possível validar a série. Atualize a consulta antes de continuar.')
function base(churchId: string, seriesId: string) {
  if (!isUuid(churchId) || !isUuid(seriesId)) throw invalid()
  return `/events/churches/${churchId}/planning/series/${seriesId}`
}
export async function readSeries(churchId: string, id: string, page = 0, signal?: AbortSignal, client: ApiClient = api): Promise<SeriesPage> {
  const path = base(churchId, id)
  if (!integer(page) || page > 100000) throw invalid()
  const v = await client.request<unknown>(`${path}?page=${page}&size=20`, { signal })
  if (!record(v) || v.id !== id || v.churchId !== churchId || !uuid(v.eventTypeId) || typeof v.timezone !== 'string' || !v.timezone.trim()
    || typeof v.rrule !== 'string' || typeof v.active !== 'boolean' || !integer(v.revision) || !integer(v.total) || v.page !== page || v.size !== 20
    || !Array.isArray(v.items) || v.items.length !== Math.min(20, Math.max(0, v.total - page * 20))
    || (v.boundedYear !== null && !isCalendarYear(v.boundedYear as number)) || (v.pattern !== null && !record(v.pattern))) throw invalid()
  const pattern = v.pattern === null ? null : validateAnnualPattern(v.pattern as unknown as AnnualPattern)
  const items = v.items.map(item => parseOccurrence(item, churchId))
  if (new Set(items.map(item => item.id)).size !== items.length || items.some(item => item.recurrenceRuleId !== id || item.eventTypeId !== v.eventTypeId)) throw invalid()
  return { id, churchId, eventTypeId: v.eventTypeId, timezone: v.timezone, rrule: v.rrule, active: v.active, revision: v.revision, pattern,
    boundedYear: v.boundedYear as number | null, items, page, size: 20, total: v.total }
}
export function validateSeriesConfig(input: SeriesConfig): SeriesConfig {
  if ((input.capacity !== null && (!integer(input.capacity) || input.capacity > 2147483647)) || !['IN_PERSON', 'ONLINE', 'HYBRID'].includes(input.modality)
    || !['REGISTRATION_REQUIRED', 'OPEN_EVENT'].includes(input.participationMode) || typeof input.checkInRequired !== 'boolean'
    || (input.participationMode === 'OPEN_EVENT' && input.checkInRequired)) throw new Error('Revise capacidade, modalidade, participação e check-in. Evento aberto exige check-in Não.')
  return { capacity: input.capacity, modality: input.modality, participationMode: input.participationMode, checkInRequired: input.checkInRequired }
}
export async function previewSeries(churchId: string, before: SeriesPage, input: AnnualPattern, signal?: AbortSignal, client: ApiClient = api): Promise<SeriesPreview> {
  const path = base(churchId, before.id); const pattern = validateAnnualPattern(input)
  if (before.churchId !== churchId || !integer(before.revision) || (before.pattern && before.pattern.year !== pattern.year)) throw invalid()
  const v = await client.request<unknown>(`${path}/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pattern), signal })
  if (!record(v) || v.id !== before.id || v.revision !== before.revision || v.timezone !== before.timezone || !Array.isArray(v.slots) || v.slots.length < 1 || v.slots.length > 366) throw invalid()
  const slots = v.slots.map((slot, index): SeriesSlot => {
    if (!record(slot) || slot.index !== index || !isInstant(slot.startsAt) || !isInstant(slot.endsAt) || typeof slot.adjusted !== 'boolean'
      || instantNanos(slot.endsAt) - instantNanos(slot.startsAt) !== BigInt(pattern.durationMinutes) * 60000000000n) throw invalid()
    return { index, startsAt: slot.startsAt, endsAt: slot.endsAt, adjusted: slot.adjusted }
  })
  if (slots.some((slot, index) => index > 0 && instantNanos(slot.startsAt) <= instantNanos(slots[index - 1].startsAt))) throw invalid()
  return { id: before.id, revision: before.revision, timezone: before.timezone, slots, pattern }
}
export function validateSeriesSelections(churchId: string, before: SeriesPage, preview: SeriesPreview, selections: SeriesSelection[]) {
  base(churchId, before.id)
  if (before.churchId !== churchId || !integer(before.revision) || preview.id !== before.id || preview.revision !== before.revision || preview.timezone !== before.timezone
    || selections.length < 1 || selections.length > 366) throw invalid()
  const ids = new Set<string>(); const indices = new Set<number>()
  return selections.map(({ before: value, slotIndex }) => {
    const item = parseOccurrence(value, churchId)
    if (!editableOccurrence(item) || item.recurrenceRuleId !== before.id || item.eventTypeId !== before.eventTypeId || !integer(slotIndex)
      || !preview.slots.some(slot => slot.index === slotIndex) || ids.has(item.id) || indices.has(slotIndex)) throw new Error('Selecione rascunhos nunca publicados e associe um horário diferente a cada ocorrência, sem repetir destinos.')
    ids.add(item.id); indices.add(slotIndex)
    return { occurrenceId: item.id, expectedRevision: item.revision, slotIndex }
  })
}
export async function saveSeries(churchId: string, before: SeriesPage, preview: SeriesPreview, config: SeriesConfig, selections: SeriesSelection[], signal?: AbortSignal, client: ApiClient = api): Promise<SeriesChange> {
  const path = base(churchId, before.id)
  const body = { pattern: validateAnnualPattern(preview.pattern), selections: validateSeriesSelections(churchId, before, preview, selections), ...validateSeriesConfig(config) }
  const v = await client.request<unknown>(path, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Expected-Revision': String(before.revision) }, body: JSON.stringify(body), signal })
  if (!record(v) || v.id !== before.id || !integer(v.revision) || typeof v.patternChanged !== 'boolean' || !Array.isArray(v.items) || v.items.length !== body.selections.length) throw invalid()
  const seen = new Set<string>()
  const items = v.items.map(item => {
    if (!record(item) || !uuid(item.id) || seen.has(item.id) || typeof item.changed !== 'boolean' || !integer(item.revision)) throw invalid()
    const selected = body.selections.find(value => value.occurrenceId === item.id)
    if (!selected || item.beforeRevision !== selected.expectedRevision || item.slotIndex !== selected.slotIndex || item.revision !== selected.expectedRevision + (item.changed ? 1 : 0)) throw invalid()
    const original = selections.find(value => value.before.id === item.id)!.before
    const slot = preview.slots.find(value => value.index === selected.slotIndex)!
    const changed = instantNanos(original.startsAt) !== instantNanos(slot.startsAt) || instantNanos(original.endsAt) !== instantNanos(slot.endsAt)
      || original.capacity !== body.capacity || original.modality !== body.modality || original.participationMode !== body.participationMode || original.checkInRequired !== body.checkInRequired
    if (item.changed !== changed) throw invalid()
    seen.add(item.id)
    return { id: item.id, beforeRevision: selected.expectedRevision, revision: item.revision, slotIndex: selected.slotIndex, changed: item.changed }
  })
  if (v.revision !== before.revision + (v.patternChanged || items.some(item => item.changed) ? 1 : 0)) throw invalid()
  return { id: before.id, revision: v.revision, patternChanged: v.patternChanged, items }
}
