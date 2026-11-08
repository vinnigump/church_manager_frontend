import { api, type ApiClient } from '../api'
import { isInstant, isUuid } from '../validation'
import { instantNanos } from '../events/occurrence-api'

export type GroupKind = 'MINISTRY' | 'DEPARTMENT'
export type GroupStatus = 'ACTIVE' | 'INACTIVE'
export interface GroupContext { churchId: string; kind: GroupKind; groupId: string }
export interface GroupMembership extends GroupContext { id: string; personId: string; status: GroupStatus; revision: number; linkedAt: string; linkedBy: string; releasedAt: string | null; releasedBy: string | null }
export interface GroupHistory { id: string; action: 'LINKED' | 'RELEASED'; beforeStatus: string | null; afterStatus: GroupStatus; revision: number; actorId: string; occurredAt: string; reason: string | null }
export interface GroupPage<T> { items: T[]; page: number; size: number; total: number }
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
export const isGroupKind = (v: unknown): v is GroupKind => v === 'MINISTRY' || v === 'DEPARTMENT'
const status = (v: unknown): v is GroupStatus => v === 'ACTIVE' || v === 'INACTIVE'
const invalid = () => new Error('Não foi possível validar os vínculos do grupo.')
function base(context: GroupContext) {
  if (!isUuid(context.churchId) || !isUuid(context.groupId) || !isGroupKind(context.kind)) throw invalid()
  return `/membership/churches/${context.churchId}`
}
export function groupRoute(c: GroupContext) { return `/igrejas/${c.churchId}/grupos/${c.kind}/${c.groupId}/vinculos` }
export function parseGroupMembership(v: unknown, context: GroupContext): GroupMembership {
  if (!record(v) || !uuid(v.id) || v.churchId !== context.churchId || v.kind !== context.kind || v.groupId !== context.groupId || !uuid(v.personId)
    || !status(v.status) || !integer(v.revision) || !isInstant(v.linkedAt) || !uuid(v.linkedBy)
    || (v.releasedAt !== null && !isInstant(v.releasedAt)) || (v.releasedBy !== null && !uuid(v.releasedBy))
    || (v.status === 'ACTIVE' ? v.releasedAt !== null || v.releasedBy !== null : v.releasedAt === null || v.releasedBy === null)) throw invalid()
  if (v.releasedAt !== null && instantNanos(v.releasedAt as string) < instantNanos(v.linkedAt)) throw invalid()
  return { ...context, id: v.id, personId: v.personId, status: v.status, revision: v.revision, linkedAt: v.linkedAt, linkedBy: v.linkedBy, releasedAt: v.releasedAt as string | null, releasedBy: v.releasedBy as string | null }
}
function parsePage<T extends { id: string }>(v: unknown, page: number, parse: (v: unknown) => T): GroupPage<T> {
  if (!record(v) || !Array.isArray(v.items) || v.page !== page || v.size !== 20 || !integer(v.total)
    || v.items.length !== Math.min(20, Math.max(0, v.total - page * 20))) throw invalid()
  const items = v.items.map(parse)
  if (new Set(items.map(item => item.id)).size !== items.length) throw invalid()
  return { items, page, size: 20, total: v.total }
}
function paging(page: number) { if (!integer(page) || page > 100000) throw invalid() }
export async function listGroupMembers(context: GroupContext, filter?: GroupStatus, page = 0, signal?: AbortSignal, client: ApiClient = api) {
  const path = base(context); paging(page); if (filter !== undefined && !status(filter)) throw invalid()
  const params = new URLSearchParams({ page: String(page), size: '20', ...(filter && { status: filter }) })
  const value = parsePage(await client.request<unknown>(`${path}/groups/${context.kind}/${context.groupId}/members?${params}`, { signal }), page, v => parseGroupMembership(v, context))
  if (filter && value.items.some(item => item.status !== filter)) throw invalid()
  return value
}
export async function readGroupMembership(context: GroupContext, id: string, signal?: AbortSignal, client: ApiClient = api) {
  const path = base(context); if (!isUuid(id)) throw invalid()
  const value = parseGroupMembership(await client.request<unknown>(`${path}/group-memberships/${id}`, { signal }), context)
  if (value.id !== id) throw invalid()
  return value
}
export async function readGroupHistory(context: GroupContext, before: GroupMembership, page = 0, signal?: AbortSignal, client: ApiClient = api) {
  const path = base(context); paging(page); parseGroupMembership(before, context)
  return parsePage(await client.request<unknown>(`${path}/group-memberships/${before.id}/history?page=${page}&size=20`, { signal }), page, (v): GroupHistory => {
    if (!record(v) || !uuid(v.id) || !uuid(v.actorId) || !integer(v.revision) || !isInstant(v.occurredAt)
      || (v.reason !== null && (typeof v.reason !== 'string' || v.reason.length > 500))
      || (v.action === 'LINKED' ? v.beforeStatus !== null || v.afterStatus !== 'ACTIVE' : v.action !== 'RELEASED' || v.beforeStatus !== 'ACTIVE' || v.afterStatus !== 'INACTIVE')) throw invalid()
    return { id: v.id, action: v.action as GroupHistory['action'], beforeStatus: v.beforeStatus as string | null, afterStatus: v.afterStatus as GroupStatus, revision: v.revision, actorId: v.actorId, occurredAt: v.occurredAt, reason: v.reason as string | null }
  })
}
export async function releaseGroupMember(context: GroupContext, before: GroupMembership, reason: string, signal?: AbortSignal, client: ApiClient = api) {
  const path = base(context); parseGroupMembership(before, context)
  if (reason.length > 500) throw new Error('O motivo deve ter até 500 caracteres.')
  const raw = await client.request<unknown>(`${path}/group-memberships/${before.id}/release`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Expected-Revision': String(before.revision) }, body: JSON.stringify({ reason: reason.trim() || null }), signal })
  if (!record(raw) || typeof raw.changed !== 'boolean') throw invalid()
  const value = parseGroupMembership(raw.membership, context)
  const changed = before.status === 'ACTIVE'
  if (raw.changed !== changed || value.id !== before.id || value.personId !== before.personId || value.linkedAt !== before.linkedAt || value.linkedBy !== before.linkedBy
    || value.status !== 'INACTIVE' || value.revision !== before.revision + (changed ? 1 : 0)) throw invalid()
  return { membership: value, changed }
}
