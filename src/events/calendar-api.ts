import { api, type ApiClient } from '../api'
import { isUuid } from './catalog-api'

// event-calendar-v1.openapi.json 1.0.0: metadados administrativos, sem ocorrências.
export interface AnnualCalendar {
  id: string; churchId: string; year: number; status: 'DRAFT' | 'PUBLISHED'
  revision: number; createdAt: string; publishedAt: string | null
}
export const isCalendarYear = (year: number) => Number.isSafeInteger(year) && year >= 1 && year <= 9999
function path(churchId: string, year: number) {
  if (!isUuid(churchId) || !isCalendarYear(year)) throw new Error('Contexto de calendário inválido.')
  return `/events/churches/${churchId}/calendars/${year}`
}
function instant(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value)
  return Boolean(match && Number.isFinite(Date.parse(value)) && new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) === match[1])
}
function parse(value: unknown, churchId: string, year: number): AnnualCalendar {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Não foi possível validar os dados do calendário.')
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || !isUuid(item.id) || item.churchId !== churchId || item.year !== year
    || (item.status !== 'DRAFT' && item.status !== 'PUBLISHED') || !Number.isSafeInteger(item.revision) || (item.revision as number) < 0
    || !instant(item.createdAt) || (item.status === 'DRAFT' ? item.publishedAt !== null : !instant(item.publishedAt))) throw new Error('Não foi possível validar os dados do calendário.')
  return { id: item.id, churchId, year, status: item.status, revision: item.revision as number, createdAt: item.createdAt, publishedAt: item.publishedAt as string | null }
}
export async function readCalendar(churchId: string, year: number, signal?: AbortSignal, client: ApiClient = api) {
  return parse(await client.request<unknown>(path(churchId, year), { signal }), churchId, year)
}
export async function createCalendar(churchId: string, year: number, signal?: AbortSignal, client: ApiClient = api) {
  const value = parse(await client.request<unknown>(path(churchId, year), { method: 'POST', signal }), churchId, year)
  if (value.status !== 'DRAFT') throw new Error('Não foi possível confirmar a criação do calendário.')
  return value
}
export async function setCalendarPublished(calendar: AnnualCalendar, published: boolean, signal?: AbortSignal, client: ApiClient = api) {
  const current = parse(calendar, calendar.churchId, calendar.year)
  const value = parse(await client.request<unknown>(`${path(current.churchId, current.year)}/${published ? 'publish' : 'unpublish'}`, {
    method: 'POST', headers: { 'X-Expected-Revision': String(current.revision) }, signal,
  }), current.churchId, current.year)
  if (value.id !== current.id || value.status !== (published ? 'PUBLISHED' : 'DRAFT')) throw new Error('Não foi possível confirmar a publicação do calendário.')
  return value
}
