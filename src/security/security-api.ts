import { api, type ApiClient } from '../api'
import { isUuid } from '../events/catalog-api'

// permission-catalog-v1 1.0.0 e profile-read-v1 1.2.0 integrados no backend.
export type SecurityScope = 'CHURCH' | 'DENOMINATION'
export interface PermissionEntry { code: string; introducedIn: string; resourceType: SecurityScope; scopeTypes: SecurityScope[]; available: boolean }
export interface PermissionCatalog { catalogVersion: string; permissions: PermissionEntry[] }
export interface SecurityProfile { id: string; code: string; name: string; scopeType: string; status: string; revision: number; publishedVersionId: string | null }
export interface ProfileVersion { id: string; versionNumber: number; name: string; status: 'DRAFT' | 'PUBLISHED' | 'LEGACY_SNAPSHOT'; revision: number; createdAt: string; publishedAt: string | null }
export interface ProfileVersionDetail extends ProfileVersion { permissionCodes: string[] }
export interface SecurityPage<T> { items: T[]; page: number; size: number; total: number }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const uuid = (value: unknown): value is string => typeof value === 'string' && isUuid(value)
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const scope = (value: unknown): value is SecurityScope => value === 'CHURCH' || value === 'DENOMINATION'
const invalid = () => new Error('Não foi possível validar os dados administrativos de segurança.')
function instant(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value)
  return Boolean(match && Number.isFinite(Date.parse(value)) && new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) === match[1])
}
function base(denominationId: string, profileId?: string, versionId?: string) {
  if (![denominationId, profileId, versionId].filter(value => value !== undefined).every(value => isUuid(value!))) throw new Error('Contexto administrativo inválido.')
  return `/security/denominations/${denominationId}${profileId ? `/profiles/${profileId}` : ''}${versionId ? `/versions/${versionId}` : ''}`
}
export function parseProfile(value: unknown): SecurityProfile {
  if (!record(value) || !uuid(value.id) || !text(value.code) || !text(value.name) || !text(value.scopeType) || !text(value.status)
    || !integer(value.revision) || (value.publishedVersionId !== null && !uuid(value.publishedVersionId))) throw invalid()
  return { id: value.id, code: value.code, name: value.name, scopeType: value.scopeType, status: value.status, revision: value.revision, publishedVersionId: value.publishedVersionId as string | null }
}
function parseVersion(value: unknown): ProfileVersion {
  if (!record(value) || !uuid(value.id) || !integer(value.versionNumber) || value.versionNumber < 1 || !text(value.name)
    || !['DRAFT', 'PUBLISHED', 'LEGACY_SNAPSHOT'].includes(String(value.status)) || !integer(value.revision)
    || !instant(value.createdAt) || (value.publishedAt !== null && !instant(value.publishedAt))) throw invalid()
  return { id: value.id, versionNumber: value.versionNumber, name: value.name, status: value.status as ProfileVersion['status'], revision: value.revision, createdAt: value.createdAt, publishedAt: value.publishedAt as string | null }
}
function parsePage<T extends { id: string }>(value: unknown, page: number, parse: (item: unknown) => T): SecurityPage<T> {
  if (!record(value) || !Array.isArray(value.items) || value.page !== page || value.size !== 20 || !integer(value.total) || value.items.length > 20 || value.total < value.items.length) throw invalid()
  const items = value.items.map(parse)
  if (new Set(items.map(item => item.id)).size !== items.length) throw invalid()
  return { items, page, size: 20, total: value.total }
}
function paging(page: number) {
  if (!integer(page) || page > 100000) throw new Error('Página administrativa inválida.')
  return new URLSearchParams({ page: String(page), size: '20' })
}
export async function readPermissionCatalog(denominationId: string, signal?: AbortSignal, client: ApiClient = api): Promise<PermissionCatalog> {
  const value = await client.request<unknown>(`${base(denominationId)}/permission-catalog`, { signal })
  if (!record(value) || !text(value.catalogVersion) || !Array.isArray(value.permissions)) throw invalid()
  const permissions = value.permissions.map((item: unknown): PermissionEntry => {
    if (!record(item) || !text(item.code) || !text(item.introducedIn) || !scope(item.resourceType)
      || !Array.isArray(item.scopeTypes) || !item.scopeTypes.every(scope) || new Set(item.scopeTypes).size !== item.scopeTypes.length || typeof item.available !== 'boolean') throw invalid()
    return { code: item.code, introducedIn: item.introducedIn, resourceType: item.resourceType, scopeTypes: item.scopeTypes, available: item.available }
  })
  if (new Set(permissions.map(item => item.code)).size !== permissions.length) throw invalid()
  return { catalogVersion: value.catalogVersion, permissions }
}
export async function listProfiles(denominationId: string, page = 0, signal?: AbortSignal, client: ApiClient = api) {
  return parsePage(await client.request<unknown>(`${base(denominationId)}/profiles?${paging(page)}`, { signal }), page, parseProfile)
}
export async function readProfile(denominationId: string, profileId: string, signal?: AbortSignal, client: ApiClient = api) {
  const value = parseProfile(await client.request<unknown>(base(denominationId, profileId), { signal }))
  if (value.id !== profileId) throw invalid()
  return value
}
export async function listProfileVersions(denominationId: string, profileId: string, page = 0, signal?: AbortSignal, client: ApiClient = api) {
  return parsePage(await client.request<unknown>(`${base(denominationId, profileId)}/versions?${paging(page)}`, { signal }), page, parseVersion)
}
export async function readProfileVersion(denominationId: string, profileId: string, versionId: string, signal?: AbortSignal, client: ApiClient = api): Promise<ProfileVersionDetail> {
  const raw = await client.request<unknown>(base(denominationId, profileId, versionId), { signal })
  const value = parseVersion(raw)
  if (value.id !== versionId || !record(raw) || !Array.isArray(raw.permissionCodes) || !raw.permissionCodes.every(text)
    || new Set(raw.permissionCodes).size !== raw.permissionCodes.length) throw invalid()
  return { ...value, permissionCodes: raw.permissionCodes }
}
