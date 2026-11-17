import { api, type ApiClient } from '../api'
import { isInstant, isUuid } from '../validation'
import { instantNanos } from './occurrence-api'
import { parseRecord, type EventRecord } from './record-api'

export type AgendaView = 'WEEK' | 'MONTH'
export interface Agenda {
  referenceAt: string; timeZone: string; today: string; anchorDate: string; view: AgendaView
  startsOn: string; endsOnExclusive: string; from: string; to: string; items: EventRecord[]; total: number
}
interface Page extends Agenda { page: number; size: number }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const invalid = () => new Error('A agenda mudou ou os dados estão incompletos. Atualize para consultar o período completo.')
export function civilDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1 && Number(v.slice(0, 4)) <= 9999
    && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
}
export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
const formatters = new Map<string, Intl.DateTimeFormat>()
export function zoneDate(instant: string | number, zone: string) {
  let formatter = formatters.get(zone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
    if (formatters.size >= 32) formatters.clear()
    formatters.set(zone, formatter)
  }
  const parts = formatter.formatToParts(new Date(instant))
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`
}
function parsePage(raw: unknown, church: string, view: AgendaView, date: string | undefined, page: number, size = 100): Page {
  if (!object(raw) || !isInstant(raw.referenceAt) || typeof raw.timeZone !== 'string' || !civilDate(raw.today) || !civilDate(raw.anchorDate)
    || !civilDate(raw.startsOn) || !civilDate(raw.endsOnExclusive) || raw.view !== view || (date !== undefined && raw.anchorDate !== date)
    || (date === undefined && raw.anchorDate !== raw.today)
    || !isInstant(raw.from) || !isInstant(raw.to) || instantNanos(raw.to) <= instantNanos(raw.from)
    || raw.page !== page || raw.size !== size || !Number.isSafeInteger(raw.total) || (raw.total as number) < 0
    || !Array.isArray(raw.items) || raw.items.length > size) throw invalid()
  try {
    if (zoneDate(raw.referenceAt, raw.timeZone) !== raw.today || zoneDate(raw.from, raw.timeZone) !== raw.startsOn
      || zoneDate(raw.to, raw.timeZone) !== raw.endsOnExclusive) throw invalid()
  } catch { throw invalid() }
  const anchor = raw.anchorDate, start = raw.startsOn, end = raw.endsOnExclusive
  if (anchor < start || anchor >= end || (view === 'WEEK' && (new Date(`${start}T00:00:00Z`).getUTCDay() !== 1 || end !== addDays(start, 7)))
    || (view === 'MONTH' && (start.slice(8) !== '01' || end !== new Date(Date.parse(`${start}T00:00:00Z`) + 32 * 86400000).toISOString().slice(0, 7) + '-01'))) throw invalid()
  const items = raw.items.map(v => parseRecord(v, church))
  const total = raw.total as number
  if (items.length !== Math.min(size, Math.max(0, total - page * size)) || items.some(v => instantNanos(v.endsAt) <= instantNanos(raw.from as string)
    || instantNanos(v.startsAt) >= instantNanos(raw.to as string))) throw invalid()
  return { referenceAt: raw.referenceAt, timeZone: raw.timeZone, today: raw.today, anchorDate: anchor, view, startsOn: start, endsOnExclusive: end,
    from: raw.from, to: raw.to, items, total, page, size }
}
export async function readAgendaReference(church: string, signal?: AbortSignal, client: ApiClient = api) {
  if (!isUuid(church)) throw invalid()
  const page = parsePage(await client.request<unknown>(`/events/churches/${church}/records/agenda?view=WEEK&page=0&size=1`, { signal }), church, 'WEEK', undefined, 0, 1)
  return { timeZone: page.timeZone, referenceAt: page.referenceAt, today: page.today }
}
export async function readAgenda(church: string, view: AgendaView, date?: string, signal?: AbortSignal, client: ApiClient = api): Promise<Agenda> {
  if (!isUuid(church) || !['WEEK', 'MONTH'].includes(view) || (date !== undefined && (!civilDate(date) || Number(date.slice(0, 4)) > 9998))) throw invalid()
  const fetchPage = async (page: number, anchor?: string) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const params = new URLSearchParams({ view, page: String(page), size: '100', ...(anchor && { date: anchor }) })
    return parsePage(await client.request<unknown>(`/events/churches/${church}/records/agenda?${params}`, { signal }), church, view, anchor, page)
  }
  const first = await fetchPage(0, date), items = [...first.items]
  // Technical display bound; never show a truncated calendar as complete.
  if (first.total > 10000) throw new Error('Há muitos eventos neste período. Use a lista ou escolha um período menor.')
  for (let page = 1; items.length < first.total; page++) {
    const next = await fetchPage(page, first.anchorDate)
    if (next.total !== first.total || next.from !== first.from || next.to !== first.to || next.timeZone !== first.timeZone
      || next.startsOn !== first.startsOn || next.endsOnExclusive !== first.endsOnExclusive) throw invalid()
    items.push(...next.items)
  }
  if (new Set(items.map(v => v.id)).size !== items.length) throw invalid()
  return { referenceAt: first.referenceAt, timeZone: first.timeZone, today: first.today, anchorDate: first.anchorDate, view,
    startsOn: first.startsOn, endsOnExclusive: first.endsOnExclusive, from: first.from, to: first.to, items, total: first.total }
}
export function eventDateRange(event: EventRecord, zone: string) {
  const lastNano = instantNanos(event.endsAt) - 1n
  const lastMillis = Number(lastNano / 1000000n) - (lastNano < 0n && lastNano % 1000000n !== 0n ? 1 : 0)
  return { first: zoneDate(event.startsAt, zone), last: zoneDate(lastMillis, zone) }
}
export function eventTouchesDate(event: EventRecord, date: string, zone: string) {
  const range = eventDateRange(event, zone)
  return range.first <= date && range.last >= date
}
