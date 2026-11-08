import { api, type ApiClient } from '../api'
import { isInstant, isUuid } from '../validation'
import { isCalendarYear } from './calendar-api'
import { instantNanos, parseOccurrence, type Occurrence } from './occurrence-api'

export interface CopiedItem { id: string; sourceOccurrenceId: string; startsAt: string; endsAt: string; status: 'DRAFT'; revision: 0; adjusted: boolean }
export interface CopyResult { churchId: string; year: number; timezone: string; recurrenceRuleId: null; items: CopiedItem[] }
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const invalid = () => new Error('Não foi possível validar a cópia. Confira origens e ocorrências antes de iniciar outro lote.')
export function validateCopySources(churchId: string, sourceYear: number, targetYear: number, sources: readonly Occurrence[]) {
  if (!isUuid(churchId) || !isCalendarYear(sourceYear) || !isCalendarYear(targetYear) || sources.length < 1 || sources.length > 100) throw invalid()
  const snapshots = sources.map(source => parseOccurrence(source, churchId))
  if (new Set(snapshots.map(v => v.id)).size !== snapshots.length || snapshots.some(v => v.status !== 'DRAFT' || instantNanos(v.endsAt) <= instantNanos(v.startsAt))) throw invalid()
  return snapshots
}
// event-planning-v1 1.0.0, integrated backend86db43b; no retry/idempotency key.
export async function copyAnnualDrafts(churchId: string, sourceYear: number, targetYear: number, sources: readonly Occurrence[], signal?: AbortSignal, client: ApiClient = api): Promise<CopyResult> {
  const snapshots = validateCopySources(churchId, sourceYear, targetYear, sources)
  const body = { sourceYear, targetYear, sources: snapshots.map(v => ({ occurrenceId: v.id, expectedRevision: v.revision })) }
  const raw = await client.request<unknown>(`/events/churches/${churchId}/planning/copy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  if (!record(raw) || raw.churchId !== churchId || raw.year !== targetYear || typeof raw.timezone !== 'string' || !raw.timezone.trim()
    || raw.recurrenceRuleId !== null || !Array.isArray(raw.items) || raw.items.length !== snapshots.length) throw invalid()
  const originals = new Map(snapshots.map(v => [v.id, v]))
  const items = raw.items.map(item => {
    if (!record(item) || typeof item.id !== 'string' || !isUuid(item.id) || originals.has(item.id) || typeof item.sourceOccurrenceId !== 'string') throw invalid()
    const source = originals.get(item.sourceOccurrenceId)
    if (!source || item.status !== 'DRAFT' || item.revision !== 0 || typeof item.adjusted !== 'boolean' || !isInstant(item.startsAt) || !isInstant(item.endsAt)
      || instantNanos(item.endsAt) - instantNanos(item.startsAt) !== instantNanos(source.endsAt) - instantNanos(source.startsAt)) throw invalid()
    return { id: item.id, sourceOccurrenceId: source.id, startsAt: item.startsAt, endsAt: item.endsAt, status: 'DRAFT', revision: 0, adjusted: item.adjusted } as CopiedItem
  })
  if (new Set(items.map(v => v.id)).size !== items.length || new Set(items.map(v => v.sourceOccurrenceId)).size !== items.length) throw invalid()
  return { churchId, year: targetYear, timezone: raw.timezone, recurrenceRuleId: null, items }
}
