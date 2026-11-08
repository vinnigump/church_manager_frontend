import { api, type ApiClient } from '../api'
import { isUuid, isInstant as instant } from '../validation'

// Backend event-occurrences-v1 1.1.0 filters; existing write DTOs unchanged.
export type Modality = 'IN_PERSON' | 'ONLINE' | 'HYBRID'
export type Participation = 'REGISTRATION_REQUIRED' | 'OPEN_EVENT'
export interface Occurrence {
  id: string; churchId: string; eventTypeId: string; eventTypeVersionId: string | null; recurrenceRuleId: string | null
  startsAt: string; endsAt: string; capacity: number | null; status: string
  modality: Modality | null; participationMode: Participation | null; checkInRequired: boolean | null
  firstPublishedAt: string | null; revision: number; configured: boolean
}
export interface OccurrenceWrite {
  eventTypeId: string; startsAt: string; endsAt: string; capacity: number | null
  modality: Modality; participationMode: Participation; checkInRequired: boolean
}
export interface OccurrencePage { items: Occurrence[]; page: number; size: number; total: number }
export const occurrenceStatuses = ['DRAFT', 'OPEN', 'CLOSED', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
export interface OccurrenceFilters { from?: string; to?: string; modality?: Modality; status?: typeof occurrenceStatuses[number] }
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const nullableUuid = (v: unknown) => v === null || uuid(v)
const modality = (v: unknown): v is Modality => v === 'IN_PERSON' || v === 'ONLINE' || v === 'HYBRID'
const participation = (v: unknown): v is Participation => v === 'REGISTRATION_REQUIRED' || v === 'OPEN_EVENT'
const capacity = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= -2147483648 && (v as number) <= 2147483647
const invalid = () => new Error('Não foi possível validar os dados da ocorrência.')
export function instantNanos(value: string): bigint {
  if (!instant(value)) throw invalid()
  const fraction = /\.(\d+)/.exec(value)?.[1] ?? ''
  if (fraction.length > 9) throw invalid()
  return BigInt(Date.parse(value.replace(/\.\d+/, ''))) * 1000000n + BigInt(fraction.padEnd(9, '0'))
}
export function parseOccurrence(v: unknown, churchId: string): Occurrence {
  if (!record(v) || !uuid(v.id) || v.churchId !== churchId || !uuid(v.eventTypeId)
    || !nullableUuid(v.eventTypeVersionId) || !nullableUuid(v.recurrenceRuleId)
    || !instant(v.startsAt) || !instant(v.endsAt) || (v.capacity !== null && !capacity(v.capacity))
    || typeof v.status !== 'string' || !v.status.trim() || (v.modality !== null && !modality(v.modality))
    || (v.participationMode !== null && !participation(v.participationMode)) || (v.checkInRequired !== null && typeof v.checkInRequired !== 'boolean')
    || (v.firstPublishedAt !== null && !instant(v.firstPublishedAt)) || !Number.isSafeInteger(v.revision) || (v.revision as number) < 0
    || typeof v.configured !== 'boolean' || v.configured !== (v.modality !== null && v.participationMode !== null && v.checkInRequired !== null)) throw invalid()
  // Project only this contract. Never propagate links or participants from extra fields.
  return { id: v.id, churchId, eventTypeId: v.eventTypeId, eventTypeVersionId: v.eventTypeVersionId as string | null,
    recurrenceRuleId: v.recurrenceRuleId as string | null, startsAt: v.startsAt, endsAt: v.endsAt, capacity: v.capacity as number | null,
    status: v.status, modality: v.modality as Modality | null, participationMode: v.participationMode as Participation | null,
    checkInRequired: v.checkInRequired as boolean | null, firstPublishedAt: v.firstPublishedAt as string | null,
    revision: v.revision as number, configured: v.configured }
}
function base(churchId: string, id?: string) {
  if (!isUuid(churchId) || (id !== undefined && !isUuid(id))) throw new Error('Contexto de ocorrência inválido.')
  return `/events/churches/${churchId}/occurrences${id ? `/${id}` : ''}`
}
export function validateOccurrenceFilters(filters: OccurrenceFilters): OccurrenceFilters {
  if ((filters.from !== undefined && instantNanos(filters.from) % 1000n !== 0n)
    || (filters.to !== undefined && instantNanos(filters.to) % 1000n !== 0n)
    || (filters.from !== undefined && filters.to !== undefined && instantNanos(filters.to) <= instantNanos(filters.from))
    || (filters.modality !== undefined && !modality(filters.modality))
    || (filters.status !== undefined && !occurrenceStatuses.includes(filters.status))) throw new Error('Revise os filtros: limites válidos com até microssegundos, término posterior ao início e modalidade/estado conhecidos.')
  return { ...(filters.from !== undefined && { from: filters.from }), ...(filters.to !== undefined && { to: filters.to }),
    ...(filters.modality !== undefined && { modality: filters.modality }), ...(filters.status !== undefined && { status: filters.status }) }
}
export function listOccurrences(churchId: string, page = 0, signal?: AbortSignal, client: ApiClient = api): Promise<OccurrencePage> {
  return listFilteredOccurrences(churchId, {}, page, signal, client)
}
export async function listFilteredOccurrences(churchId: string, filters: OccurrenceFilters = {}, page = 0, signal?: AbortSignal, client: ApiClient = api): Promise<OccurrencePage> {
  const path = base(churchId)
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000) throw invalid()
  const applied = validateOccurrenceFilters(filters)
  const params = new URLSearchParams({ page: String(page), size: '20' })
  for (const key of ['from', 'to', 'modality', 'status'] as const) if (applied[key] !== undefined) params.set(key, applied[key])
  const v = await client.request<unknown>(`${path}?${params}`, { signal })
  if (!record(v) || !Array.isArray(v.items) || v.page !== page || v.size !== 20 || !Number.isSafeInteger(v.total)
    || (v.total as number) < 0 || v.items.length > 20 || (v.total as number) < v.items.length) throw invalid()
  const items = v.items.map(item => parseOccurrence(item, churchId))
  if (new Set(items.map(item => item.id)).size !== items.length || items.some(item =>
    (applied.from !== undefined && instantNanos(item.endsAt) <= instantNanos(applied.from))
    || (applied.to !== undefined && instantNanos(item.startsAt) >= instantNanos(applied.to))
    || (applied.modality !== undefined && item.modality !== applied.modality)
    || (applied.status !== undefined && item.status !== applied.status))) throw invalid()
  return { items, page, size: 20, total: v.total as number }
}
export async function readOccurrence(churchId: string, id: string, signal?: AbortSignal, client: ApiClient = api) {
  const result = parseOccurrence(await client.request<unknown>(base(churchId, id), { signal }), churchId)
  if (result.id !== id) throw invalid()
  return result
}
export function validateOccurrenceWrite(v: OccurrenceWrite): OccurrenceWrite {
  if (!uuid(v.eventTypeId) || !modality(v.modality) || !participation(v.participationMode) || typeof v.checkInRequired !== 'boolean'
    || (v.capacity !== null && (!capacity(v.capacity) || v.capacity < 0))
    || instantNanos(v.endsAt) <= instantNanos(v.startsAt) || instantNanos(v.startsAt) % 1000n !== 0n || instantNanos(v.endsAt) % 1000n !== 0n
    || (v.participationMode === 'OPEN_EVENT' && v.checkInRequired)) throw new Error('Revise a configuração: término posterior ao início, capacidade válida e evento aberto sem check-in. Datas aceitam até microssegundos.')
  return { eventTypeId: v.eventTypeId, startsAt: v.startsAt, endsAt: v.endsAt, capacity: v.capacity,
    modality: v.modality, participationMode: v.participationMode, checkInRequired: v.checkInRequired }
}
export const editableOccurrence = (v: Occurrence) => v.status === 'DRAFT' && v.firstPublishedAt === null
function sameConfiguration(a: Occurrence, b: OccurrenceWrite) {
  return a.eventTypeId === b.eventTypeId && instantNanos(a.startsAt) === instantNanos(b.startsAt) && instantNanos(a.endsAt) === instantNanos(b.endsAt)
    && a.capacity === b.capacity && a.modality === b.modality && a.participationMode === b.participationMode && a.checkInRequired === b.checkInRequired
}
export async function saveOccurrence(churchId: string, input: OccurrenceWrite, before: Occurrence | null, signal?: AbortSignal, client: ApiClient = api) {
  const path = base(churchId, before?.id)
  const body = validateOccurrenceWrite(input)
  if (before && (before.churchId !== churchId || !editableOccurrence(before) || !Number.isSafeInteger(before.revision) || before.revision < 0
    || (before.recurrenceRuleId !== null && before.eventTypeId !== body.eventTypeId))) throw new Error('Atualize o rascunho antes de editar. O tipo de uma série não pode ser trocado.')
  const result = parseOccurrence(await client.request<unknown>(path, { method: before ? 'PUT' : 'POST', signal,
    headers: { 'Content-Type': 'application/json', ...(before ? { 'X-Expected-Revision': String(before.revision) } : {}) }, body: JSON.stringify(body) }), churchId)
  if (!editableOccurrence(result) || !result.configured || !sameConfiguration(result, body)
    || (before && (result.id !== before.id || result.recurrenceRuleId !== before.recurrenceRuleId
      || (before.eventTypeId === body.eventTypeId && result.eventTypeVersionId !== before.eventTypeVersionId)
      || result.revision !== before.revision + (sameConfiguration(before, body) ? 0 : 1)))
    || (!before && result.recurrenceRuleId !== null)) throw new Error('Não foi possível confirmar a gravação. Consulte a lista antes de tentar novamente.')
  return result
}
