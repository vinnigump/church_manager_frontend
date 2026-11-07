import { api, type ApiClient } from '../api'
import { isUuid } from '../validation'
import { instant, type SecurityPage } from './security-api'

export interface Delegation { id: string; profileId: string; organizationUnitId: string; delegateeUserId: string; status: string; revision: number; startsAt: string; endsAt: string | null }
const invalid = () => new Error('Não foi possível validar as fontes de delegação.')
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
function parse(raw: unknown): Delegation {
  if (typeof raw !== 'object' || !raw || Array.isArray(raw)) throw invalid()
  const v = raw as Record<string, unknown>
  if (![v.id, v.profileId, v.organizationUnitId, v.delegateeUserId].every(id => typeof id === 'string' && isUuid(id))
    || typeof v.status !== 'string' || !v.status.trim() || !integer(v.revision)
    || !instant(v.startsAt) || (v.endsAt !== null && !instant(v.endsAt))) throw invalid()
  return { id: v.id as string, profileId: v.profileId as string, organizationUnitId: v.organizationUnitId as string,
    delegateeUserId: v.delegateeUserId as string, status: v.status, revision: v.revision, startsAt: v.startsAt, endsAt: v.endsAt as string | null }
}
function path(denominationId: string, delegationId?: string) {
  if (!isUuid(denominationId) || (delegationId !== undefined && !isUuid(delegationId))) throw invalid()
  return `/security/denominations/${denominationId}/delegations${delegationId ? `/${delegationId}` : ''}`
}
export async function listDelegations(denominationId: string, page = 0, signal?: AbortSignal, client: ApiClient = api): Promise<SecurityPage<Delegation>> {
  if (!integer(page) || page > 100000) throw invalid()
  const raw = await client.request<unknown>(`${path(denominationId)}?page=${page}&size=20`, { signal })
  if (typeof raw !== 'object' || !raw || Array.isArray(raw)) throw invalid()
  const v = raw as Record<string, unknown>
  if (!Array.isArray(v.items) || v.page !== page || v.size !== 20 || !integer(v.total) || v.items.length > 20 || v.total < v.items.length) throw invalid()
  const items = v.items.map(parse)
  if (new Set(items.map(item => item.id)).size !== items.length) throw invalid()
  return { items, page, size: 20, total: v.total }
}
export async function readDelegation(denominationId: string, delegationId: string, signal?: AbortSignal, client: ApiClient = api) {
  const value = parse(await client.request<unknown>(path(denominationId, delegationId), { signal }))
  if (value.id !== delegationId) throw invalid()
  return value
}
export async function revokeDelegation(denominationId: string, current: Delegation, signal?: AbortSignal, client: ApiClient = api) {
  const value = parse(current)
  if (value.status !== 'ACTIVE' || value.revision === Number.MAX_SAFE_INTEGER) throw invalid()
  const raw = await client.request<unknown>(`${path(denominationId, value.id)}/revoke`, {
    method: 'POST', headers: { 'X-Expected-Revision': String(value.revision) }, signal,
  })
  if (typeof raw !== 'object' || !raw || Array.isArray(raw)) throw invalid()
  const result = raw as Record<string, unknown>
  if (result.id !== value.id || result.status !== 'REVOKED' || !integer(result.revision) || result.revision !== value.revision + 1) throw invalid()
  return { id: value.id, status: 'REVOKED' as const, revision: result.revision }
}
