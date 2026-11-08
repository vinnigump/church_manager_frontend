import { api, type ApiClient } from '../api'
import { isUuid, isInstant } from '../validation'
import { instantNanos } from './occurrence-api'

// Integrated event-team-v1 1.0.0; history, not a membership directory.
export interface TeamAssignment { id: string; membershipId: string; role: 'COORDINATOR' | 'SUPPORT'; assignedAt: string; releasedAt: string | null; eligible: boolean }
export interface TeamPage { occurrenceId: string; revision: number; items: TeamAssignment[]; page: number; size: number; total: number }
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const invalid = () => new Error('Não foi possível validar o histórico da equipe.')
export async function readOccurrenceTeam(churchId: string, occurrenceId: string, page = 0, signal?: AbortSignal, client: ApiClient = api): Promise<TeamPage> {
  if (!isUuid(churchId) || !isUuid(occurrenceId) || !integer(page) || page > 100000) throw invalid()
  const v = await client.request<unknown>(`/events/churches/${churchId}/occurrences/${occurrenceId}/team?page=${page}&size=20`, { signal })
  if (!record(v) || v.occurrenceId !== occurrenceId || !integer(v.revision) || !integer(v.total)
    || v.page !== page || v.size !== 20 || !Array.isArray(v.items) || v.items.length > 20
    || v.items.length !== Math.min(20, Math.max(0, v.total - page * 20))) throw invalid()
  const items = v.items.map((item: unknown): TeamAssignment => {
    if (!record(item) || !uuid(item.id) || !uuid(item.membershipId) || (item.role !== 'COORDINATOR' && item.role !== 'SUPPORT')
      || !isInstant(item.assignedAt) || (item.releasedAt !== null && !isInstant(item.releasedAt))
      || typeof item.eligible !== 'boolean' || (item.releasedAt !== null && item.eligible)) throw invalid()
    if (item.releasedAt !== null && instantNanos(item.releasedAt as string) < instantNanos(item.assignedAt)) throw invalid()
    return { id: item.id, membershipId: item.membershipId, role: item.role, assignedAt: item.assignedAt, releasedAt: item.releasedAt as string | null, eligible: item.eligible }
  })
  if (new Set(items.map(item => item.id)).size !== items.length) throw invalid()
  return { occurrenceId, revision: v.revision, items, page, size: 20, total: v.total }
}
