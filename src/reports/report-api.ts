import { api } from '../api'
import { isInstant, isUuid } from '../validation'
export const reportPermission = 'REPORT_VIEW'
export const reportNames = { PEOPLE: 'Pessoas cadastradas', MEMBERS: 'Membros da igreja', MINISTRY_MEMBERS: 'Integrantes por ministério', SERVICE_ATTENDANCE: 'Escalas e atuações por período', PENDING_BADGES: 'Crachás a recolher' }
export type ReportKind = keyof typeof reportNames
export interface ReportRow { id: string; person: string; status: string; ministry: string | null; department: string | null; source: string | null; badge: string | null; planned_at: string | null; recorded_at: string | null; closed_at: string | null }
export interface ReportPage { churchId: string; kind: ReportKind; timeZone: string; from: string | null; to: string | null; items: ReportRow[]; page: number; size: number; total: number }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && Boolean(v.trim())
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const nullable = (v: unknown): v is string | null => v === null || typeof v === 'string'
const date = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)
const invalid = () => new Error('Não foi possível validar o relatório da igreja.')
export async function readReport(church: string, kind: ReportKind, q: string, from: string, to: string, page: number, signal: AbortSignal): Promise<ReportPage> {
  if (!isUuid(church) || !Object.hasOwn(reportNames, kind) || q.length > 120 || !integer(page) || page > 100000 || kind === 'SERVICE_ATTENDANCE' && (!date(from) || !date(to) || from > to)) throw invalid()
  const query = new URLSearchParams({ kind, q, page: String(page), size: '20', ...(kind === 'SERVICE_ATTENDANCE' ? { from, to } : {}) })
  const v = await api.request<unknown>(`/reports/churches/${church}?${query}`, { signal })
  if (!object(v) || v.churchId !== church || v.kind !== kind || !text(v.timeZone) || v.from !== (kind === 'SERVICE_ATTENDANCE' ? from : null) || v.to !== (kind === 'SERVICE_ATTENDANCE' ? to : null) || v.page !== page || v.size !== 20 || !integer(v.total) || !Array.isArray(v.items) || v.items.length !== Math.min(20, Math.max(0, v.total - page * 20))) throw invalid()
  try { new Intl.DateTimeFormat('pt-BR', { timeZone: v.timeZone }).format(new Date()) } catch { throw invalid() }
  const seen = new Set<string>()
  const items = v.items.map(row => {
    if (!object(row) || !text(row.id) || seen.has(row.id) || !text(row.person) || !text(row.status) || !nullable(row.ministry) || !nullable(row.department) || !nullable(row.source) || !nullable(row.badge) || ![row.planned_at, row.recorded_at, row.closed_at].every(value => value === null || isInstant(value))) throw invalid()
    seen.add(row.id)
    return { id: row.id, person: row.person, status: row.status, ministry: row.ministry, department: row.department, source: row.source, badge: row.badge, planned_at: row.planned_at as string | null, recorded_at: row.recorded_at as string | null, closed_at: row.closed_at as string | null }
  })
  return { churchId: church, kind, timeZone: v.timeZone, from: v.from as string | null, to: v.to as string | null, items, page, size: 20, total: v.total }
}
