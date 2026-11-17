import { api, type ApiClient } from '../api'
import { isInstant, isUuid } from '../validation'
import { sameAudience, validateAudiencePolicy, type AudiencePolicy } from './audience-api'
import { instantNanos, validateOccurrenceWrite, type OccurrenceWrite } from './occurrence-api'

// event-records-v1 1.0.0; backend PR #168 integrated in release/homolog.
export const recordStatuses = ['DRAFT', 'AVAILABLE', 'OPEN', 'CLOSED', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
export interface EventRecord extends Omit<OccurrenceWrite, 'modality' | 'participationMode' | 'checkInRequired'> {
  id: string; churchId: string; eventTypeVersionId: string | null; recurrenceRuleId: string | null
  name: string; location: string | null; draft: boolean; status: typeof recordStatuses[number]; revision: number
  modality: OccurrenceWrite['modality'] | null; participationMode: OccurrenceWrite['participationMode'] | null
  checkInRequired: boolean | null; audience: AudiencePolicy | null
}
export interface RecordWrite extends OccurrenceWrite { name: string; location: string; draft: boolean; audience: AudiencePolicy }
export interface RecordPage { items: EventRecord[]; page: number; size: number; total: number }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const nullableUuid = (v: unknown) => v === null || uuid(v)
const invalid = () => new Error('Não foi possível validar os dados do evento. Atualize a consulta.')
export const editableRecord = (v: EventRecord) => v.status === 'DRAFT' || v.status === 'AVAILABLE'
export function parseRecord(v: unknown, churchId: string): EventRecord {
  if (!object(v) || !uuid(v.id) || v.churchId !== churchId || !uuid(v.eventTypeId)
    || !nullableUuid(v.eventTypeVersionId) || !nullableUuid(v.recurrenceRuleId)
    || typeof v.name !== 'string' || !v.name.trim() || v.name.length > 180
    || (v.location !== null && (typeof v.location !== 'string' || !v.location.trim() || v.location.length > 500))
    || !isInstant(v.startsAt) || !isInstant(v.endsAt) || instantNanos(v.endsAt) <= instantNanos(v.startsAt)
    || (v.capacity !== null && (!Number.isInteger(v.capacity) || (v.capacity as number) < -2147483648 || (v.capacity as number) > 2147483647))
    || !recordStatuses.includes(v.status as EventRecord['status']) || typeof v.draft !== 'boolean' || v.draft !== (v.status === 'DRAFT')
    || !Number.isSafeInteger(v.revision) || (v.revision as number) < 0
    || (v.modality !== null && !['IN_PERSON', 'ONLINE', 'HYBRID'].includes(v.modality as string))
    || (v.participationMode !== null && !['REGISTRATION_REQUIRED', 'OPEN_EVENT'].includes(v.participationMode as string))
    || (v.checkInRequired !== null && typeof v.checkInRequired !== 'boolean')) throw invalid()
  // Explicit projection: never propagate private links, participants or extra fields.
  return { id: v.id, churchId, eventTypeId: v.eventTypeId, eventTypeVersionId: v.eventTypeVersionId as string | null,
    recurrenceRuleId: v.recurrenceRuleId as string | null, name: v.name, location: v.location as string | null,
    startsAt: v.startsAt, endsAt: v.endsAt, capacity: v.capacity as number | null,
    modality: v.modality as EventRecord['modality'], participationMode: v.participationMode as EventRecord['participationMode'],
    checkInRequired: v.checkInRequired as boolean | null, draft: v.draft, status: v.status as EventRecord['status'], revision: v.revision as number,
    audience: v.audience === null ? null : validateAudiencePolicy(v.audience) }
}
function base(church: string, id?: string) {
  if (!isUuid(church) || (id !== undefined && !isUuid(id))) throw invalid()
  return `/events/churches/${church}/records${id ? `/${id}` : ''}`
}
export function validateRecordWrite(v: RecordWrite): RecordWrite {
  const core = validateOccurrenceWrite(v)
  if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 180 || typeof v.location !== 'string'
    || !v.location.trim() || v.location.length > 500 || typeof v.draft !== 'boolean') throw new Error('Informe o nome, o local e a situação do evento.')
  return { ...core, name: v.name.trim(), location: v.location.trim(), draft: v.draft, audience: validateAudiencePolicy(v.audience) }
}
export async function listRecords(church: string, page = 0, signal?: AbortSignal, client: ApiClient = api): Promise<RecordPage> {
  const path = base(church)
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000) throw invalid()
  const v = await client.request<unknown>(`${path}?page=${page}&size=20`, { signal })
  if (!object(v) || !Array.isArray(v.items) || v.page !== page || v.size !== 20 || !Number.isSafeInteger(v.total)
    || (v.total as number) < v.items.length || v.items.length > 20) throw invalid()
  const items = v.items.map(item => parseRecord(item, church))
  if (new Set(items.map(item => item.id)).size !== items.length) throw invalid()
  return { items, page, size: 20, total: v.total as number }
}
export async function readRecord(church: string, id: string, signal?: AbortSignal, client: ApiClient = api) {
  const v = parseRecord(await client.request<unknown>(base(church, id), { signal }), church)
  if (v.id !== id) throw invalid()
  return v
}
const sameCore = (a: EventRecord, b: RecordWrite) => a.eventTypeId === b.eventTypeId && a.name === b.name && a.location === b.location
  && instantNanos(a.startsAt) === instantNanos(b.startsAt) && instantNanos(a.endsAt) === instantNanos(b.endsAt)
  && a.capacity === b.capacity && a.modality === b.modality && a.participationMode === b.participationMode && a.checkInRequired === b.checkInRequired
  && sameAudience(a.audience, b.audience)
export async function saveRecord(church: string, input: RecordWrite, before: EventRecord | null, signal?: AbortSignal, client: ApiClient = api) {
  const path = base(church, before?.id), body = validateRecordWrite(input)
  if (before && (before.churchId !== church || !editableRecord(before) || !Number.isSafeInteger(before.revision) || before.revision < 0
    || (before.recurrenceRuleId && (before.eventTypeId !== body.eventTypeId || instantNanos(before.startsAt) !== instantNanos(body.startsAt)
      || instantNanos(before.endsAt) !== instantNanos(body.endsAt))))) throw new Error('Esta alteração exige o fluxo específico da série ou do estado do evento.')
  const result = parseRecord(await client.request<unknown>(path, { method: before ? 'PUT' : 'POST', signal,
    headers: { 'Content-Type': 'application/json', ...(before ? { 'X-Expected-Revision': String(before.revision) } : {}) }, body: JSON.stringify(body) }), church)
  const validState = body.draft ? result.status === 'DRAFT' : ['AVAILABLE', 'IN_PROGRESS', 'COMPLETED'].includes(result.status)
  // Lifecycle can advance immediately, incrementing revision after the save.
  const advance = !body.draft && result.status !== 'AVAILABLE' ? 1 : 0
  const expectedRevision = before ? before.revision + (sameCore(before, body) && before.draft === body.draft ? 0 : 1) + advance : 1 + advance
  if (!validState || !sameCore(result, body)
    || result.revision !== expectedRevision
    || (before && (result.id !== before.id || result.recurrenceRuleId !== before.recurrenceRuleId
      || (body.eventTypeId === before.eventTypeId && result.eventTypeVersionId !== before.eventTypeVersionId)))
    || (!before && result.recurrenceRuleId !== null)) throw new Error('Não foi possível confirmar a gravação. Consulte os eventos antes de tentar novamente.')
  return result
}
