import { api } from '../api'
import { isInstant, isUuid } from '../validation'
export const personEditPermission = 'identity:person:contextual:edit'
export interface BasicPerson { id: string; churchId: string; fullName: string; preferredName: string | null; birthDate: string | null; email: string | null; phone: string | null; updatedAt: string; sharedAcrossChurches: true }
export interface BasicDraft { fullName: string; preferredName: string; birthDate: string; email: string; phone: string }
export interface EditHistory { id: string; occurredAt: string; actorId: string; actorName: string; changedFields: string[] }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const nullable = (v: unknown): v is string | null => v === null || typeof v === 'string'
const invalid = () => new Error('Não foi possível validar o cadastro. Consulte novamente.')
function base(church: string, person: string) { if (!isUuid(church) || !isUuid(person)) throw invalid(); return `/people/churches/${church}/${person}/basic-data` }
function parse(v: unknown, church: string, person: string): BasicPerson {
  if (!object(v) || v.id !== person || v.churchId !== church || typeof v.fullName !== 'string' || !v.fullName.trim() || !nullable(v.preferredName) || !nullable(v.email) || !nullable(v.phone) || !nullable(v.birthDate) || (v.birthDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(v.birthDate)) || !isInstant(v.updatedAt) || v.sharedAcrossChurches !== true) throw invalid()
  return { id: person, churchId: church, fullName: v.fullName, preferredName: v.preferredName, birthDate: v.birthDate, email: v.email, phone: v.phone, updatedAt: v.updatedAt, sharedAcrossChurches: true }
}
export async function readBasicPerson(church: string, person: string, signal: AbortSignal) { return parse(await api.request<unknown>(base(church, person), { signal }), church, person) }
export async function saveBasicPerson(church: string, person: string, expected: string, draft: BasicDraft, signal: AbortSignal) {
  if (!isInstant(expected)) throw invalid()
  return parse(await api.request<unknown>(base(church, person), { method: 'PUT', signal, headers: { 'Content-Type': 'application/json', 'X-Expected-Updated-At': expected }, body: JSON.stringify({ fullName: draft.fullName.trim(), preferredName: draft.preferredName.trim() || null, birthDate: draft.birthDate || null, email: draft.email.trim() || null, phone: draft.phone.trim() || null }) }), church, person)
}
export async function readEditHistory(church: string, person: string, signal: AbortSignal): Promise<EditHistory[]> {
  const v = await api.request<unknown>(`${base(church, person)}/history?page=0&size=20`, { signal })
  if (!Array.isArray(v) || v.length > 20) throw invalid()
  const seen = new Set<string>()
  return v.map(row => {
    if (!object(row) || typeof row.id !== 'string' || !isUuid(row.id) || seen.has(row.id) || !isInstant(row.occurredAt) || typeof row.actorId !== 'string' || !isUuid(row.actorId) || typeof row.actorName !== 'string' || !row.actorName.trim() || typeof row.changedFields !== 'string') throw invalid()
    let fields: unknown
    try { fields = JSON.parse(row.changedFields) } catch { throw invalid() }
    if (!Array.isArray(fields) || !fields.length || !fields.every(v => typeof v === 'string' && ['fullName', 'preferredName', 'birthDate', 'email', 'phone'].includes(v))) throw invalid()
    seen.add(row.id)
    return { id: row.id, occurredAt: row.occurredAt, actorId: row.actorId, actorName: row.actorName, changedFields: fields as string[] }
  })
}
