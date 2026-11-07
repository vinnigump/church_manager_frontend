import { api, type ApiClient } from '../api'
import { isUuid } from '../validation'
import { instant, type SecurityPage } from './security-api'

export interface Assignment {
  id: string; userId: string; profileId: string; organizationUnitId: string
  delegationId: string | null; status: string; revision: number; startsAt: string; endsAt: string | null
}
const invalid = () => new Error('Não foi possível validar as atribuições administrativas.')
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
function parse(value: unknown): Assignment {
  if (typeof value !== 'object' || !value || Array.isArray(value)) throw invalid()
  const v = value as Record<string, unknown>
  if (![v.id, v.userId, v.profileId, v.organizationUnitId].every(id => typeof id === 'string' && isUuid(id))
    || (v.delegationId !== null && !(typeof v.delegationId === 'string' && isUuid(v.delegationId)))
    || typeof v.status !== 'string' || !v.status.trim() || !integer(v.revision)
    || !instant(v.startsAt) || (v.endsAt !== null && !instant(v.endsAt))) throw invalid()
  return { id: v.id as string, userId: v.userId as string, profileId: v.profileId as string,
    organizationUnitId: v.organizationUnitId as string, delegationId: v.delegationId as string | null,
    status: v.status, revision: v.revision, startsAt: v.startsAt, endsAt: v.endsAt as string | null }
}
function path(denominationId: string, assignmentId?: string) {
  if (!isUuid(denominationId) || (assignmentId !== undefined && !isUuid(assignmentId))) throw invalid()
  return `/security/denominations/${denominationId}/assignments${assignmentId ? `/${assignmentId}` : ''}`
}
export async function listAssignments(denominationId: string, page = 0, signal?: AbortSignal, client: ApiClient = api): Promise<SecurityPage<Assignment>> {
  if (!integer(page) || page > 100000) throw invalid()
  const raw = await client.request<unknown>(`${path(denominationId)}?page=${page}&size=20`, { signal })
  if (typeof raw !== 'object' || !raw || Array.isArray(raw)) throw invalid()
  const v = raw as Record<string, unknown>
  if (!Array.isArray(v.items) || v.page !== page || v.size !== 20 || !integer(v.total) || v.items.length > 20 || v.total < v.items.length) throw invalid()
  const items = v.items.map(parse)
  if (new Set(items.map(item => item.id)).size !== items.length) throw invalid()
  return { items, page, size: 20, total: v.total }
}
export async function readAssignment(denominationId: string, assignmentId: string, signal?: AbortSignal, client: ApiClient = api) {
  const result = parse(await client.request<unknown>(path(denominationId, assignmentId), { signal }))
  if (result.id !== assignmentId) throw invalid()
  return result
}
