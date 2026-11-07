import { api, type ApiClient } from '../api'
import { isUuid } from '../validation'
import { instant } from '../security/security-api'

// event-spaces-v1.openapi.json 1.0.0, backend #97.
export type PlanningOutcome = 'OUTSIDE_SCOPE' | 'UNDETERMINED' | 'NONE' | 'PREVENTIVE' | 'MODERATE' | 'CRITICAL'
export interface OccurrenceSpace { occurrenceId: string; churchId: string; code: string | null; name: string | null; revision: number; defined: boolean; label: string }
export interface PlanningOverlap { occurrenceId: string; startsAt: string; endsAt: string; status: string; outcome: PlanningOutcome; overlap: string | null }
export interface PlanningPage { occurrenceId: string; outcome: PlanningOutcome; hasUnresolvedSpaces: boolean; limitSeconds: number; items: PlanningOverlap[]; page: number; size: number; total: number }
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const outcome = (v: unknown): v is PlanningOutcome => typeof v === 'string' && ['OUTSIDE_SCOPE', 'UNDETERMINED', 'NONE', 'PREVENTIVE', 'MODERATE', 'CRITICAL'].includes(v)
const invalid = () => new Error('Não foi possível validar os dados de planejamento.')
function base(churchId: string, occurrenceId: string) {
  if (!isUuid(churchId) || !isUuid(occurrenceId)) throw new Error('Contexto de planejamento inválido.')
  return `/events/churches/${churchId}/occurrences/${occurrenceId}`
}
export function parseSpace(v: unknown, churchId: string, occurrenceId: string): OccurrenceSpace {
  if (!record(v) || v.churchId !== churchId || v.occurrenceId !== occurrenceId || !integer(v.revision)
    || (v.code !== null && (typeof v.code !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(v.code)))
    || (v.name !== null && (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 180))
    || (v.code === null && v.name !== null) || typeof v.defined !== 'boolean' || v.defined !== (v.code !== null)
    || v.label !== (v.code === null ? 'A definir' : v.name ?? v.code)) throw invalid()
  return { occurrenceId, churchId, code: v.code as string | null, name: v.name as string | null, revision: v.revision, defined: v.defined, label: v.label as string }
}
function parseOverlap(v: unknown, rootId: string): PlanningOverlap {
  if (!record(v) || !uuid(v.occurrenceId) || v.occurrenceId === rootId || !instant(v.startsAt) || !instant(v.endsAt)
    || typeof v.status !== 'string' || !v.status.trim() || !outcome(v.outcome)
    || (v.overlap !== null && (typeof v.overlap !== 'string' || !/^PT(?=.+)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d{1,9})?S)?$/.test(v.overlap)))) throw invalid()
  return { occurrenceId: v.occurrenceId, startsAt: v.startsAt, endsAt: v.endsAt, status: v.status, outcome: v.outcome, overlap: v.overlap as string | null }
}
export function parsePlanningPage(v: unknown, occurrenceId: string, page: number): PlanningPage {
  if (!record(v) || v.occurrenceId !== occurrenceId || !outcome(v.outcome) || typeof v.hasUnresolvedSpaces !== 'boolean'
    || !integer(v.limitSeconds) || !integer(v.total) || v.page !== page || v.size !== 20 || !Array.isArray(v.items)
    || v.items.length > 20 || v.total < v.items.length) throw invalid()
  const items = v.items.map(item => parseOverlap(item, occurrenceId))
  if (new Set(items.map(item => item.occurrenceId)).size !== items.length) throw invalid()
  return { occurrenceId, outcome: v.outcome, hasUnresolvedSpaces: v.hasUnresolvedSpaces, limitSeconds: v.limitSeconds, items, page, size: 20, total: v.total }
}
export async function readOccurrenceSpace(churchId: string, occurrenceId: string, signal?: AbortSignal, client: ApiClient = api) {
  return parseSpace(await client.request<unknown>(`${base(churchId, occurrenceId)}/space`, { signal }), churchId, occurrenceId)
}
export async function readPlanningOverlaps(churchId: string, occurrenceId: string, page = 0, signal?: AbortSignal, client: ApiClient = api) {
  const path = base(churchId, occurrenceId)
  if (!integer(page) || page > 100000) throw invalid()
  return parsePlanningPage(await client.request<unknown>(`${path}/conflicts?page=${page}&size=20`, { signal }), occurrenceId, page)
}
