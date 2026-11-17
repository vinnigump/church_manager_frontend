import { api, type ApiClient } from '../api'
import { isInstant, isUuid } from '../validation'
import { instantNanos } from './occurrence-api'
import type { RegistrationOption } from './participation-api'

export interface EventChurch { churchId: string; name: string; active: boolean }
export interface PublicEvent extends Omit<RegistrationOption, 'checkInRequired'> { participationMode: 'REGISTRATION_REQUIRED' | 'OPEN_EVENT'; checkInRequired: boolean; status: string }
export interface PublicPage { items: PublicEvent[]; page: number; size: number; total: number }
export interface OwnEventRegistration { id: string; churchId: string; churchName: string; occurrenceId: string; eventName: string; startsAt: string; endsAt: string; status: string; registeredAt: string; taskInstanceId: string | null; presence: { id: string; checkedInAt: string; validated: boolean } | null }
export interface OwnRegistrationPage { items: OwnEventRegistration[]; page: number; size: number; total: number }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const text = (v: unknown): v is string => typeof v === 'string' && Boolean(v.trim())
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const invalid = () => new Error('Não foi possível validar seus eventos. Consulte novamente.')
function pageCheck(v: Record<string, unknown>, page: number, count: number) { if (!integer(page) || page > 100000 || v.page !== page || v.size !== 20 || !integer(v.total) || count !== Math.min(20, Math.max(0, v.total - page * 20))) throw invalid() }
export async function eventChurches(signal?: AbortSignal, client: ApiClient = api): Promise<EventChurch[]> {
  const v = await client.request<unknown>('/accounts/me/event-churches', { signal })
  if (!Array.isArray(v)) throw invalid()
  const seen = new Set<string>()
  return v.map(item => { if (!object(item) || !uuid(item.churchId) || seen.has(item.churchId) || !text(item.name) || typeof item.active !== 'boolean') throw invalid(); seen.add(item.churchId); return { churchId: item.churchId, name: item.name, active: item.active } })
}
function publicEvent(v: unknown, church: string): PublicEvent {
  if (!object(v) || !uuid(v.id) || v.churchId !== church || !uuid(v.eventTypeId) || !text(v.name) || !isInstant(v.startsAt) || !isInstant(v.endsAt) || instantNanos(v.endsAt) <= instantNanos(v.startsAt)
    || !['REGISTRATION_REQUIRED', 'OPEN_EVENT'].includes(v.participationMode as string) || typeof v.checkInRequired !== 'boolean'
    || !['PUBLISHED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(v.status as string) || (v.location !== undefined && v.location !== null && !text(v.location))) throw invalid()
  return { id: v.id, churchId: church, eventTypeId: v.eventTypeId, name: v.name, startsAt: v.startsAt, endsAt: v.endsAt, location: (v.location ?? null) as string | null, participationMode: v.participationMode as PublicEvent['participationMode'], checkInRequired: v.checkInRequired, status: v.status as string }
}
export async function participantEvents(church: string, page: number, signal?: AbortSignal, client: ApiClient = api): Promise<PublicPage> {
  if (!isUuid(church) || !integer(page) || page > 100000) throw invalid()
  const v = await client.request<unknown>(`/public/churches/${church}/events?page=${page}&size=20`, { signal })
  if (!object(v) || !Array.isArray(v.items)) throw invalid(); pageCheck(v, page, v.items.length)
  const items = v.items.map(item => publicEvent(item, church)); if (new Set(items.map(item => item.id)).size !== items.length) throw invalid()
  return { items, page, size: 20, total: v.total as number }
}
export async function ownOccurrenceOption(church: string, occurrence: string, signal?: AbortSignal, client: ApiClient = api): Promise<PublicEvent | null> {
  if (!isUuid(church) || !isUuid(occurrence)) throw invalid()
  const v = await client.request<unknown>(`/events/churches/${church}/occurrences/${occurrence}/registration`, { signal })
  if (!object(v) || !Array.isArray(v.occurrences) || !['UNAVAILABLE', 'CONFIRM_OCCURRENCE'].includes(v.action as string) || v.occurrences.length !== (v.action === 'UNAVAILABLE' ? 0 : 1)) throw invalid()
  if (!v.occurrences.length) return null
  const item = publicEvent(v.occurrences[0], church); if (item.id !== occurrence || item.participationMode !== 'REGISTRATION_REQUIRED') throw invalid(); return item
}
export async function ownEventRegistrations(page: number, signal?: AbortSignal, client: ApiClient = api): Promise<OwnRegistrationPage> {
  if (!integer(page) || page > 100000) throw invalid()
  const v = await client.request<unknown>(`/accounts/me/event-registrations?page=${page}&size=20`, { signal })
  if (!object(v) || !Array.isArray(v.items)) throw invalid(); pageCheck(v, page, v.items.length)
  const seen = new Set<string>()
  const items = v.items.map(item => {
    if (!object(item) || !uuid(item.id) || seen.has(item.id) || !uuid(item.churchId) || !text(item.churchName) || !uuid(item.occurrenceId) || !text(item.eventName)
      || !isInstant(item.startsAt) || !isInstant(item.endsAt) || instantNanos(item.endsAt) <= instantNanos(item.startsAt) || !isInstant(item.registeredAt)
      || !['PENDING', 'CONFIRMED', 'WAITLISTED', 'CANCELLED'].includes(item.status as string) || (item.taskInstanceId !== null && !uuid(item.taskInstanceId))) throw invalid()
    let presence = null
    if (item.presence !== null) { const p = item.presence; if (!object(p) || !uuid(p.id) || !isInstant(p.checkedInAt) || typeof p.validated !== 'boolean') throw invalid(); presence = { id: p.id, checkedInAt: p.checkedInAt, validated: p.validated } }
    seen.add(item.id)
    return { id: item.id, churchId: item.churchId, churchName: item.churchName, occurrenceId: item.occurrenceId, eventName: item.eventName, startsAt: item.startsAt, endsAt: item.endsAt, status: item.status as string, registeredAt: item.registeredAt, taskInstanceId: item.taskInstanceId as string | null, presence }
  })
  return { items, page, size: 20, total: v.total as number }
}
