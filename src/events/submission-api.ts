import { api, type ApiClient } from '../api'
import { isInstant, isUuid } from '../validation'
import { brasilInstant } from '../time'
import { instantNanos } from './occurrence-api'
import { parseRecord, validateRecordWrite, type EventRecord, type RecordWrite } from './record-api'
import type { SchedulingFields } from './EventSchedulingOptions'
export interface SchedulingInput { repeat: { frequency: SchedulingFields['frequency']; interval: number; through: string } | null; registrationWindow: { opensAt: string; closesAt: string } | null; visitorRegistration: boolean }
export interface SubmissionResult { recurrenceRuleId: string | null; items: EventRecord[] }
export function schedulingInput(fields: SchedulingFields, event: RecordWrite): SchedulingInput {
  let repeat: SchedulingInput['repeat'] = null
  if (fields.repeats) {
    const interval = Number(fields.interval)
    const start = new Date(Date.parse(event.startsAt) - 3 * 3600000).toISOString().slice(0, 10)
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(fields.frequency) || !/^\d+$/.test(fields.interval) || !Number.isSafeInteger(interval) || interval < 1 || interval > 366 || !/^\d{4}-\d{2}-\d{2}$/.test(fields.through) || fields.through < start || fields.through.slice(0, 4) !== start.slice(0, 4)) throw new Error('Confira frequência, intervalo e término da repetição no mesmo ano.')
    if ((instantNanos(event.endsAt) - instantNanos(event.startsAt)) % 60000000000n !== 0n) throw new Error('A repetição exige duração em minutos inteiros.')
    repeat = { frequency: fields.frequency, interval, through: fields.through }
  }
  let registrationWindow: SchedulingInput['registrationWindow'] = null
  if (event.participationMode === 'REGISTRATION_REQUIRED' && fields.registrationWindow) {
    const opensAt = brasilInstant(fields.opensAt), closesAt = brasilInstant(fields.closesAt)
    if (!isInstant(opensAt) || !isInstant(closesAt) || instantNanos(opensAt) >= instantNanos(closesAt) || instantNanos(closesAt) > instantNanos(event.startsAt)) throw new Error('As inscrições devem abrir antes do fechamento e fechar até o início do evento.')
    registrationWindow = { opensAt, closesAt }
  }
  const a = event.audience
  const compatible = event.participationMode === 'REGISTRATION_REQUIRED' && a.visibility === 'PUBLIC' && !a.churchLinkRequired && !a.activeMembershipRequired && !a.functionIds.length && !a.ministryIds.length && !a.departmentIds.length && (a.maximumAge === null || a.maximumAge >= 18)
  return { repeat, registrationWindow, visitorRegistration: compatible && fields.visitorRegistration }
}
export async function submitRecord(church: string, requestId: string, event: RecordWrite, scheduling: SchedulingInput, signal?: AbortSignal, client: ApiClient = api): Promise<SubmissionResult> {
  if (!isUuid(church) || !isUuid(requestId)) throw new Error('Envio de evento inválido.')
  const raw = await client.request<unknown>(`/events/churches/${church}/records/submissions`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, event: validateRecordWrite(event), ...scheduling }) })
  if (typeof raw !== 'object' || raw === null || !('items' in raw) || !Array.isArray(raw.items) || !raw.items.length || raw.items.length > 366 || !('recurrenceRuleId' in raw) || !(raw.recurrenceRuleId === null || typeof raw.recurrenceRuleId === 'string' && isUuid(raw.recurrenceRuleId))) throw new Error('Confira os eventos antes de repetir este envio.')
  const items = raw.items.map(item => parseRecord(item, church))
  if (new Set(items.map(item => item.id)).size !== items.length || items.some(item => item.recurrenceRuleId !== raw.recurrenceRuleId)) throw new Error('Confira os eventos antes de repetir este envio.')
  return { recurrenceRuleId: raw.recurrenceRuleId, items }
}
