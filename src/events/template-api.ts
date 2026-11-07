import { api, type ApiClient } from '../api'
import { isUuid } from './catalog-api'

// event-template-version-v1.openapi.json 1.0.0 (EVT-006), consultas somente.
export interface TemplateVersion {
  id: string
  number: number
  status: 'DRAFT' | 'PUBLISHED'
  name: string
  createdAt: string
  publishedAt: string | null
  revision: number
}
export interface EventTemplate {
  id: string
  status: 'DRAFT' | 'PUBLISHED' | 'DISCONTINUED'
  revision: number
  publishedVersionId: string | null
  draft: TemplateVersion | null
}
export interface TemplateHistory { items: TemplateVersion[]; page: number; size: number; total: number }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const nonnegative = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const uuid = (value: unknown): value is string => typeof value === 'string' && isUuid(value)
const invalid = () => new Error('Não foi possível validar os dados do template.')
function instant(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value)
  return Boolean(match && Number.isFinite(Date.parse(value)) && new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) === match[1])
}
function parseVersion(value: unknown): TemplateVersion {
  if (!record(value) || !uuid(value.id) || !nonnegative(value.number) || value.number === 0
    || (value.status !== 'DRAFT' && value.status !== 'PUBLISHED') || typeof value.name !== 'string'
    || !instant(value.createdAt) || !nonnegative(value.revision)
    || (value.publishedAt !== null && !instant(value.publishedAt))
    || (value.status === 'DRAFT' ? value.publishedAt !== null : value.publishedAt === null)) throw invalid()
  return { id: value.id, number: value.number, status: value.status, name: value.name,
    createdAt: value.createdAt, publishedAt: value.publishedAt as string | null, revision: value.revision }
}
function templatePath(denominationId: string, typeId: string) {
  if (!isUuid(denominationId) || !isUuid(typeId)) throw new Error('Contexto de template inválido.')
  return `/events/denominations/${denominationId}/types/${typeId}`
}
export async function readTemplate(denominationId: string, typeId: string, signal?: AbortSignal, client: ApiClient = api): Promise<EventTemplate> {
  const value = await client.request<unknown>(templatePath(denominationId, typeId), { signal })
  if (!record(value) || value.id !== typeId || !nonnegative(value.revision)
    || !['DRAFT', 'PUBLISHED', 'DISCONTINUED'].includes(String(value.status))
    || (value.publishedVersionId !== null && !uuid(value.publishedVersionId))) throw invalid()
  const draft = value.draft === null ? null : parseVersion(value.draft)
  if (draft && (draft.status !== 'DRAFT' || draft.id === value.publishedVersionId)) throw invalid()
  return { id: typeId, status: value.status as EventTemplate['status'], revision: value.revision,
    publishedVersionId: value.publishedVersionId as string | null, draft }
}
export async function listTemplateHistory(denominationId: string, typeId: string, page = 0, signal?: AbortSignal, client: ApiClient = api): Promise<TemplateHistory> {
  const path = templatePath(denominationId, typeId)
  if (!nonnegative(page) || page > 100000) throw new Error('Página de histórico inválida.')
  const size = 20
  const value = await client.request<unknown>(`${path}/versions?${new URLSearchParams({ page: String(page), size: String(size) })}`, { signal })
  if (!record(value) || !Array.isArray(value.items) || value.page !== page || value.size !== size
    || !nonnegative(value.total) || value.items.length > size || value.total < value.items.length) throw invalid()
  const items = value.items.map(parseVersion)
  if (new Set(items.map(item => item.id)).size !== items.length || new Set(items.map(item => item.number)).size !== items.length) throw invalid()
  return { items, page, size, total: value.total }
}
