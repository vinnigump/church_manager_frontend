import { validateAudiencePolicy, type AudiencePolicy } from './audience-api'
import { validateRecordWrite, type EventRecord, type RecordWrite } from './record-api'

export interface RecordFields {
  name: string; location: string; eventTypeId: string; startsAt: string; endsAt: string; offset: string
  capacity: string; modality: string; participationMode: string; checkInRequired: boolean
  visibility: string; churchLinkRequired: boolean; activeMembershipRequired: boolean
  minimumAge: string; maximumAge: string; functionIds: string[]; ministryIds: string[]; departmentIds: string[]
}
export const offsetOptions = ['-05:00', '-04:00', '-03:00', '-02:00', '+00:00']
export function wallTime(instant: string, offset: string): string {
  const sign = offset[0] === '-' ? -1 : 1
  const minutes = sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4)))
  return new Date(Date.parse(instant) + minutes * 60000).toISOString().slice(0, 19)
}
export function fieldsForRecord(v: EventRecord | null): RecordFields {
  return { name: v?.name ?? '', location: v?.location ?? '', eventTypeId: v?.eventTypeId ?? '',
    startsAt: v ? wallTime(v.startsAt, '+00:00') : '', endsAt: v ? wallTime(v.endsAt, '+00:00') : '', offset: v ? '+00:00' : '',
    capacity: v?.capacity == null ? '' : String(v.capacity), modality: v?.modality ?? '', participationMode: v?.participationMode ?? '',
    checkInRequired: v?.checkInRequired ?? false, visibility: v?.audience?.visibility ?? '',
    churchLinkRequired: v?.audience?.churchLinkRequired ?? false, activeMembershipRequired: v?.audience?.activeMembershipRequired ?? false,
    minimumAge: v?.audience?.minimumAge == null ? '' : String(v.audience.minimumAge), maximumAge: v?.audience?.maximumAge == null ? '' : String(v.audience.maximumAge),
    functionIds: v?.audience?.functionIds ?? [], ministryIds: v?.audience?.ministryIds ?? [], departmentIds: v?.audience?.departmentIds ?? [] }
}
export function recordInput(f: RecordFields, draft: boolean, before: EventRecord | null): RecordWrite {
  if (!offsetOptions.includes(f.offset) || !f.startsAt || !f.endsAt) throw new Error('Informe início, término e fuso dos horários.')
  for (const value of [f.capacity, f.minimumAge, f.maximumAge]) if (value !== '' && !/^\d+$/.test(value)) throw new Error('Capacidade e idades devem ser números inteiros positivos ou zero.')
  // Preserve the complete original Instant, including microseconds, if unchanged.
  const instant = (value: string, original?: string) => original && value === wallTime(original, f.offset) ? original
    : `${value.length === 16 ? `${value}:00` : value}${f.offset}`
  const audience = validateAudiencePolicy({ visibility: f.visibility, churchLinkRequired: f.churchLinkRequired,
    activeMembershipRequired: f.activeMembershipRequired, minimumAge: f.minimumAge === '' ? null : Number(f.minimumAge),
    maximumAge: f.maximumAge === '' ? null : Number(f.maximumAge), functionIds: f.functionIds, ministryIds: f.ministryIds, departmentIds: f.departmentIds })
  return validateRecordWrite({ name: f.name, location: f.location, eventTypeId: f.eventTypeId,
    startsAt: instant(f.startsAt, before?.startsAt), endsAt: instant(f.endsAt, before?.endsAt), capacity: f.capacity === '' ? null : Number(f.capacity),
    modality: f.modality as RecordWrite['modality'], participationMode: f.participationMode as RecordWrite['participationMode'],
    checkInRequired: f.checkInRequired, draft, audience })
}
export function changeOffset(fields: RecordFields, next: string): RecordFields {
  if (!fields.offset || !next) return { ...fields, offset: next }
  const convert = (value: string) => value ? wallTime(`${value.length === 16 ? `${value}:00` : value}${fields.offset}`, next) : ''
  return { ...fields, offset: next, startsAt: convert(fields.startsAt), endsAt: convert(fields.endsAt) }
}
export const visibilityLabel: Record<AudiencePolicy['visibility'], string> = {
  PUBLIC: 'Todos', CHURCH: 'Membros da igreja', ELIGIBLE_AUDIENCE: 'Pessoas que atendem aos requisitos',
}
