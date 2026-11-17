import { api } from '../api'
import { isUuid } from '../validation'
export const ministryManagePermission = 'MINISTRY_UNIT_MANAGE'
export interface CatalogMinistry { id: string; name: string; areaName: string; localId: string | null }
export interface LocalMinistry { id: string; churchId: string; denominationMinistryId: string; name: string; status: string }
export interface Department { id: string; ministryId: string; name: string; status: string; revision: number }
export interface Page<T> { items: T[]; page: number; size: number; total: number }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const text = (v: unknown): v is string => typeof v === 'string' && Boolean(v.trim())
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const invalid = () => new Error('Não foi possível validar as unidades da igreja.')
function base(church: string) { if (!uuid(church)) throw invalid(); return `/organization/churches/${church}/ministry-management` }
function department(v: unknown, ministry: string): Department { if (!object(v) || !uuid(v.id) || v.ministryId !== ministry || !text(v.name) || !text(v.status) || !integer(v.revision)) throw invalid(); return { id: v.id, ministryId: ministry, name: v.name, status: v.status, revision: v.revision } }
function local(v: unknown, church: string): LocalMinistry { if (!object(v) || !uuid(v.id) || v.churchId !== church || !uuid(v.denominationMinistryId) || !text(v.name) || !text(v.status)) throw invalid(); return { id: v.id, churchId: church, denominationMinistryId: v.denominationMinistryId, name: v.name, status: v.status } }
async function page<T extends { id: string }>(path: string, index: number, parse: (v: unknown) => T, signal: AbortSignal): Promise<Page<T>> {
  if (!integer(index) || index > 100000) throw invalid()
  const v = await api.request<unknown>(`${path}?page=${index}&size=20`, { signal })
  if (!object(v) || v.page !== index || v.size !== 20 || !integer(v.total) || !Array.isArray(v.items) || v.items.length > 20) throw invalid()
  const items = v.items.map(parse); if (new Set(items.map(v => v.id)).size !== items.length || items.length !== Math.min(20, Math.max(0, v.total - index * 20))) throw invalid()
  return { items, page: index, size: 20, total: v.total }
}
export const ministryCatalog = (church: string, index: number, signal: AbortSignal) => page(`${base(church)}/catalog`, index, v => { if (!object(v) || !uuid(v.id) || !text(v.name) || !text(v.areaName) || !(v.localId === null || uuid(v.localId))) throw invalid(); return { id: v.id, name: v.name, areaName: v.areaName, localId: v.localId as string | null } }, signal)
export const localMinistries = (church: string, index: number, signal: AbortSignal) => page(base(church), index, v => local(v, church), signal)
function departmentsPath(church: string, ministry: string) { if (!uuid(ministry)) throw invalid(); return `${base(church)}/${ministry}/departments` }
export const ministryDepartments = (church: string, ministry: string, index: number, signal: AbortSignal) => page(departmentsPath(church, ministry), index, v => department(v, ministry), signal)
function command(body: unknown, signal: AbortSignal, revision?: number): RequestInit { return { method: revision === undefined ? 'POST' : 'PUT', signal, headers: { 'Content-Type': 'application/json', ...(revision === undefined ? {} : { 'X-Expected-Revision': String(revision) }) }, body: JSON.stringify(body) } }
export async function enableMinistry(church: string, template: string, signal: AbortSignal) { if (!uuid(template)) throw invalid(); const v = local(await api.request<unknown>(base(church), command({ denominationMinistryId: template }, signal)), church); if (v.denominationMinistryId !== template) throw invalid(); return v }
export async function createDepartment(church: string, ministry: string, requestId: string, name: string, signal: AbortSignal) { if (!uuid(requestId)) throw invalid(); const v = department(await api.request<unknown>(departmentsPath(church, ministry), command({ requestId, name: name.trim() }, signal)), ministry); if (v.id !== requestId) throw invalid(); return v }
export async function renameDepartment(church: string, before: Department, name: string, signal: AbortSignal) { const v = department(await api.request<unknown>(`${departmentsPath(church, before.ministryId)}/${before.id}`, command({ name: name.trim() }, signal, before.revision)), before.ministryId); if (v.id !== before.id) throw invalid(); return v }
