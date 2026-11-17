import { api } from '../api'
import { isUuid } from '../validation'
export interface DirectoryPerson { id: string; churchId: string; fullName: string; preferredName: string | null; status: string; membershipStatus: 'ACTIVE' | 'SUSPENDED' | null }
export interface PeoplePage { items: DirectoryPerson[]; page: number; size: number; total: number }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const invalid = () => new Error('Não foi possível validar a lista de pessoas.')
export async function listPeople(church: string, search: string, page: number, signal: AbortSignal): Promise<PeoplePage> {
  if (!isUuid(church) || search.length > 120 || !Number.isSafeInteger(page) || page < 0 || page > 100000) throw invalid()
  const query = new URLSearchParams({ page: String(page), size: '20', q: search.trim() })
  const v = await api.request<unknown>(`/people/churches/${church}?${query}`, { signal, cache: 'no-store' })
  if (!object(v) || !Array.isArray(v.items) || v.page !== page || v.size !== 20 || !Number.isSafeInteger(v.total) || (v.total as number) < v.items.length || v.items.length > 20) throw invalid()
  const items = v.items.map((p): DirectoryPerson => {
    if (!object(p) || typeof p.id !== 'string' || !isUuid(p.id) || p.churchId !== church || typeof p.fullName !== 'string' || !p.fullName.trim()
      || (p.preferredName !== null && typeof p.preferredName !== 'string') || typeof p.status !== 'string' || !p.status.trim()
      || ![null, 'ACTIVE', 'SUSPENDED'].includes(p.membershipStatus as string | null)) throw invalid()
    return { id: p.id, churchId: church, fullName: p.fullName, preferredName: p.preferredName as string | null, status: p.status,
      membershipStatus: p.membershipStatus as DirectoryPerson['membershipStatus'] }
  })
  if (new Set(items.map(p => p.id)).size !== items.length) throw invalid()
  return { items, page, size: 20, total: v.total as number }
}
