import { api } from '../api'
import { isInstant, isUuid } from '../validation'

// work-items-v1, backend #174 integrated in 080d432630b1dee90105be931c73954c99f7f991.
export const destinations = ['USER_ACCOUNT', 'GROUP', 'MINISTRY', 'DEPARTMENT'] as const
export const states = ['OPEN', 'ASSIGNED', 'COMPLETED'] as const
export type Destination = typeof destinations[number]
export type TaskState = typeof states[number]
export interface WorkItem {
  id: string; churchId: string; title: string; instructions: string; destinationKind: Destination; destinationId: string
  executorAccountId: string | null; state: TaskState; revision: number; createdAt: string; createdBy: string
  assignedAt: string | null; assignedBy: string | null; completedAt: string | null; completedBy: string | null
  completionMode: 'RESPONSIBLE' | 'ADMINISTRATIVE' | null; canClaim: boolean; canComplete: boolean
  taskInstanceId?: string | null; participantName?: string | null
}
export interface CreateTask { requestId: string; title: string; instructions: string; destinationKind: Destination; destinationId: string }
export interface Option { id: string; label: string }
export interface Page<T> { items: T[]; page: number; size: number; total: number }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const natural = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const text = (v: unknown, max: number): v is string => typeof v === 'string' && Boolean(v.trim()) && v.length <= max
const nullableUuid = (v: unknown) => v === null || uuid(v)
const nullableDate = (v: unknown) => v === null || isInstant(v)
const invalid = () => new Error('Não foi possível validar a tarefa. Confira os dados novamente.')
function task(v: unknown, church?: string): WorkItem {
  if (!object(v) || !uuid(v.id) || !uuid(v.churchId) || church !== undefined && v.churchId !== church || !text(v.title, 180) || !text(v.instructions, 10000)
    || !destinations.includes(v.destinationKind as Destination) || !uuid(v.destinationId) || !nullableUuid(v.executorAccountId)
    || !states.includes(v.state as TaskState) || !natural(v.revision) || !isInstant(v.createdAt) || !uuid(v.createdBy)
    || !nullableDate(v.assignedAt) || !nullableUuid(v.assignedBy) || !nullableDate(v.completedAt) || !nullableUuid(v.completedBy)
    || ![null, 'RESPONSIBLE', 'ADMINISTRATIVE'].includes(v.completionMode as string | null)
    || typeof v.canClaim !== 'boolean' || typeof v.canComplete !== 'boolean'
    || v.taskInstanceId !== undefined && (!nullableUuid(v.taskInstanceId) || v.participantName !== null && !text(v.participantName, 200))
    || (v.taskInstanceId === undefined) !== (v.participantName === undefined)
    || v.taskInstanceId !== undefined && (v.taskInstanceId === null) !== (v.participantName === null)) throw invalid()
  if ((v.executorAccountId === null) !== (v.assignedAt === null) || (v.executorAccountId === null) !== (v.assignedBy === null)
    || v.destinationKind === 'USER_ACCOUNT' && v.executorAccountId !== v.destinationId
    || v.state === 'OPEN' && v.executorAccountId !== null || v.state === 'ASSIGNED' && v.executorAccountId === null
    || v.state === 'COMPLETED' && (v.completedAt === null || v.completedBy === null || v.completionMode === null)
    || v.state !== 'COMPLETED' && (v.completedAt !== null || v.completedBy !== null || v.completionMode !== null)
    || v.completionMode === 'RESPONSIBLE' && v.completedBy !== v.executorAccountId
    || v.canClaim && (v.state !== 'OPEN' || v.destinationKind === 'USER_ACCOUNT') || v.canComplete && v.state !== 'ASSIGNED') throw invalid()
  return { id: v.id, churchId: v.churchId, title: v.title, instructions: v.instructions, destinationKind: v.destinationKind as Destination,
    destinationId: v.destinationId, executorAccountId: v.executorAccountId as string | null, state: v.state as TaskState, revision: v.revision,
    createdAt: v.createdAt, createdBy: v.createdBy, assignedAt: v.assignedAt as string | null, assignedBy: v.assignedBy as string | null,
    completedAt: v.completedAt as string | null, completedBy: v.completedBy as string | null, completionMode: v.completionMode as WorkItem['completionMode'],
    canClaim: v.canClaim, canComplete: v.canComplete, ...(v.taskInstanceId !== undefined ? { taskInstanceId: v.taskInstanceId as string | null, participantName: v.participantName as string | null } : {}) }
}
function page<T extends { id: string }>(v: unknown, p: number, parse: (v: unknown) => T): Page<T> {
  if (!object(v) || !Array.isArray(v.items) || v.items.length > 20 || v.page !== p || v.size !== 20 || !natural(v.total) || v.total < v.items.length) throw invalid()
  const items = v.items.map(parse); if (new Set(items.map(v => v.id)).size !== items.length) throw invalid()
  return { items, page: p, size: 20, total: v.total }
}
function base(church: string) { if (!uuid(church)) throw invalid(); return `/tasks/churches/${church}` }
function itemId(id: string) { if (!uuid(id)) throw invalid(); return id }
function params(p: number, state?: TaskState) {
  if (!natural(p) || p > 100000 || state !== undefined && !states.includes(state)) throw invalid()
  return new URLSearchParams({ page: String(p), size: '20', ...(state ? { state } : {}) })
}
function own(v: WorkItem, actor: string) { if (v.executorAccountId !== actor && !v.canClaim) throw invalid(); return v }
export async function listMine(actor: string, p: number, state?: TaskState, signal?: AbortSignal) {
  return page(await api.request<unknown>(`/accounts/me/tasks?${params(p, state)}`, { signal, cache: 'no-store' }), p, v => own(task(v), actor))
}
export async function readTask(id: string, signal?: AbortSignal, church?: string, actor?: string) {
  const path = church ? `${base(church)}/items/${itemId(id)}` : `/accounts/me/tasks/${itemId(id)}`
  const result = task(await api.request<unknown>(path, { signal, cache: 'no-store' }), church)
  if (result.id !== id) throw invalid(); return actor ? own(result, actor) : result
}
export async function listTasks(church: string, p: number, state?: TaskState, signal?: AbortSignal) {
  return page(await api.request<unknown>(`${base(church)}/items?${params(p, state)}`, { signal, cache: 'no-store' }), p, v => task(v, church))
}
export async function options(church: string, kind: Destination, query: string, p: number, signal?: AbortSignal, taskId?: string) {
  const q = params(p); if (query.length > 120 || !destinations.includes(kind)) throw invalid(); q.set('query', query)
  const path = taskId ? `${base(church)}/items/${itemId(taskId)}/candidates` : `${base(church)}/destinations`
  if (!taskId) q.set('kind', kind)
  return page(await api.request<unknown>(`${path}?${q}`, { signal, cache: 'no-store' }), p, value => {
    if (!object(value) || !uuid(value.id) || !text(value.label, 300)) throw invalid(); return { id: value.id, label: value.label }
  })
}
export async function createTask(church: string, input: CreateTask, signal: AbortSignal) {
  if (!uuid(input.requestId) || !text(input.title, 180) || !text(input.instructions, 10000) || !destinations.includes(input.destinationKind) || !uuid(input.destinationId)) throw new Error('Preencha título, instruções e destinatário.')
  const body = { requestId: input.requestId, title: input.title.trim(), instructions: input.instructions.trim(), destinationKind: input.destinationKind, destinationId: input.destinationId }
  const result = task(await api.request<unknown>(`${base(church)}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }), church)
  if (result.title !== body.title || result.instructions !== body.instructions || result.destinationKind !== body.destinationKind || result.destinationId !== body.destinationId) throw invalid()
  return result
}
export async function command(before: WorkItem, action: 'claim' | 'complete' | 'assign', signal: AbortSignal, church?: string, assignee?: string, actor?: string) {
  if (!natural(before.revision) || church !== undefined && church !== before.churchId || action === 'assign' && !uuid(assignee)) throw invalid()
  if (church && action === 'claim' || !church && (action === 'assign' || !uuid(actor))) throw invalid()
  const path = church ? `${base(church)}/items/${itemId(before.id)}` : `/accounts/me/tasks/${itemId(before.id)}`
  const result = task(await api.request<unknown>(`${path}/${action}`, { method: 'POST', signal,
    headers: { 'X-Expected-Revision': String(before.revision), ...(action === 'assign' ? { 'Content-Type': 'application/json' } : {}) },
    ...(action === 'assign' ? { body: JSON.stringify({ executorAccountId: assignee }) } : {}) }), before.churchId)
  if (result.id !== before.id || result.title !== before.title || result.instructions !== before.instructions || result.destinationId !== before.destinationId
    || result.destinationKind !== before.destinationKind || ![before.revision, before.revision + 1].includes(result.revision)
    || (action === 'complete' ? result.state !== 'COMPLETED' : result.state !== 'ASSIGNED')
    || action === 'assign' && result.executorAccountId !== assignee || action === 'claim' && result.executorAccountId !== actor) throw invalid()
  return result
}
