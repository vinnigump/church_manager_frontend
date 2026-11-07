import { api, type ApiClient } from '../api'
import { isUuid } from '../validation'
import type { Occurrence } from './occurrence-api'

// event-lifecycle-v1 1.0.0 / EventLifecycleService + EventPublicationService,
// integrated backend 9e14094. Publication awaits the required team gate (#110).
export type Transition = 'unpublish' | 'cancel' | 'complete'
export const isTransition = (value: string): value is Transition => ['unpublish', 'cancel', 'complete'].includes(value)
export const transitionPermission: Record<Transition, string> = { unpublish: 'EVENT_PUBLISH', cancel: 'EVENT_CANCEL', complete: 'EVENT_EDIT' }
export interface TransitionResult { id: string; churchId: string; status: string; revision: number }
export function canRequestTransition(value: Occurrence, action: Transition) {
  return action === 'unpublish' ? value.status === 'PUBLISHED' : action === 'cancel' ? ['DRAFT', 'PUBLISHED'].includes(value.status)
    : ['PUBLISHED', 'IN_PROGRESS'].includes(value.status)
}
const invalid = () => new Error('Não foi possível confirmar a transição. Atualize e confira a ocorrência.')
export async function transitionOccurrence(churchId: string, before: Occurrence, action: Transition, signal?: AbortSignal, client: ApiClient = api): Promise<TransitionResult> {
  if (!isTransition(action) || !isUuid(churchId) || !isUuid(before.id) || before.churchId !== churchId
    || !Number.isSafeInteger(before.revision) || before.revision < 0) throw invalid()
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
