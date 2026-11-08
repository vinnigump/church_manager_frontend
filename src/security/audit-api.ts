import { api, type ApiClient } from '../api'
import { isUuid } from '../validation'
import { instant, type SecurityPage } from './security-api'

// audit-query-v1 1.5.0: denials and series changes each require explicit opt-in.
export const auditResources = ['ACCESS_ROLE', 'USER_ROLE_ASSIGNMENT', 'ACCESS_ROLE_DELEGATION', 'EVENT_TYPE', 'EVENT_OCCURRENCE', 'EVENT_ATTENDANCE', 'EVENT_CALENDAR', 'AUDIT_LOG', 'EVENT_RECURRENCE_RULE'] as const
export type AuditResource = typeof auditResources[number]
export interface AuditFilters { resourceType?: AuditResource; resourceId?: string; from?: string; to?: string }
export interface AuditEntry { id: string; occurredAt: string; actorUserId: string; action: string; resourceType: AuditResource; resourceId: string | null; outcome: 'SUCCESS' | 'DENIED' }
export const isAuditResource = (value: unknown): value is AuditResource => typeof value === 'string' && auditResources.includes(value as AuditResource)
const invalid = () => new Error('Não foi possível validar a consulta de auditoria.')
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
// Instant do Java preserva nanos; Date.parse sozinho perde a parte submilissegundo.
const nanos = (value: string) => BigInt(Date.parse(value.replace(/\.\d+/, ''))) * 1000000n
  + BigInt((/\.(\d+)/.exec(value)?.[1] ?? '').padEnd(9, '0').slice(0, 9))
function parse(raw: unknown): AuditEntry {
  if (typeof raw !== 'object' || !raw || Array.isArray(raw)) throw invalid()
  const v = raw as Record<string, unknown>
  if (!uuid(v.id) || !instant(v.occurredAt) || !uuid(v.actorUserId) || typeof v.action !== 'string' || !v.action.trim()
    || !isAuditResource(v.resourceType) || (v.resourceId !== null && !uuid(v.resourceId)) || (v.outcome !== 'SUCCESS' && v.outcome !== 'DENIED')) throw invalid()
  return { id: v.id, occurredAt: v.occurredAt, actorUserId: v.actorUserId, action: v.action,
    resourceType: v.resourceType, resourceId: v.resourceId as string | null, outcome: v.outcome }
}
export async function listAudit(denominationId: string, filters: AuditFilters = {}, page = 0, signal?: AbortSignal, client: ApiClient = api): Promise<SecurityPage<AuditEntry>> {
  if (!isUuid(denominationId) || !integer(page) || page > 100000
    || (filters.resourceType !== undefined && !isAuditResource(filters.resourceType))
    || (filters.resourceId !== undefined && !isUuid(filters.resourceId))
    || (filters.from !== undefined && !instant(filters.from)) || (filters.to !== undefined && !instant(filters.to))
    || (filters.from !== undefined && filters.to !== undefined && nanos(filters.from) >= nanos(filters.to))) throw invalid()
  const params = new URLSearchParams({ page: String(page), size: '20' })
  for (const name of ['resourceType', 'resourceId', 'from', 'to'] as const) if (filters[name] !== undefined) params.set(name, filters[name])
  const raw = await client.request<unknown>(`/security/denominations/${denominationId}/audit?${params}`, { signal })
  if (typeof raw !== 'object' || !raw || Array.isArray(raw)) throw invalid()
  const v = raw as Record<string, unknown>
  if (!Array.isArray(v.items) || v.page !== page || v.size !== 20 || !integer(v.total) || v.items.length > 20 || v.total < v.items.length) throw invalid()
  const items = v.items.map(parse)
  if (new Set(items.map(item => item.id)).size !== items.length || items.some(item =>
    (item.resourceType === 'AUDIT_LOG' && (filters.resourceType !== 'AUDIT_LOG' || item.outcome !== 'DENIED'
      || !['AUDIT_QUERY_DENIED', 'PROFILE_MANAGEMENT_DENIED', 'ASSIGNMENT_MANAGEMENT_DENIED', 'PROFILE_READ_DENIED', 'ASSIGNMENT_READ_DENIED', 'DELEGATED_ASSIGNMENT_DENIED'].includes(item.action)))
    || (item.resourceType === 'EVENT_RECURRENCE_RULE' && (filters.resourceType !== 'EVENT_RECURRENCE_RULE' || item.outcome !== 'SUCCESS'
      || item.action !== 'EVENT_SERIES_UPDATED' || item.resourceId === null))
    ||
    (filters.resourceType !== undefined && item.resourceType !== filters.resourceType)
    || (filters.resourceId !== undefined && item.resourceId !== filters.resourceId)
    || (filters.from !== undefined && nanos(item.occurredAt) < nanos(filters.from))
    || (filters.to !== undefined && nanos(item.occurredAt) >= nanos(filters.to)))) throw invalid()
  return { items, page, size: 20, total: v.total }
}
