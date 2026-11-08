import { api, type ApiClient } from '../api'
import { isUuid } from '../validation'

export type Visibility = 'PUBLIC' | 'CHURCH' | 'ELIGIBLE_AUDIENCE'
export const audienceCategories = ['functionIds', 'ministryIds', 'departmentIds'] as const
export type AudienceCategory = typeof audienceCategories[number]
export interface AudiencePolicy { visibility: Visibility; churchLinkRequired: boolean; activeMembershipRequired: boolean; functionIds: string[]; ministryIds: string[]; departmentIds: string[]; minimumAge: number | null; maximumAge: number | null }
export interface AudienceView { occurrenceId: string; churchId: string; revision: number; configured: boolean; policy: AudiencePolicy | null }
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const invalid = () => new Error('Não foi possível validar a configuração de audiência.')
function ids(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100 || value.some(id => typeof id !== 'string' || !isUuid(id))) throw invalid()
  const normalized = (value as string[]).map(id => id.toLowerCase()).sort()
  if (new Set(normalized).size !== normalized.length) throw invalid()
  return normalized
}
export function validateAudiencePolicy(raw: unknown): AudiencePolicy {
  if (!record(raw) || !['PUBLIC', 'CHURCH', 'ELIGIBLE_AUDIENCE'].includes(raw.visibility as string)
    || typeof raw.churchLinkRequired !== 'boolean' || typeof raw.activeMembershipRequired !== 'boolean') throw invalid()
  const minimumAge = raw.minimumAge ?? null, maximumAge = raw.maximumAge ?? null
  for (const value of [minimumAge, maximumAge]) if (value !== null && (!integer(value) || value > 2147483647)) throw new Error('Informe limites de idade inteiros e não negativos.')
  if (minimumAge !== null && maximumAge !== null && (minimumAge as number) > (maximumAge as number)) throw new Error('A idade máxima deve ser maior ou igual à mínima.')
  return { visibility: raw.visibility as Visibility, churchLinkRequired: raw.churchLinkRequired, activeMembershipRequired: raw.activeMembershipRequired,
    functionIds: ids(raw.functionIds), ministryIds: ids(raw.ministryIds), departmentIds: ids(raw.departmentIds), minimumAge: minimumAge as number | null, maximumAge: maximumAge as number | null }
}
export const sameAudience = (a: AudiencePolicy | null, b: AudiencePolicy | null) => JSON.stringify(a && validateAudiencePolicy(a)) === JSON.stringify(b && validateAudiencePolicy(b))
function path(churchId: string, occurrenceId: string) {
  if (!isUuid(churchId) || !isUuid(occurrenceId)) throw invalid()
  return `/events/churches/${churchId}/occurrences/${occurrenceId}/audience-policy`
}
export function parseAudience(v: unknown, churchId: string, occurrenceId: string): AudienceView {
  if (!record(v) || v.churchId !== churchId || v.occurrenceId !== occurrenceId || !integer(v.revision) || typeof v.configured !== 'boolean'
    || v.configured !== (v.policy !== null)) throw invalid()
  return { churchId, occurrenceId, revision: v.revision, configured: v.configured, policy: v.policy === null ? null : validateAudiencePolicy(v.policy) }
}
export async function readAudience(churchId: string, occurrenceId: string, signal?: AbortSignal, client: ApiClient = api) {
  return parseAudience(await client.request<unknown>(path(churchId, occurrenceId), { signal }), churchId, occurrenceId)
}
export async function saveAudience(churchId: string, occurrenceId: string, before: AudienceView, input: AudiencePolicy, signal?: AbortSignal, client: ApiClient = api) {
  const target = path(churchId, occurrenceId); parseAudience(before, churchId, occurrenceId)
  const body = validateAudiencePolicy(input)
  const result = parseAudience(await client.request<unknown>(target, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Expected-Revision': String(before.revision) }, body: JSON.stringify(body), signal }), churchId, occurrenceId)
  if (!result.configured || !sameAudience(result.policy, body) || result.revision !== before.revision + (sameAudience(before.policy, body) ? 0 : 1)) throw new Error('Não foi possível confirmar a configuração. Confira a audiência antes de tentar novamente.')
  return result
}
