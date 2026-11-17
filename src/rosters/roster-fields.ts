import { wallTime, offsetOptions } from '../events/record-form'
import { validateRoster, type AccountOption, type Roster, type RosterWrite, type Unit } from './roster-api'
export { offsetOptions }
export interface Fields { unit: Unit | null; accounts: AccountOption[]; startsAt: string; endsAt: string; offset: string; eventEnabled: boolean; eventId: string; eventName: string }
export function fieldsFor(v: Roster | null): Fields {
  let offset = '+00:00'
  if (v) {
    const label = new Intl.DateTimeFormat('en-US', { timeZone: v.timeZone, timeZoneName: 'longOffset' }).formatToParts(new Date(v.startsAt)).find(p => p.type === 'timeZoneName')?.value
    if (label && offsetOptions.includes(label.replace('GMT', ''))) offset = label.replace('GMT', '')
  }
  return { unit: v ? { id: v.departmentId ?? v.ministryId, kind: v.departmentId ? 'DEPARTMENT' : 'MINISTRY', ministryId: v.ministryId,
    name: v.departmentName ?? v.ministryName, ministryName: v.ministryName } : null, accounts: v?.participants.map(p => ({ accountId: p.accountId, displayName: p.displayName })) ?? [],
    startsAt: v ? wallTime(v.startsAt, offset) : '', endsAt: v ? wallTime(v.endsAt, offset) : '', offset: v ? offset : '',
    eventEnabled: Boolean(v?.eventId), eventId: v?.eventId ?? '', eventName: v?.eventName ?? '' }
}
export function writeFor(fields: Fields, before: Roster | null): RosterWrite {
  if (!fields.unit || !offsetOptions.includes(fields.offset) || !fields.startsAt || !fields.endsAt || fields.eventEnabled && !fields.eventId) throw new Error('Selecione unidade, datas, fuso e evento quando vinculado.')
  const date = (value: string, original?: string) => original && value === wallTime(original, fields.offset) ? original : `${value.length === 16 ? `${value}:00` : value}${fields.offset}`
  return validateRoster({ ministryId: fields.unit.ministryId, departmentId: fields.unit.kind === 'DEPARTMENT' ? fields.unit.id : null,
    eventId: fields.eventEnabled ? fields.eventId : null, startsAt: date(fields.startsAt, before?.startsAt), endsAt: date(fields.endsAt, before?.endsAt), accountIds: fields.accounts.map(v => v.accountId) })
}
export function withOffset(fields: Fields, offset: string): Fields {
  if (!fields.offset || !offset) return { ...fields, offset }
  const convert = (value: string) => value ? wallTime(`${value.length === 16 ? `${value}:00` : value}${fields.offset}`, offset) : ''
  return { ...fields, offset, startsAt: convert(fields.startsAt), endsAt: convert(fields.endsAt) }
}
