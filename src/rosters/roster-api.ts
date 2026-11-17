import { api, type ApiClient } from '../api'
import { isInstant, isUuid } from '../validation'
import { instantNanos } from '../events/occurrence-api'

export interface Participant { assignmentId: string; accountId: string; displayName: string; present: boolean; recordedAt: string | null; recordedBy: string | null }
export interface Roster { id: string; churchId: string; ministryId: string; ministryName: string; departmentId: string | null; departmentName: string | null;
  eventId: string | null; eventName: string | null; startsAt: string; endsAt: string; timeZone: string; revision: number; participants: Participant[] }
export interface RosterWrite { ministryId: string; departmentId: string | null; eventId: string | null; startsAt: string; endsAt: string; accountIds: string[] }
export interface Presence { rosterId: string; assignmentId: string; accountId: string; recordedAt: string; recordedBy: string; revision: number }
export interface OwnRoster { rosterId: string; churchId: string; churchName: string; ministryName: string; departmentName: string | null; eventLinked: boolean;
  eventId: string | null; eventName: string | null; startsAt: string; endsAt: string; timeZone: string; present: boolean; recordedAt: string | null }
export interface Page<T> { items: T[]; page: number; size: number; total: number }
export interface AccountOption { accountId: string; displayName: string }
export interface Unit { id: string; kind: 'MINISTRY' | 'DEPARTMENT'; ministryId: string; name: string; ministryName: string }
export interface Units extends Page<Unit> { timeZone: string }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const text = (v: unknown): v is string => typeof v === 'string' && Boolean(v.trim())
const nullableUuid = (v: unknown) => v === null || uuid(v)
const nullableText = (v: unknown) => v === null || text(v)
const natural = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const invalid = () => new Error('Não foi possível validar os dados da escala. Atualize a consulta.')
function timezone(v: unknown): v is string { if (!text(v)) return false; try { new Intl.DateTimeFormat('pt-BR', { timeZone: v }).format(); return true } catch { return false } }
const dates = (v: Record<string, unknown>) => isInstant(v.startsAt) && isInstant(v.endsAt) && instantNanos(v.endsAt) > instantNanos(v.startsAt)
function base(church: string, id?: string) { if (!isUuid(church) || id !== undefined && !isUuid(id)) throw invalid(); return `/service-rosters/churches/${church}${id ? `/${id}` : ''}` }
function participant(v: unknown): Participant {
  if (!object(v) || !uuid(v.assignmentId) || !uuid(v.accountId) || !text(v.displayName) || typeof v.present !== 'boolean'
    || (v.recordedAt !== null && !isInstant(v.recordedAt)) || !nullableUuid(v.recordedBy)
    || (v.present ? v.recordedAt === null || v.recordedBy === null : v.recordedAt !== null || v.recordedBy !== null)) throw invalid()
  return { assignmentId: v.assignmentId, accountId: v.accountId, displayName: v.displayName, present: v.present, recordedAt: v.recordedAt as string | null, recordedBy: v.recordedBy as string | null }
}
export function parseRoster(v: unknown, church: string): Roster {
  if (!object(v) || !uuid(v.id) || v.churchId !== church || !uuid(v.ministryId) || !text(v.ministryName)
    || !nullableUuid(v.departmentId) || !nullableText(v.departmentName) || !nullableUuid(v.eventId) || !nullableText(v.eventName)
    || !dates(v) || !timezone(v.timeZone) || !natural(v.revision) || !Array.isArray(v.participants) || v.participants.length > 200) throw invalid()
  const participants = v.participants.map(participant)
  if (new Set(participants.map(p => p.accountId)).size !== participants.length || new Set(participants.map(p => p.assignmentId)).size !== participants.length) throw invalid()
  return { id: v.id, churchId: church, ministryId: v.ministryId, ministryName: v.ministryName, departmentId: v.departmentId as string | null, departmentName: v.departmentName as string | null,
    eventId: v.eventId as string | null, eventName: v.eventName as string | null, startsAt: v.startsAt as string, endsAt: v.endsAt as string, timeZone: v.timeZone, revision: v.revision, participants }
}
function parseOwn(v: unknown): OwnRoster {
  if (!object(v) || !uuid(v.rosterId) || !uuid(v.churchId) || !text(v.churchName) || !text(v.ministryName) || !nullableText(v.departmentName)
    || typeof v.eventLinked !== 'boolean' || !nullableUuid(v.eventId) || !nullableText(v.eventName) || (v.eventId === null) !== (v.eventName === null)
    || (!v.eventLinked && (v.eventId !== null || v.eventName !== null)) || !dates(v) || !timezone(v.timeZone)
    || typeof v.present !== 'boolean' || (v.recordedAt !== null && !isInstant(v.recordedAt)) || v.present !== (v.recordedAt !== null)) throw invalid()
  return { rosterId: v.rosterId, churchId: v.churchId, churchName: v.churchName, ministryName: v.ministryName, departmentName: v.departmentName as string | null,
    eventLinked: v.eventLinked, eventId: v.eventId as string | null, eventName: v.eventName as string | null, startsAt: v.startsAt as string, endsAt: v.endsAt as string,
    timeZone: v.timeZone, present: v.present, recordedAt: v.recordedAt as string | null }
}
function page<T>(v: unknown, requested: number, parse: (v: unknown) => T): Page<T> {
  if (!object(v) || !Array.isArray(v.items) || v.page !== requested || v.size !== 20 || !natural(v.total) || v.items.length > 20 || v.total < v.items.length) throw invalid()
  return { items: v.items.map(parse), page: requested, size: 20, total: v.total }
}
function paging(value: number) { if (!natural(value) || value > 100000) throw invalid(); return `page=${value}&size=20` }
export async function listRosters(church: string, index: number, signal?: AbortSignal, client: ApiClient = api) {
  return page(await client.request<unknown>(`${base(church)}?${paging(index)}`, { signal }), index, v => parseRoster(v, church))
}
export async function readRoster(church: string, id: string, signal?: AbortSignal, client: ApiClient = api) {
  const result = parseRoster(await client.request<unknown>(base(church, id), { signal }), church); if (result.id !== id) throw invalid(); return result
}
export async function ownRosters(index: number, signal?: AbortSignal, client: ApiClient = api, upcoming = false) {
  const raw = await client.request<unknown>(`/service-rosters/me?${paging(index)}&upcoming=${upcoming}`, { signal })
  if (!object(raw) || !isInstant(raw.referenceAt) || raw.upcoming !== upcoming) throw invalid()
  const result = page(raw, index, parseOwn)
  if (upcoming && result.items.some(v => instantNanos(v.endsAt) <= instantNanos(raw.referenceAt as string))) throw invalid()
  return { ...result, referenceAt: raw.referenceAt, upcoming }
}
export async function selectAccounts(church: string, query: string, index: number, signal?: AbortSignal, client: ApiClient = api) {
  if (query.length > 120) throw invalid()
  return page(await client.request<unknown>(`${base(church)}/accounts?${paging(index)}&q=${encodeURIComponent(query)}`, { signal }), index, v => {
    if (!object(v) || !uuid(v.accountId) || !text(v.displayName)) throw invalid(); return { accountId: v.accountId, displayName: v.displayName }
  })
}
export async function selectUnits(church: string, query: string, index: number, signal?: AbortSignal, client: ApiClient = api): Promise<Units> {
  if (query.length > 120) throw invalid()
  const raw = await client.request<unknown>(`${base(church)}/ministry-units?${paging(index)}&q=${encodeURIComponent(query)}`, { signal })
  if (!object(raw) || !timezone(raw.timeZone)) throw invalid()
  return { ...page(raw, index, v => {
    if (!object(v) || !uuid(v.id) || !uuid(v.ministryId) || !['MINISTRY', 'DEPARTMENT'].includes(v.kind as string) || !text(v.name) || !text(v.ministryName)) throw invalid()
    return { id: v.id, ministryId: v.ministryId, kind: v.kind as Unit['kind'], name: v.name, ministryName: v.ministryName }
  }), timeZone: raw.timeZone }
}
export function validateRoster(v: RosterWrite): RosterWrite {
  if (!uuid(v.ministryId) || !nullableUuid(v.departmentId) || !nullableUuid(v.eventId) || !isInstant(v.startsAt) || !isInstant(v.endsAt)
    || instantNanos(v.endsAt) <= instantNanos(v.startsAt) || instantNanos(v.startsAt) % 1000n !== 0n || instantNanos(v.endsAt) % 1000n !== 0n
    || !Array.isArray(v.accountIds) || !v.accountIds.length || v.accountIds.length > 200 || v.accountIds.some(v => !uuid(v)) || new Set(v.accountIds).size !== v.accountIds.length) throw new Error('Selecione a unidade, ao menos uma pessoa e um período válido.')
  return { ministryId: v.ministryId, departmentId: v.departmentId, eventId: v.eventId, startsAt: v.startsAt, endsAt: v.endsAt, accountIds: [...v.accountIds].sort() }
}
const same = (v: Roster, body: RosterWrite) => v.ministryId === body.ministryId && v.departmentId === body.departmentId && v.eventId === body.eventId
  && instantNanos(v.startsAt) === instantNanos(body.startsAt) && instantNanos(v.endsAt) === instantNanos(body.endsAt)
  && JSON.stringify(v.participants.map(p => p.accountId).sort()) === JSON.stringify([...body.accountIds].sort())
export async function saveRoster(church: string, input: RosterWrite, before: Roster | null, signal?: AbortSignal, client: ApiClient = api) {
  const body = validateRoster(input)
  if (before && (before.churchId !== church || before.participants.some(p => p.present))) throw new Error('A escala tem presença registrada. Este cadastro não permite correção.')
  const result = parseRoster(await client.request<unknown>(base(church, before?.id), { method: before ? 'PUT' : 'POST', signal,
    headers: { 'Content-Type': 'application/json', ...(before ? { 'X-Expected-Revision': String(before.revision) } : {}) }, body: JSON.stringify(body) }), church)
  if (!same(result, body) || result.revision !== (before ? before.revision + (same(before, body) ? 0 : 1) : 0)
    || before && result.id !== before.id || result.participants.some(p => p.present)) throw new Error('Não foi possível confirmar a gravação. Confira a lista antes de tentar novamente.')
  return result
}
export async function markRosterPresence(church: string, before: Roster, accountId: string, signal?: AbortSignal, client: ApiClient = api): Promise<Presence> {
  const target = before.participants.find(p => p.accountId === accountId)
  if (before.churchId !== church || !target || !uuid(accountId)) throw invalid()
  const raw = await client.request<unknown>(`${base(church, before.id)}/participants/${accountId}/manual-presence`, { method: 'POST', headers: { 'X-Expected-Revision': String(before.revision) }, signal })
  if (!object(raw) || raw.rosterId !== before.id || raw.accountId !== accountId || raw.assignmentId !== target.assignmentId || !isInstant(raw.recordedAt) || !uuid(raw.recordedBy)
    || !natural(raw.revision) || (target.present ? raw.revision < before.revision || raw.recordedAt !== target.recordedAt || raw.recordedBy !== target.recordedBy : raw.revision !== before.revision + 1)) throw invalid()
  return { rosterId: before.id, accountId, assignmentId: target.assignmentId, recordedAt: raw.recordedAt, recordedBy: raw.recordedBy, revision: raw.revision }
}
