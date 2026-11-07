import { api, type ApiClient } from '../api'
import { isUuid } from '../events/catalog-api'
import { parseProfile, parseProfileVersionDetail, type ProfileVersionDetail, type SecurityProfile, type SecurityScope } from './security-api'

// profile-drafts-v1 e profile-lifecycle-v1 1.0.0 integrados.
export interface ProfileDraftInput { name: string; permissionCodes: string[] }
export interface CreateProfileInput extends ProfileDraftInput { code: string; scopeType: SecurityScope }
export interface ProfileCommandResult { profileId: string; versionId: string; profileRevision: number; versionRevision: number; status: string }
const safeRevision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const invalid = () => new Error('Não foi possível validar a alteração do perfil.')
function path(denominationId: string, profileId?: string) {
  if (!isUuid(denominationId) || (profileId !== undefined && !isUuid(profileId))) throw invalid()
  return `/security/denominations/${denominationId}/profiles${profileId ? `/${profileId}` : ''}`
}
function profile(value: SecurityProfile) {
  const parsed = parseProfile(value)
  if (!['DRAFT', 'ACTIVE', 'DISABLED'].includes(parsed.status) || !['CHURCH', 'DENOMINATION'].includes(parsed.scopeType)) throw invalid()
  return parsed
}
function draft(value: ProfileVersionDetail) {
  const parsed = parseProfileVersionDetail(value)
  if (parsed.status !== 'DRAFT') throw invalid()
  return parsed
}
function input(value: ProfileDraftInput): ProfileDraftInput {
  if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 160
    || !Array.isArray(value.permissionCodes) || value.permissionCodes.length > 100
    || value.permissionCodes.some(code => typeof code !== 'string' || !code.trim() || code.length > 100)
    || new Set(value.permissionCodes).size !== value.permissionCodes.length) throw new Error('Revise o nome e as permissões do rascunho.')
  return { name: value.name.trim(), permissionCodes: [...value.permissionCodes] }
}
function result(value: unknown, expectedProfileId?: string, expectedVersionId?: string): ProfileCommandResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalid()
  const data = value as Record<string, unknown>
  if (typeof data.profileId !== 'string' || !isUuid(data.profileId) || typeof data.versionId !== 'string' || !isUuid(data.versionId)
    || !safeRevision(data.profileRevision) || !safeRevision(data.versionRevision) || !['DRAFT', 'ACTIVE', 'DISABLED'].includes(String(data.status))
    || (expectedProfileId !== undefined && data.profileId !== expectedProfileId) || (expectedVersionId !== undefined && data.versionId !== expectedVersionId)) throw invalid()
  return { profileId: data.profileId, versionId: data.versionId, profileRevision: data.profileRevision, versionRevision: data.versionRevision, status: data.status as string }
}
async function command(url: string, revision: number, body: unknown, method: 'POST' | 'PUT', signal: AbortSignal | undefined, client: ApiClient) {
  if (!safeRevision(revision)) throw invalid()
  return client.request<unknown>(url, { method, headers: { 'X-Expected-Revision': String(revision), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal })
}
export async function createProfile(denominationId: string, value: CreateProfileInput, signal?: AbortSignal, client: ApiClient = api) {
  const url = path(denominationId)
  const content = input(value)
  if (typeof value.code !== 'string' || !value.code.trim() || value.code.trim().length > 80 || !['CHURCH', 'DENOMINATION'].includes(value.scopeType)) throw invalid()
  const created = result(await client.request<unknown>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: value.code.trim(), scopeType: value.scopeType, ...content }), signal }))
  if (created.status !== 'DRAFT') throw invalid()
  return created
}
export async function readProfileDraft(denominationId: string, profileId: string, signal?: AbortSignal, client: ApiClient = api) {
  return draft(parseProfileVersionDetail(await client.request<unknown>(`${path(denominationId, profileId)}/draft`, { signal })))
}
export async function copyProfileDraft(denominationId: string, current: SecurityProfile, signal?: AbortSignal, client: ApiClient = api) {
  const p = profile(current)
  if (!p.publishedVersionId) throw invalid()
  const copied = result(await command(`${path(denominationId, p.id)}/draft`, p.revision, undefined, 'POST', signal, client), p.id)
  if (copied.versionId === p.publishedVersionId || copied.status !== p.status) throw invalid()
  return copied
}
export async function replaceProfileDraft(denominationId: string, current: SecurityProfile, currentDraft: ProfileVersionDetail, value: ProfileDraftInput, signal?: AbortSignal, client: ApiClient = api) {
  const p = profile(current), d = draft(currentDraft)
  return result(await command(`${path(denominationId, p.id)}/draft`, d.revision, { draftVersionId: d.id, ...input(value) }, 'PUT', signal, client), p.id, d.id)
}
export async function publishProfile(denominationId: string, current: SecurityProfile, currentDraft: ProfileVersionDetail, signal?: AbortSignal, client: ApiClient = api) {
  const p = profile(current), d = draft(currentDraft)
  const published = result(await command(`${path(denominationId, p.id)}/publish`, p.revision, { draftVersionId: d.id, expectedDraftRevision: d.revision }, 'POST', signal, client), p.id, d.id)
  if (published.status !== (p.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE')) throw invalid()
  return published
}
export async function setProfileActive(denominationId: string, current: SecurityProfile, active: boolean, signal?: AbortSignal, client: ApiClient = api) {
  const p = profile(current)
  if (!p.publishedVersionId || p.status !== (active ? 'DISABLED' : 'ACTIVE')) throw invalid()
  const changed = result(await command(`${path(denominationId, p.id)}/${active ? 'reactivate' : 'deactivate'}`, p.revision, undefined, 'POST', signal, client), p.id, p.publishedVersionId)
  if (changed.status !== (active ? 'ACTIVE' : 'DISABLED')) throw invalid()
  return changed
}
