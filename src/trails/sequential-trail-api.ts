import { api } from '../api'
import { isUuid } from '../validation'

export type Scope = { kind: 'CHURCH' | 'DENOMINATION'; id: string }
export type Kind = 'MANUAL' | 'EVENT_PARTICIPATION' | 'QUESTIONNAIRE'
export type Destination = 'USER_ACCOUNT' | 'GROUP' | 'MINISTRY' | 'DEPARTMENT' | 'QUESTIONNAIRE'
export interface Step { name: string; instructions: string; kind: Kind; assignment: 'PARTICIPANT' | 'CHURCH_DESTINATION' | null; requirementId: string | null; requiresAdmissionAuthorization: boolean }
export interface Definition { requestId: string; name: string; steps: Step[] }
export interface Version { id: string; templateId: string; name: string; versionNumber: number; status: 'DRAFT' | 'PUBLISHED' | 'RETIRED'; revision: number; steps: { id: string; position: number; definition: Step }[] }
export interface Binding { stepId: string; destinationKind: Destination; destinationId: string }
export interface Publication { id: string | null; versionId: string; churchId: string; enabled: boolean; revision: number; bindings: Binding[] }
export interface Available { publicationId: string; versionId: string; name: string; versionNumber: number; official: boolean }
export interface Church { churchId: string; churchName: string }
export interface ExecutionStep { id: string; position: number; name: string; instructions: string; kind: Kind; status: string; satisfactionMode: 'NORMAL' | 'ADMINISTRATIVE' | 'WAIVED' | null; requirementId: string | null; workItemId: string | null; requiresAdmissionAuthorization: boolean; available: boolean }
export interface Execution { id: string; churchId: string; personId: string; participantName: string; versionId: string; name: string; status: string; official: boolean; blockReason: string | null; revision: number; steps: ExecutionStep[] }
export interface Option { id: string; label: string }
export interface Options { items: Option[]; page: number; size: number; total: number }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const natural = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const text = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max
const nullableUuid = (v: unknown) => v === null || uuid(v)
const kinds: Kind[] = ['MANUAL', 'EVENT_PARTICIPATION', 'QUESTIONNAIRE']
const destinations: Destination[] = ['USER_ACCOUNT', 'GROUP', 'MINISTRY', 'DEPARTMENT', 'QUESTIONNAIRE']
const taskStates = ['PENDING', 'BLOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED']
const runStates = ['NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED']
const invalid = () => new Error('Não foi possível validar a trilha. Atualize os dados.')
function id(v: string) { if (!uuid(v)) throw invalid(); return v }
function revision(v: number) { if (!natural(v)) throw invalid(); return v }
function array<T>(v: unknown, parse: (row: unknown) => T, key: (row: T) => string): T[] {
  if (!Array.isArray(v) || v.length > 100) throw invalid()
  const rows = v.map(parse); if (new Set(rows.map(key)).size !== rows.length) throw invalid(); return rows
}
function step(v: unknown): Step {
  if (!object(v) || !text(v.name, 180) || !text(v.instructions, 10000) || !kinds.includes(v.kind as Kind) || !nullableUuid(v.requirementId)
    || typeof v.requiresAdmissionAuthorization !== 'boolean' || ![null, 'PARTICIPANT', 'CHURCH_DESTINATION'].includes(v.assignment as string | null)
    || v.kind === 'MANUAL' && (v.assignment === null || v.requirementId !== null) || v.kind !== 'MANUAL' && v.assignment !== null
    || v.kind === 'EVENT_PARTICIPATION' && !uuid(v.requirementId)) throw invalid()
  return { name: v.name, instructions: v.instructions, kind: v.kind as Kind, assignment: v.assignment as Step['assignment'], requirementId: v.requirementId as string | null, requiresAdmissionAuthorization: v.requiresAdmissionAuthorization }
}
function version(v: unknown): Version {
  if (!object(v) || !uuid(v.id) || !uuid(v.templateId) || !text(v.name, 200) || !natural(v.versionNumber) || !v.versionNumber
    || !['DRAFT', 'PUBLISHED', 'RETIRED'].includes(String(v.status)) || !natural(v.revision)) throw invalid()
  const steps = array(v.steps, row => {
    if (!object(row) || !uuid(row.id) || !natural(row.position) || !row.position) throw invalid()
    return { id: row.id, position: row.position, definition: step(row.definition) }
  }, row => row.id)
  if (!steps.length || steps.some((s, n) => s.position !== n + 1)) throw invalid()
  return { id: v.id, templateId: v.templateId, name: v.name, versionNumber: v.versionNumber, status: v.status as Version['status'], revision: v.revision, steps }
}
function publication(v: unknown, church: string, versionId: string): Publication {
  if (!object(v) || !nullableUuid(v.id) || v.churchId !== church || v.versionId !== versionId || typeof v.enabled !== 'boolean' || !natural(v.revision)) throw invalid()
  const bindings = array(v.bindings, row => {
    if (!object(row) || !uuid(row.stepId) || !uuid(row.destinationId) || !destinations.includes(row.destinationKind as Destination)) throw invalid()
    return { stepId: row.stepId, destinationKind: row.destinationKind as Destination, destinationId: row.destinationId }
  }, row => row.stepId)
  return { id: v.id as string | null, churchId: church, versionId, enabled: v.enabled, revision: v.revision, bindings }
}
function execution(v: unknown, expected?: { id?: string; church?: string; person?: string }): Execution {
  if (!object(v) || !uuid(v.id) || !uuid(v.churchId) || !uuid(v.personId) || !text(v.participantName, 200) || !uuid(v.versionId) || !text(v.name, 200)
    || !runStates.includes(String(v.status)) || typeof v.official !== 'boolean' || !natural(v.revision) || v.blockReason !== null && !text(v.blockReason, 80)
    || expected?.id !== undefined && v.id !== expected.id || expected?.church !== undefined && v.churchId !== expected.church || expected?.person !== undefined && v.personId !== expected.person) throw invalid()
  const steps = array(v.steps, row => {
    if (!object(row) || !uuid(row.id) || !natural(row.position) || !row.position || !text(row.name, 180) || !text(row.instructions, 10000)
      || !kinds.includes(row.kind as Kind) || !taskStates.includes(String(row.status)) || ![null, 'NORMAL', 'ADMINISTRATIVE', 'WAIVED'].includes(row.satisfactionMode as string | null)
      || !nullableUuid(row.requirementId) || !nullableUuid(row.workItemId) || typeof row.requiresAdmissionAuthorization !== 'boolean' || typeof row.available !== 'boolean'
      || row.kind !== 'MANUAL' && !uuid(row.requirementId) || row.available && !['AVAILABLE', 'IN_PROGRESS'].includes(String(row.status))) throw invalid()
    return { id: row.id, position: row.position, name: row.name, instructions: row.instructions, kind: row.kind as Kind, status: row.status as string,
      satisfactionMode: row.satisfactionMode as ExecutionStep['satisfactionMode'], requirementId: row.requirementId as string | null, workItemId: row.workItemId as string | null,
      requiresAdmissionAuthorization: row.requiresAdmissionAuthorization, available: row.available }
  }, row => row.id)
  if (!steps.length || steps.some((s, n) => s.position !== n + 1)) throw invalid()
  return { id: v.id, churchId: v.churchId, personId: v.personId, participantName: v.participantName, versionId: v.versionId, name: v.name,
    status: v.status as string, official: v.official, blockReason: v.blockReason as string | null, revision: v.revision, steps }
}
const base = (scope: Scope) => `/trails/${scope.kind === 'CHURCH' ? 'churches' : 'denominations'}/${id(scope.id)}`
const read = (path: string, signal?: AbortSignal) => api.request<unknown>(path, { signal, cache: 'no-store' })
const write = (path: string, method: 'POST' | 'PUT', body: unknown, signal: AbortSignal) => api.request<unknown>(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal })
export async function ownChurches(signal: AbortSignal) {
  return array(await read('/accounts/me/trails/churches', signal), v => {
    if (!object(v) || !uuid(v.churchId) || !text(v.churchName, 200)) throw invalid(); return { churchId: v.churchId, churchName: v.churchName }
  }, v => v.churchId)
}
export async function available(church: string, signal: AbortSignal) {
  return array(await read(`/accounts/me/trails/available/${id(church)}`, signal), v => {
    if (!object(v) || !uuid(v.publicationId) || !uuid(v.versionId) || !text(v.name, 200) || !natural(v.versionNumber) || !v.versionNumber || typeof v.official !== 'boolean') throw invalid()
    return { publicationId: v.publicationId, versionId: v.versionId, name: v.name, versionNumber: v.versionNumber, official: v.official }
  }, v => v.publicationId)
}
export async function ownExecution(run: string, person: string, signal: AbortSignal) { return execution(await read(`/accounts/me/trails/${id(run)}/execution`, signal), { id: run, person: id(person) }) }
export async function start(church: string, publicationId: string, person: string, signal: AbortSignal) { return execution(await write(`/accounts/me/trails/churches/${id(church)}/publications/${id(publicationId)}/start`, 'POST', undefined, signal), { church, person: id(person) }) }
export async function refresh(run: string, person: string, signal: AbortSignal) { return execution(await write(`/accounts/me/trails/${id(run)}/refresh`, 'POST', undefined, signal), { id: run, person: id(person) }) }
export async function versions(scope: Scope, signal: AbortSignal) { return array(await read(`${base(scope)}/${scope.kind === 'CHURCH' ? 'library' : 'versions'}`, signal), version, v => v.id) }
export async function ownedVersions(scope: Scope, signal: AbortSignal) { return array(await read(`${base(scope)}/versions`, signal), version, v => v.id) }
export async function executions(church: string, signal: AbortSignal) { return array(await read(`${base({ kind: 'CHURCH', id: church })}/executions`, signal), v => execution(v, { church }), v => v.id) }
export async function readPublication(church: string, versionId: string, signal: AbortSignal) { return publication(await read(`${base({ kind: 'CHURCH', id: church })}/versions/${id(versionId)}/publication`, signal), church, versionId) }
export async function savePublication(before: Publication, enabled: boolean, bindings: Binding[], signal: AbortSignal) {
  if (bindings.length > 100 || new Set(bindings.map(v => v.stepId)).size !== bindings.length || bindings.some(v => !uuid(v.stepId) || !uuid(v.destinationId) || !destinations.includes(v.destinationKind))) throw invalid()
  const result = publication(await write(`${base({ kind: 'CHURCH', id: before.churchId })}/versions/${id(before.versionId)}/publication?revision=${revision(before.revision)}`, 'PUT', { enabled, bindings }, signal), before.churchId, before.versionId)
  if (result.enabled !== enabled || result.bindings.length !== bindings.length || result.bindings.some(v => !bindings.some(b => b.stepId === v.stepId && b.destinationKind === v.destinationKind && b.destinationId === v.destinationId))) throw invalid()
  return result
}
export async function saveVersion(scope: Scope, input: Definition, signal: AbortSignal, before?: Version, revise = false) {
  if (!uuid(input.requestId) || !text(input.name, 200) || !input.steps.length || input.steps.length > 100) throw invalid()
  const body = { requestId: input.requestId, name: input.name.trim(), steps: input.steps.map(v => { const s = step(v); return { ...s, name: s.name.trim(), instructions: s.instructions.trim() } }) }
  const suffix = before ? `/${id(before.id)}${revise ? '/revisions' : `?revision=${revision(before.revision)}`}` : ''
  const result = version(await write(`${base(scope)}/versions${suffix}`, before && !revise ? 'PUT' : 'POST', body, signal))
  if (result.id !== (before && !revise ? before.id : input.requestId) || result.name !== body.name || JSON.stringify(result.steps.map(v => v.definition)) !== JSON.stringify(body.steps)) throw invalid(); return result
}
export async function publish(scope: Scope, before: Version, signal: AbortSignal) {
  const result = version(await write(`${base(scope)}/versions/${id(before.id)}/publish?revision=${revision(before.revision)}`, 'POST', undefined, signal))
  if (result.id !== before.id || result.status !== 'PUBLISHED') throw invalid(); return result
}
export async function designate(scope: Scope, before: Version, signal: AbortSignal) {
  if (scope.kind !== 'DENOMINATION') throw invalid()
  await api.request(`${base(scope)}/versions/${id(before.id)}/official`, { method: 'POST', signal }, 200, 'text')
}
export async function administrative(church: string, run: string, action: 'waive' | 'authorize', reason: string, signal: AbortSignal, task?: string) {
  if (!text(reason, 500)) throw invalid()
  const path = action === 'waive' ? `/tasks/${id(task ?? '')}/waive` : `/executions/${id(run)}/admission-authorization`
  return execution(await write(`${base({ kind: 'CHURCH', id: church })}${path}`, 'POST', { reason: reason.trim() }, signal), { id: run, church })
}
export async function options(scope: Scope, kind: Kind | Destination, query: string, page: number, signal: AbortSignal): Promise<Options> {
  if (query.length > 120 || !natural(page)) throw invalid()
  const params = new URLSearchParams({ kind, query, page: String(page), size: '20' }), value = await read(`${base(scope)}/options?${params}`, signal)
  if (!object(value) || !Array.isArray(value.items) || value.items.length > 20 || value.page !== page || value.size !== 20 || !natural(value.total) || value.total < value.items.length) throw invalid()
  const items = array(value.items, v => { if (!object(v) || !uuid(v.id) || !text(v.label, 300)) throw invalid(); return { id: v.id, label: v.label } }, v => v.id)
  return { items, page, size: 20, total: value.total }
}
