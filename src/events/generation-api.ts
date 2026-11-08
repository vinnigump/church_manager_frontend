import { api, type ApiClient } from '../api'
import { isInstant, isUuid } from '../validation'
import { instantNanos, type Modality, type Participation } from './occurrence-api'
import { isCalendarYear } from './calendar-api'

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'
export interface GenerationInput { year: number; frequency: Frequency; interval: number; firstStartsAt: string; through: string; durationMinutes: number; eventTypeId: string; capacity: number | null; modality: Modality; participationMode: Participation; checkInRequired: boolean }
export interface GeneratedItem { id: string; sourceOccurrenceId: null; startsAt: string; endsAt: string; status: 'DRAFT'; revision: 0; adjusted: boolean }
export interface GenerationResult { churchId: string; year: number; timezone: string; recurrenceRuleId: string; items: GeneratedItem[] }
const integer = (v: number, min: number, max: number) => Number.isSafeInteger(v) && v >= min && v <= max
export function validateGeneration(input: GenerationInput): GenerationInput {
  const first = input.firstStartsAt.length === 16 ? `${input.firstStartsAt}:00` : input.firstStartsAt
  if (!isCalendarYear(input.year) || !['DAILY', 'WEEKLY', 'MONTHLY'].includes(input.frequency) || !integer(input.interval, 1, 366)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/.test(first) || !isInstant(`${first}Z`)
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.through) || !isInstant(`${input.through}T00:00:00Z`)
    || Number(first.slice(0, 4)) !== input.year || Number(input.through.slice(0, 4)) !== input.year || input.through < first.slice(0, 10)
    || !integer(input.durationMinutes, 1, 527040) || !isUuid(input.eventTypeId)
    || (input.capacity !== null && !integer(input.capacity, 0, 2147483647))
    || !['IN_PERSON', 'ONLINE', 'HYBRID'].includes(input.modality) || !['REGISTRATION_REQUIRED', 'OPEN_EVENT'].includes(input.participationMode)
    || typeof input.checkInRequired !== 'boolean' || (input.participationMode === 'OPEN_EVENT' && input.checkInRequired)) throw new Error('Revise ano, intervalo, datas civis, duração e configuração da série. Evento aberto exige check-in Não.')
  return { year: input.year, frequency: input.frequency, interval: input.interval, firstStartsAt: first, through: input.through, durationMinutes: input.durationMinutes,
    eventTypeId: input.eventTypeId, capacity: input.capacity, modality: input.modality, participationMode: input.participationMode, checkInRequired: input.checkInRequired }
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const invalid = () => new Error('Não foi possível confirmar a geração. Consulte as ocorrências antes de iniciar outra série.')
export async function generateAnnualSeries(churchId: string, input: GenerationInput, signal?: AbortSignal, client: ApiClient = api): Promise<GenerationResult> {
  if (!isUuid(churchId)) throw invalid()
  const body = validateGeneration(input)
  const raw = await client.request<unknown>(`/events/churches/${churchId}/planning/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  if (!record(raw) || raw.churchId !== churchId || raw.year !== body.year || typeof raw.timezone !== 'string' || !raw.timezone.trim()
    || typeof raw.recurrenceRuleId !== 'string' || !isUuid(raw.recurrenceRuleId) || !Array.isArray(raw.items) || raw.items.length < 1 || raw.items.length > 366) throw invalid()
  const items = raw.items.map(item => {
    if (!record(item) || typeof item.id !== 'string' || !isUuid(item.id) || item.sourceOccurrenceId !== null || item.status !== 'DRAFT' || item.revision !== 0
      || !isInstant(item.startsAt) || !isInstant(item.endsAt) || typeof item.adjusted !== 'boolean'
      || instantNanos(item.endsAt) - instantNanos(item.startsAt) !== BigInt(body.durationMinutes) * 60000000000n) throw invalid()
    return { id: item.id, sourceOccurrenceId: null, startsAt: item.startsAt, endsAt: item.endsAt, status: 'DRAFT', revision: 0, adjusted: item.adjusted } as GeneratedItem
  })
  if (new Set(items.map(item => item.id)).size !== items.length) throw invalid()
  return { churchId, year: body.year, timezone: raw.timezone, recurrenceRuleId: raw.recurrenceRuleId, items }
}
