import { api } from '../api'
import { isInstant, isUuid } from '../validation'
export interface ChurchGroup { id: string; churchId: string; name: string; description: string | null; revision: number; createdAt: string }
export interface GroupUser { id: string; groupId: string; churchId: string; accountId: string; displayName: string; joinedAt: string }
export interface AccountOption { accountId: string; displayName: string }
export interface Page<T> { items: T[]; page: number; size: number; total: number }
export const groupManagementRoute = (church: string) => `/grupos/igrejas/${church}`
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const invalid = () => new Error('Não foi possível validar os dados do grupo. Atualize a consulta.')
function base(church: string, id?: string) {
  if (!isUuid(church) || (id !== undefined && !isUuid(id))) throw invalid()
  return `/membership/churches/${church}/church-groups${id ? `/${id}` : ''}`
}
function group(v: unknown, church: string): ChurchGroup {
  if (!object(v) || !uuid(v.id) || v.churchId !== church || !text(v.name) || v.name.length > 180
    || (v.description !== null && (typeof v.description !== 'string' || v.description.length > 2000))
    || !Number.isSafeInteger(v.revision) || (v.revision as number) < 0 || !isInstant(v.createdAt)) throw invalid()
  return { id: v.id, churchId: church, name: v.name, description: v.description as string | null, revision: v.revision as number, createdAt: v.createdAt }
}
function member(v: unknown, church: string, id: string): GroupUser {
  if (!object(v) || !uuid(v.id) || v.churchId !== church || v.groupId !== id || !uuid(v.accountId) || !text(v.displayName) || !isInstant(v.joinedAt)) throw invalid()
  return { id: v.id, groupId: id, churchId: church, accountId: v.accountId, displayName: v.displayName, joinedAt: v.joinedAt }
}
function query(search: string, page: number) {
  if (search.length > 120 || !Number.isSafeInteger(page) || page < 0 || page > 100000) throw invalid()
  const params = new URLSearchParams({ page: String(page), size: '20' }); if (search.trim()) params.set('q', search.trim()); return params
}
function pageOf<T>(v: unknown, page: number, parse: (raw: unknown) => T): Page<T> {
  if (!object(v) || v.page !== page || v.size !== 20 || !Array.isArray(v.items) || v.items.length > 20 || !Number.isSafeInteger(v.total) || (v.total as number) < v.items.length) throw invalid()
  return { items: v.items.map(parse), page, size: 20, total: v.total as number }
}
export async function listChurchGroups(church: string, search: string, page: number, signal?: AbortSignal) {
  return pageOf(await api.request<unknown>(`${base(church)}?${query(search, page)}`, { signal }), page, v => group(v, church))
}
export async function readChurchGroup(church: string, id: string, signal?: AbortSignal) {
  const v = group(await api.request<unknown>(base(church, id), { signal }), church); if (v.id !== id) throw invalid(); return v
}
export async function saveChurchGroup(church: string, name: string, description: string, before: ChurchGroup | null, signal?: AbortSignal) {
  if (!name.trim() || name.length > 180 || description.length > 2000 || before && before.churchId !== church) throw new Error('Informe um nome válido e uma descrição de até 2000 caracteres.')
  const body = { name: name.trim(), description: description.trim() || null }
  const v = group(await api.request<unknown>(base(church, before?.id), { method: before ? 'PUT' : 'POST', signal,
    headers: { 'Content-Type': 'application/json', ...(before ? { 'X-Expected-Revision': String(before.revision) } : {}) }, body: JSON.stringify(body) }), church)
  const revision = before ? before.revision + (before.name === body.name && before.description === body.description ? 0 : 1) : 0
  if (v.name !== body.name || v.description !== body.description || v.revision !== revision || before && v.id !== before.id) throw invalid()
  return v
}
export async function listChurchGroupUsers(church: string, id: string, page: number, signal?: AbortSignal) {
  return pageOf(await api.request<unknown>(`${base(church, id)}/users?${query('', page)}`, { signal }), page, v => member(v, church, id))
}
export async function searchGroupAccounts(church: string, search: string, page: number, signal?: AbortSignal) {
  return pageOf(await api.request<unknown>(`${base(church)}/eligible-accounts?${query(search, page)}`, { signal }), page, v => {
    if (!object(v) || !uuid(v.accountId) || !text(v.displayName)) throw invalid()
    return { accountId: v.accountId, displayName: v.displayName } as AccountOption
  })
}
export async function addChurchGroupUser(before: ChurchGroup, account: AccountOption, signal?: AbortSignal) {
  if (!isUuid(account.accountId)) throw invalid()
  const raw = await api.request<unknown>(`${base(before.churchId, before.id)}/users`, { method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'X-Expected-Revision': String(before.revision) }, body: JSON.stringify({ accountId: account.accountId }) })
  if (!object(raw) || typeof raw.changed !== 'boolean' || raw.revision !== before.revision + (raw.changed ? 1 : 0)) throw invalid()
  const v = member(raw.member, before.churchId, before.id); if (v.accountId !== account.accountId) throw invalid()
  return { member: v, revision: raw.revision as number, changed: raw.changed }
}
