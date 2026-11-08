import { api, type ApiClient } from '../api'
import { isUuid } from '../validation'
import type { Occurrence } from './occurrence-api'

// event-lifecycle-v1 1.1.0, integrated backend0843021 includes the team gate.
export type Transition = 'publish' | 'unpublish' | 'cancel' | 'complete'
export const isTransition = (value: string): value is Transition => ['publish', 'unpublish', 'cancel', 'complete'].includes(value)
export const transitionPermission: Record<Transition, string> = { publish: 'EVENT_PUBLISH', unpublish: 'EVENT_PUBLISH', cancel: 'EVENT_CANCEL', complete: 'EVENT_EDIT' }
export interface TransitionResult { id: string; churchId: string; status: string; revision: number; publication?: { preventive: boolean; moderate: boolean; unresolved: boolean } }
export function canRequestTransition(value: Occurrence, action: Transition) {
  if (action === 'publish') return value.status === 'DRAFT' && value.configured
  return action === 'unpublish' ? value.status === 'PUBLISHED' : action === 'cancel' ? ['DRAFT', 'PUBLISHED'].includes(value.status)
    : ['PUBLISHED', 'IN_PROGRESS'].includes(value.status)
}
const invalid = () => new Error('Não foi possível confirmar a transição. Atualize e confira a ocorrência.')
export async function transitionOccurrence(churchId: string, before: Occurrence, action: Transition, signal?: AbortSignal, client: ApiClient = api): Promise<TransitionResult> {
  if (!isTransition(action) || !isUuid(churchId) || !isUuid(before.id) || before.churchId !== churchId
    || !Number.isSafeInteger(before.revision) || before.revision < 0) throw invalid()
  if (action === 'publish') {
    if (!canRequestTransition(before, action)) throw invalid()
    const value = await client.request<unknown>(`/events/churches/${churchId}/occurrences/${before.id}/publish`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Expected-Revision': String(before.revision) }, body: JSON.stringify({ overrides: [] }), signal,
    })
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalid()
    const v = value as Record<string, unknown>
    if (v.id !== before.id || typeof v.status !== 'string' || !['PUBLISHED', 'IN_PROGRESS', 'COMPLETED'].includes(v.status) || !Number.isSafeInteger(v.revision)
      || v.revision !== before.revision + (v.status === 'PUBLISHED' ? 1 : 2)
      || typeof v.preventive !== 'boolean' || typeof v.moderate !== 'boolean' || typeof v.unresolved !== 'boolean') throw invalid()
    // Publish's DTO has no churchId; context comes from the validated scoped
    // request/snapshot and globally unique occurrence ID, never from extras.
    return { id: before.id, churchId, status: v.status as string, revision: v.revision as number,
      publication: { preventive: v.preventive, moderate: v.moderate, unresolved: v.unresolved } }
  }
  const target = { unpublish: 'DRAFT', cancel: 'CANCELLED', complete: 'COMPLETED' }[action]
  // The server supports an unchanged response for an already achieved target.
  if (!canRequestTransition(before, action) && before.status !== target) throw invalid()
  const value = await client.request<unknown>(`/events/churches/${churchId}/occurrences/${before.id}/${action}`, {
    method: 'POST', headers: { 'X-Expected-Revision': String(before.revision) }, signal,
  })
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalid()
  const v = value as Record<string, unknown>
  const increments = before.status === target ? [0] : action === 'complete' && before.status === 'PUBLISHED' ? [1, 2] : [1]
  if (v.id !== before.id || v.churchId !== churchId || v.status !== target || !Number.isSafeInteger(v.revision)
    || !increments.some(n => v.revision === before.revision + n)) throw invalid()
  return { id: before.id, churchId, status: target, revision: v.revision as number }
}
