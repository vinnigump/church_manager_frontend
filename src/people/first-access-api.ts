import { api } from '../api'
import { publicCommand } from '../public-api'
import { isInstant, isUuid } from '../validation'
export const firstAccessPermission = 'identity:first-access:issue'
export interface FirstAccessCandidate { personId: string; displayName: string }
export interface IssuedLink { relativeUrl: string; expiresAt: string }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const invalid = () => new Error('Não foi possível validar os dados de primeiro acesso.')
function base(church: string) { if (!isUuid(church)) throw invalid(); return `/people/churches/${church}` }
export async function firstAccessCandidates(church: string, q: string, page: number, signal: AbortSignal) {
  if (q.length > 120 || !Number.isSafeInteger(page) || page < 0 || page > 100000) throw invalid()
  const v = await api.request<unknown>(`${base(church)}/first-access-candidates?${new URLSearchParams({ q, page: String(page), size: '20' })}`, { signal })
  if (!object(v) || v.page !== page || v.size !== 20 || !Number.isSafeInteger(v.total) || (v.total as number) < 0 || !Array.isArray(v.items) || v.items.length !== Math.min(20, Math.max(0, (v.total as number) - page * 20))) throw invalid()
  const items = v.items.map(row => { if (!object(row) || typeof row.personId !== 'string' || !isUuid(row.personId) || typeof row.displayName !== 'string' || !row.displayName.trim()) throw invalid(); return { personId: row.personId, displayName: row.displayName } })
  if (new Set(items.map(v => v.personId)).size !== items.length) throw invalid()
  return { items, page, size: 20, total: v.total as number }
}
export async function issueFirstAccess(church: string, person: string, signal: AbortSignal): Promise<IssuedLink> {
  if (!isUuid(person)) throw invalid()
  const v = await api.request<unknown>(`${base(church)}/${person}/first-access-links`, { method: 'POST', signal })
  if (!object(v) || typeof v.relativeUrl !== 'string' || !/^\/primeiro-acesso#token=[A-Za-z0-9_-]{43}$/.test(v.relativeUrl) || !isInstant(v.expiresAt)) throw invalid()
  return { relativeUrl: v.relativeUrl, expiresAt: v.expiresAt }
}
export async function redeemFirstAccess(token: string, login: string, password: string, signal: AbortSignal) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw invalid()
  await publicCommand('/public/first-access/redeem', { token, login: login.trim(), password }, signal, 204)
}
