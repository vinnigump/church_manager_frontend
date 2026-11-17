import { api, type ApiClient } from '../api'
import { isInstant, isUuid } from '../validation'
import { instantNanos } from './occurrence-api'
export interface UpcomingEvent { id: string; churchId: string; churchName: string; timeZone: string; name: string; location: string | null; startsAt: string; endsAt: string; status: 'PUBLISHED' | 'AVAILABLE' | 'IN_PROGRESS' }
export interface UpcomingPreview { referenceAt: string; items: UpcomingEvent[]; hasMore: boolean }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && Boolean(v.trim())
const invalid = () => new Error('Não foi possível validar seus próximos eventos.')
export async function ownUpcomingEvents(signal: AbortSignal, client: ApiClient = api): Promise<UpcomingPreview> {
  const v = await client.request<unknown>('/accounts/me/upcoming-events', { signal })
  if (!object(v) || !isInstant(v.referenceAt) || !Array.isArray(v.items) || v.items.length > 5 || typeof v.hasMore !== 'boolean' || v.hasMore && v.items.length !== 5) throw invalid()
  const seen = new Set<string>(), reference = instantNanos(v.referenceAt)
  const items = v.items.map(item => {
    if (!object(item) || typeof item.id !== 'string' || !isUuid(item.id) || seen.has(item.id) || typeof item.churchId !== 'string' || !isUuid(item.churchId) || !text(item.churchName) || !text(item.timeZone) || !text(item.name)
      || item.location !== null && !text(item.location) || !isInstant(item.startsAt) || !isInstant(item.endsAt) || instantNanos(item.endsAt) <= instantNanos(item.startsAt) || instantNanos(item.endsAt) <= reference || !['PUBLISHED', 'AVAILABLE', 'IN_PROGRESS'].includes(item.status as string)) throw invalid()
    try { new Intl.DateTimeFormat('pt-BR', { timeZone: item.timeZone }).format(new Date(item.startsAt)) } catch { throw invalid() }
    seen.add(item.id)
    return { id: item.id, churchId: item.churchId, churchName: item.churchName, timeZone: item.timeZone, name: item.name, location: item.location, startsAt: item.startsAt, endsAt: item.endsAt, status: item.status as UpcomingEvent['status'] }
  })
  for (let i = 1; i < items.length; i++) { const previous = items[i - 1], current = items[i], delta = instantNanos(previous.startsAt) - instantNanos(current.startsAt); if (delta > 0n || delta === 0n && previous.id.toLowerCase() > current.id.toLowerCase()) throw invalid() }
  return { referenceAt: v.referenceAt, items, hasMore: v.hasMore }
}
