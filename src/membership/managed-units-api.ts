import { api, type ApiClient } from '../api'
import { isUuid } from '../validation'
import { isGroupKind, type GroupKind } from './group-api'

// managed-ministry-units-v1 1.0.0; backend #169 integrated in 130be28.
export interface ManagedUnit { id: string; churchId: string; kind: GroupKind; ministryId: string; name: string; ministryName: string; active: boolean }
export interface ManagedUnits { items: ManagedUnit[]; page: number; size: number; total: number }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const name = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 180
const invalid = () => new Error('Não foi possível validar os ministérios e departamentos.')
export async function listManagedUnits(church: string, search = '', kind: GroupKind | '' = '', page = 0, signal?: AbortSignal, client: ApiClient = api): Promise<ManagedUnits> {
  if (!isUuid(church) || typeof search !== 'string' || search.length > 120 || (kind !== '' && !isGroupKind(kind))
    || !Number.isSafeInteger(page) || page < 0 || page > 100000) throw invalid()
  const query = new URLSearchParams({ page: String(page), size: '20' })
  if (kind) query.set('kind', kind)
  if (search.trim()) query.set('q', search.trim())
  const raw = await client.request<unknown>(`/membership/churches/${church}/managed-ministry-units?${query}`, { signal })
  if (!object(raw) || !Array.isArray(raw.items) || raw.page !== page || raw.size !== 20 || !Number.isSafeInteger(raw.total)
    || (raw.total as number) < raw.items.length || raw.items.length > 20) throw invalid()
  const items = raw.items.map((v: unknown): ManagedUnit => {
    if (!object(v) || !uuid(v.id) || v.churchId !== church || typeof v.kind !== 'string' || !isGroupKind(v.kind)
      || (kind && v.kind !== kind) || !uuid(v.ministryId) || (v.kind === 'MINISTRY' && v.ministryId !== v.id)
      || !name(v.name) || !name(v.ministryName) || typeof v.active !== 'boolean') throw invalid()
    return { id: v.id, churchId: church, kind: v.kind, ministryId: v.ministryId, name: v.name, ministryName: v.ministryName, active: v.active }
  })
  if (new Set(items.map(v => v.id)).size !== items.length) throw invalid()
  return { items, page, size: 20, total: raw.total as number }
}
