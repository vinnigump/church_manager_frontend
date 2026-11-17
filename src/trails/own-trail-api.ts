import { api, type ApiClient } from '../api'
import { isInstant, isUuid } from '../validation'

// own-trails-v1 1.0.0, backend #171 integrated in 2bb6a31747ed27589ae5d375890d1951971426a7.
export const trailStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const
export const taskStatuses = ['PENDING', 'BLOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED'] as const
export const taskTypes = ['EVENT_PARTICIPATION', 'QUESTIONNAIRE', 'MANUAL', 'AUTOMATIC'] as const
export interface OwnTrail {
  id: string; churchId: string; churchName: string; templateId: string; name: string; versionId: string; versionNumber: number
  status: typeof trailStatuses[number]; startedAt: string; completedAt: string | null; taskCount: number; completedTaskCount: number
}
export interface OwnTrailTask { id: string; position: number; name: string; type: typeof taskTypes[number]; required: boolean; status: typeof taskStatuses[number]; completedAt: string | null }
export interface OwnTrailPage<T> { items: T[]; page: number; size: number; total: number }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const natural = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const name = (v: unknown): v is string => typeof v === 'string' && Boolean(v.trim())
const completed = (v: unknown) => v === null || isInstant(v)
const invalid = () => new Error('Não foi possível validar seu percurso. Atualize a consulta.')
const base = '/accounts/me/trails'
export function parseOwnTrail(v: unknown): OwnTrail {
  if (!object(v) || !uuid(v.id) || !uuid(v.churchId) || !uuid(v.templateId) || !uuid(v.versionId) || !name(v.name) || !name(v.churchName)
    || !natural(v.versionNumber) || v.versionNumber < 1 || !trailStatuses.includes(v.status as OwnTrail['status'])
    || !isInstant(v.startedAt) || !completed(v.completedAt) || !natural(v.taskCount) || !natural(v.completedTaskCount) || v.completedTaskCount > v.taskCount) throw invalid()
  return { id: v.id, churchId: v.churchId, churchName: v.churchName, templateId: v.templateId, name: v.name, versionId: v.versionId,
    versionNumber: v.versionNumber, status: v.status as OwnTrail['status'], startedAt: v.startedAt, completedAt: v.completedAt as string | null,
    taskCount: v.taskCount, completedTaskCount: v.completedTaskCount }
}
export function parseOwnTrailTask(v: unknown): OwnTrailTask {
  if (!object(v) || !uuid(v.id) || !natural(v.position) || v.position < 1 || !name(v.name) || !taskTypes.includes(v.type as OwnTrailTask['type'])
    || typeof v.required !== 'boolean' || !taskStatuses.includes(v.status as OwnTrailTask['status']) || !completed(v.completedAt)) throw invalid()
  return { id: v.id, position: v.position, name: v.name, type: v.type as OwnTrailTask['type'], required: v.required,
    status: v.status as OwnTrailTask['status'], completedAt: v.completedAt as string | null }
}
function page<T extends { id: string }>(v: unknown, requested: number, parse: (v: unknown) => T): OwnTrailPage<T> {
  if (!object(v) || !Array.isArray(v.items) || v.items.length > 20 || v.page !== requested || v.size !== 20 || !natural(v.total) || v.total < v.items.length) throw invalid()
  const items = v.items.map(parse)
  if (new Set(items.map(item => item.id)).size !== items.length) throw invalid()
  return { items, page: requested, size: 20, total: v.total }
}
function paging(value: number) { if (!natural(value) || value > 100000) throw invalid() }
function path(id: string) { if (!isUuid(id)) throw invalid(); return `${base}/${id}` }
export async function listOwnTrails(requested = 0, signal?: AbortSignal, client: ApiClient = api) {
  paging(requested)
  return page(await client.request<unknown>(`${base}?page=${requested}&size=20`, { signal, cache: 'no-store' }), requested, parseOwnTrail)
}
export async function readOwnTrail(id: string, signal?: AbortSignal, client: ApiClient = api) {
  const v = parseOwnTrail(await client.request<unknown>(path(id), { signal, cache: 'no-store' }))
  if (v.id !== id) throw invalid()
  return v
}
export async function listOwnTrailTasks(id: string, requested = 0, signal?: AbortSignal, client: ApiClient = api) {
  const target = path(id); paging(requested)
  const result = page(await client.request<unknown>(`${target}/tasks?page=${requested}&size=20`, { signal, cache: 'no-store' }), requested, parseOwnTrailTask)
  if (result.items.some((v, index) => index > 0 && v.position <= result.items[index - 1].position)) throw invalid()
  return result
}
