import { api, type ApiClient } from '../api'
import { isInstant, isUuid } from '../validation'
import { instantNanos } from '../events/occurrence-api'
export interface Badge { id: string; label: string; qrCode: string; state: 'AVAILABLE' | 'DISTRIBUTED' | 'LOST' }
export interface Person { id: string; displayName: string }
export interface Unit { ministryId: string; departmentId: string | null; ministryName: string; departmentName: string | null }
export interface Delivery { id: string; churchId: string; badgeId: string; badgeLabel: string; personId: string; personName: string; ministryId: string; ministryName: string; departmentId: string | null; departmentName: string | null; issuedAt: string; closedAt: string | null; outcome: 'RETURNED' | 'LOST' | null }
export interface Issue { requestId: string; qrCode: string; personId: string; ministryId: string; departmentId: string | null }
export interface Page<T> { items: T[]; page: number; size: number; total: number }
export interface Scan { badge: Badge; openDelivery: Delivery | null }
export interface Summary { day: string; timeZone: string; referenceAt: string; distributed: number; returned: number; lost: number; pending: number; pendingTotal: number; pendingFromEarlierDays: number }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const nullableUuid = (v: unknown): v is string | null => v === null || uuid(v)
const text = (v: unknown): v is string => typeof v === 'string' && Boolean(v.trim())
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const invalid = () => new Error('Não foi possível validar os dados da recepção. Consulte novamente.')
function base(church: string) { if (!isUuid(church)) throw invalid(); return `/reception/churches/${church}` }
function badge(v: unknown): Badge {
  if (!object(v) || !uuid(v.id) || !text(v.label) || v.qrCode !== v.id || !['AVAILABLE', 'DISTRIBUTED', 'LOST'].includes(v.state as string)) throw invalid()
  return { id: v.id, label: v.label, qrCode: v.id, state: v.state as Badge['state'] }
}
function delivery(v: unknown, church: string): Delivery {
  if (!object(v) || !uuid(v.id) || v.churchId !== church || !uuid(v.badgeId) || !text(v.badgeLabel) || !uuid(v.personId) || !text(v.personName) || !uuid(v.ministryId) || !text(v.ministryName) || !nullableUuid(v.departmentId)
    || (v.departmentId === null ? v.departmentName !== null : !text(v.departmentName)) || !isInstant(v.issuedAt)
    || (v.outcome === null ? v.closedAt !== null : !['RETURNED', 'LOST'].includes(v.outcome as string) || !isInstant(v.closedAt) || instantNanos(v.closedAt) < instantNanos(v.issuedAt))) throw invalid()
  return { id: v.id, churchId: church, badgeId: v.badgeId, badgeLabel: v.badgeLabel, personId: v.personId, personName: v.personName, ministryId: v.ministryId, ministryName: v.ministryName, departmentId: v.departmentId, departmentName: v.departmentName as string | null, issuedAt: v.issuedAt, closedAt: v.closedAt as string | null, outcome: v.outcome as Delivery['outcome'] }
}
async function pageOf<T>(path: string, page: number, parse: (v: unknown) => T, key: (v: T) => string, signal: AbortSignal, client: ApiClient): Promise<Page<T>> {
  if (!integer(page) || page > 100000) throw invalid()
  const v = await client.request<unknown>(path, { signal })
  if (!object(v) || !Array.isArray(v.items) || v.page !== page || v.size !== 20 || !integer(v.total) || v.items.length !== Math.min(20, Math.max(0, v.total - page * 20))) throw invalid()
  const items = v.items.map(parse); if (new Set(items.map(key)).size !== items.length) throw invalid()
  return { items, page, size: 20, total: v.total }
}
function search(q: string, page: number) { if (q.length > 120) throw invalid(); return new URLSearchParams({ q, page: String(page), size: '20' }) }
export function receptionPeople(church: string, q: string, page: number, signal: AbortSignal, client: ApiClient = api) {
  return pageOf(`${base(church)}/people?${search(q, page)}`, page, v => { if (!object(v) || !uuid(v.id) || !text(v.displayName)) throw invalid(); return { id: v.id, displayName: v.displayName } as Person }, v => v.id, signal, client)
}
export function receptionUnits(church: string, page: number, signal: AbortSignal, client: ApiClient = api) {
  return pageOf(`${base(church)}/units?page=${page}&size=20`, page, v => { if (!object(v) || !uuid(v.ministryId) || !nullableUuid(v.departmentId) || !text(v.ministryName) || (v.departmentId === null ? v.departmentName !== null : !text(v.departmentName))) throw invalid(); return { ministryId: v.ministryId, departmentId: v.departmentId, ministryName: v.ministryName, departmentName: v.departmentName as string | null } }, v => `${v.ministryId}:${v.departmentId}`, signal, client)
}
export function receptionBadges(church: string, q: string, page: number, signal: AbortSignal, client: ApiClient = api) { return pageOf(`${base(church)}/badges?${search(q, page)}`, page, badge, v => v.id, signal, client) }
export async function createBadge(church: string, label: string, signal: AbortSignal, client: ApiClient = api): Promise<Badge> {
  if (!label.trim() || label.trim().length > 80) throw invalid()
  const result = badge(await client.request<unknown>(`${base(church)}/badges`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: label.trim() }), signal }))
  if (result.label !== label.trim() || result.state !== 'AVAILABLE') throw invalid(); return result
}
export async function scanBadge(church: string, code: string, signal: AbortSignal, client: ApiClient = api): Promise<Scan> {
  if (!isUuid(code)) throw new Error('Leia o QR Code do crachá ou cole seu código completo.')
  const v = await client.request<unknown>(`${base(church)}/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qrCode: code }), signal })
  if (!object(v)) throw invalid(); const b = badge(v.badge), open = v.openDelivery === null ? null : delivery(v.openDelivery, church)
  if (b.id !== code || (b.state === 'DISTRIBUTED') !== (open !== null) || open && (open.badgeId !== b.id || open.outcome !== null)) throw invalid()
  return { badge: b, openDelivery: open }
}
export async function issueBadge(church: string, input: Issue, signal: AbortSignal, client: ApiClient = api): Promise<Delivery> {
  if (!isUuid(input.requestId) || !isUuid(input.qrCode) || !isUuid(input.personId) || !isUuid(input.ministryId) || !nullableUuid(input.departmentId)) throw invalid()
  const v = delivery(await client.request<unknown>(`${base(church)}/deliveries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal }), church)
  if (v.badgeId !== input.qrCode || v.personId !== input.personId || v.ministryId !== input.ministryId || v.departmentId !== input.departmentId) throw invalid(); return v
}
export async function closeDelivery(church: string, before: Delivery, confirmation: 'RETURNED' | 'LOST', signal: AbortSignal, client: ApiClient = api): Promise<Delivery> {
  if (!isUuid(before.id) || before.churchId !== church || !['RETURNED', 'LOST'].includes(confirmation)) throw invalid()
  const v = delivery(await client.request<unknown>(`${base(church)}/deliveries/${before.id}/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation }), signal }), church)
  if (v.id !== before.id || v.badgeId !== before.badgeId || v.personId !== before.personId || v.ministryId !== before.ministryId || v.departmentId !== before.departmentId || v.issuedAt !== before.issuedAt || v.outcome !== confirmation) throw invalid(); return v
}
export function receptionDeliveries(church: string, page: number, signal: AbortSignal, client: ApiClient = api) { return pageOf(`${base(church)}/deliveries?state=OPEN&page=${page}&size=20`, page, v => { const item = delivery(v, church); if (item.outcome !== null) throw invalid(); return item }, v => v.id, signal, client) }
export async function receptionSummary(church: string, signal: AbortSignal, client: ApiClient = api): Promise<Summary> {
  const v = await client.request<unknown>(`${base(church)}/summary`, { signal })
  if (!object(v) || typeof v.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.day) || !text(v.timeZone) || !isInstant(v.referenceAt) || !integer(v.distributed) || !integer(v.returned) || !integer(v.lost) || !integer(v.pending) || !integer(v.pendingTotal) || !integer(v.pendingFromEarlierDays)
    || v.distributed !== v.returned + v.lost + v.pending || v.pendingTotal < v.pending || v.pendingTotal < v.pendingFromEarlierDays) throw invalid()
  try { new Intl.DateTimeFormat('pt-BR', { timeZone: v.timeZone }).format(new Date(v.referenceAt)) } catch { throw invalid() }
  return { day: v.day, timeZone: v.timeZone, referenceAt: v.referenceAt, distributed: v.distributed, returned: v.returned, lost: v.lost, pending: v.pending, pendingTotal: v.pendingTotal, pendingFromEarlierDays: v.pendingFromEarlierDays }
}
