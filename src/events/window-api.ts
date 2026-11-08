import { api, type ApiClient } from '../api'
import { isUuid } from '../validation'
import { instantNanos, type Occurrence } from './occurrence-api'

export interface WindowDates { opensAt: string; closesAt: string }
export interface WindowView { churchId: string; occurrenceId: string; revision: number; configured: boolean; opensAt: string | null; closesAt: string | null }
const invalid = () => new Error('Revise a janela: abertura anterior ao fechamento, datas com fuso explícito e precisão de até microssegundos.')
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export function validateWindow(v: WindowDates): WindowDates {
  if (typeof v.opensAt !== 'string' || typeof v.closesAt !== 'string' || instantNanos(v.opensAt) % 1000n !== 0n || instantNanos(v.closesAt) % 1000n !== 0n || instantNanos(v.opensAt) >= instantNanos(v.closesAt)) throw invalid()
  return { opensAt: v.opensAt, closesAt: v.closesAt }
}
export function sameWindow(a: WindowView, b: WindowView) {
  return a.configured === b.configured && (!a.configured || (instantNanos(a.opensAt!) === instantNanos(b.opensAt!) && instantNanos(a.closesAt!) === instantNanos(b.closesAt!)))
}
function path(churchId: string, occurrenceId: string) {
  if (!isUuid(churchId) || !isUuid(occurrenceId)) throw invalid()
  return `/events/churches/${churchId}/occurrences/${occurrenceId}/registration-window`
}
export function parseWindow(v: unknown, churchId: string, occurrenceId: string): WindowView {
  if (!record(v) || v.churchId !== churchId || v.occurrenceId !== occurrenceId || !Number.isSafeInteger(v.revision) || (v.revision as number) < 0 || typeof v.configured !== 'boolean') throw invalid()
  if (v.configured) validateWindow({ opensAt: v.opensAt as string, closesAt: v.closesAt as string })
  else if (v.opensAt !== null || v.closesAt !== null) throw invalid()
  return { churchId, occurrenceId, revision: v.revision as number, configured: v.configured, opensAt: v.opensAt as string | null, closesAt: v.closesAt as string | null }
}
export async function readWindow(churchId: string, occurrenceId: string, signal?: AbortSignal, client: ApiClient = api) {
  return parseWindow(await client.request<unknown>(path(churchId, occurrenceId), { signal }), churchId, occurrenceId)
}
export async function writeWindow(churchId: string, occurrenceId: string, before: WindowView, occurrence: Occurrence, input: WindowDates | null, signal?: AbortSignal, client: ApiClient = api) {
  const target = path(churchId, occurrenceId); parseWindow(before, churchId, occurrenceId)
  if (occurrence.id !== occurrenceId || occurrence.churchId !== churchId || occurrence.revision !== before.revision) throw new Error('A ocorrência mudou. Recarregue antes de configurar a janela.')
  const body = input === null ? null : validateWindow(input)
  if (body && (occurrence.participationMode !== 'REGISTRATION_REQUIRED' || instantNanos(body.closesAt) > instantNanos(occurrence.startsAt))) throw new Error('A janela exige modo com inscrição e fechamento até o início da ocorrência.')
  const expected: WindowView = { ...before, configured: body !== null, opensAt: body?.opensAt ?? null, closesAt: body?.closesAt ?? null }
  const result = parseWindow(await client.request<unknown>(target, { method: body ? 'PUT' : 'DELETE', headers: { 'X-Expected-Revision': String(before.revision), ...(body && { 'Content-Type': 'application/json' }) }, ...(body && { body: JSON.stringify(body) }), signal }), churchId, occurrenceId)
  if (!sameWindow(result, expected) || result.revision !== before.revision + (sameWindow(before, expected) ? 0 : 1)) throw new Error('Não foi possível confirmar a janela. Consulte os dados antes de tentar novamente.')
  return result
}
