import { api, type ApiClient } from '../api'
import { isInstant, isUuid } from '../validation'
import { instantNanos } from './occurrence-api'

// Backend #179 integrated in release/homolog (c4ac011).
export interface RegistrationOption { id: string; churchId: string; eventTypeId: string; name: string; startsAt: string; endsAt: string; location: string | null; checkInRequired: boolean }
export interface OptionPage { items: RegistrationOption[]; page: number; size: number; total: number }
export interface OwnRegistration { id: string; occurrenceId: string; status: 'CONFIRMED'; trailInstanceId: string | null; taskInstanceId: string | null }
export interface ParticipantPresence { id: string; registrationId: string; checkedInAt: string; validated: boolean }
export interface Participant { registrationId: string; personId: string; displayName: string; status: 'PENDING' | 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED'; presence: ParticipantPresence | null }
export interface ParticipantPage { occurrenceId: string; name: string; startsAt: string; endsAt: string; status: string; content: Participant[]; page: number; size: number; total: number }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const nullableUuid = (v: unknown): v is string | null => v === null || uuid(v)
const text = (v: unknown): v is string => typeof v === 'string' && Boolean(v.trim())
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const invalid = () => new Error('Não foi possível validar os dados de participação. Consulte novamente.')
function base(church: string) { if (!isUuid(church)) throw invalid(); return `/events/churches/${church}/occurrences` }
function occurrenceBase(church: string, occurrence: string) { if (!isUuid(occurrence)) throw invalid(); return `${base(church)}/${occurrence}` }
function paging(v: Record<string, unknown>, page: number, count: number) { if (!integer(page) || page > 100000 || v.page !== page || v.size !== 20 || !integer(v.total) || count > 20 || count !== Math.min(20, Math.max(0, v.total - page * 20))) throw invalid() }
function presence(v: unknown, registration: string): ParticipantPresence {
  if (!object(v) || !uuid(v.id) || v.registrationId !== registration || !isInstant(v.checkedInAt) || typeof v.validated !== 'boolean') throw invalid()
  return { id: v.id, registrationId: registration, checkedInAt: v.checkedInAt, validated: v.validated }
}
export async function registrationOptions(church: string, type: string, page: number, signal?: AbortSignal, client: ApiClient = api): Promise<OptionPage> {
  if (!isUuid(type) || !integer(page) || page > 100000) throw invalid()
  const v = await client.request<unknown>(`${base(church)}/registration-options?eventTypeId=${type}&page=${page}&size=20`, { signal })
  if (!object(v) || !Array.isArray(v.items)) throw invalid()
  paging(v, page, v.items.length)
  const seen = new Set<string>()
  const items = v.items.map(item => {
    if (!object(item) || !uuid(item.id) || seen.has(item.id) || item.churchId !== church || item.eventTypeId !== type || !text(item.name)
      || !isInstant(item.startsAt) || !isInstant(item.endsAt) || instantNanos(item.endsAt) <= instantNanos(item.startsAt)
      || !['PUBLISHED', 'AVAILABLE'].includes(item.status as string) || item.participationMode !== 'REGISTRATION_REQUIRED'
      || typeof item.checkInRequired !== 'boolean' || (item.location !== undefined && item.location !== null && !text(item.location))) throw invalid()
    seen.add(item.id)
    return { id: item.id, churchId: church, eventTypeId: type, name: item.name, startsAt: item.startsAt, endsAt: item.endsAt, checkInRequired: item.checkInRequired, location: (item.location ?? null) as string | null }
  })
  return { items, page, size: 20, total: v.total as number }
}
export async function confirmRegistration(church: string, occurrence: string, task: string | null, signal?: AbortSignal, client: ApiClient = api): Promise<OwnRegistration> {
  if (!nullableUuid(task)) throw invalid()
  const v = await client.request<unknown>(`${occurrenceBase(church, occurrence)}/registration`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task ? { taskInstanceId: task } : {}), signal })
  if (!object(v) || !uuid(v.id) || v.occurrenceId !== occurrence || v.status !== 'CONFIRMED' || !nullableUuid(v.trailInstanceId) || !nullableUuid(v.taskInstanceId) || (task !== null && v.taskInstanceId !== task)) throw invalid()
  return { id: v.id, occurrenceId: occurrence, status: v.status, trailInstanceId: v.trailInstanceId, taskInstanceId: v.taskInstanceId }
}
export async function participants(church: string, occurrence: string, q: string, page: number, signal?: AbortSignal, client: ApiClient = api): Promise<ParticipantPage> {
  if (!integer(page) || page > 100000 || q.length > 120) throw invalid()
  const v = await client.request<unknown>(`${occurrenceBase(church, occurrence)}/check-in?${new URLSearchParams({ q, page: String(page), size: '20' })}`, { signal })
  if (!object(v) || v.occurrenceId !== occurrence || !text(v.name) || !isInstant(v.startsAt) || !isInstant(v.endsAt) || instantNanos(v.endsAt) <= instantNanos(v.startsAt) || !text(v.status) || !Array.isArray(v.content)) throw invalid()
  paging(v, page, v.content.length)
  const seen = new Set<string>()
  const content = v.content.map(item => {
    if (!object(item) || !uuid(item.registrationId) || seen.has(item.registrationId) || !uuid(item.personId) || !text(item.displayName) || !['PENDING', 'CONFIRMED', 'WAITLISTED', 'CANCELLED'].includes(item.status as string)) throw invalid()
    seen.add(item.registrationId)
    return { registrationId: item.registrationId, personId: item.personId, displayName: item.displayName, status: item.status as Participant['status'], presence: item.presence === null ? null : presence(item.presence, item.registrationId) }
  })
  return { occurrenceId: occurrence, name: v.name, startsAt: v.startsAt, endsAt: v.endsAt, status: v.status, content, page, size: 20, total: v.total as number }
}
export async function confirmParticipantPresence(church: string, occurrence: string, registration: string, reason: 'ADMINISTRATIVE_DECISION', signal?: AbortSignal, client: ApiClient = api): Promise<ParticipantPresence> {
  if (!isUuid(registration) || reason !== 'ADMINISTRATIVE_DECISION') throw invalid()
  const v = await client.request<unknown>(`${occurrenceBase(church, occurrence)}/registrations/${registration}/check-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }), signal })
  return presence(v, registration)
}
