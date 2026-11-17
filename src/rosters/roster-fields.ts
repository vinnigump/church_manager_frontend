import { wallTime } from '../events/record-form'
import { BRAZIL_OFFSET } from '../time'
import { validateRoster, type AccountOption, type Roster, type RosterWrite, type Unit } from './roster-api'
export const offsetOptions: string[] = [BRAZIL_OFFSET]
export interface Fields { unit: Unit | null; accounts: AccountOption[]; startsAt: string; endsAt: string; offset: string; eventEnabled: boolean; eventId: string; eventName: string; eventResolved?: boolean; eventStartsAt?: string; eventEndsAt?: string }
export function fieldsFor(v: Roster | null): Fields {
  const offset = BRAZIL_OFFSET
  return { unit: v ? { id: v.departmentId ?? v.ministryId, kind: v.departmentId ? 'DEPARTMENT' : 'MINISTRY', ministryId: v.ministryId,
    name: v.departmentName ?? v.ministryName, ministryName: v.ministryName } : null, accounts: v?.participants.map(p => ({ accountId: p.accountId, displayName: p.displayName })) ?? [],
    startsAt: v ? wallTime(v.startsAt, offset) : '', endsAt: v ? wallTime(v.endsAt, offset) : '', offset,
    eventResolved: !v?.eventId, eventEnabled: Boolean(v?.eventId), eventId: v?.eventId ?? '', eventName: v?.eventName ?? '', eventStartsAt: v?.eventId ? v.startsAt : undefined, eventEndsAt: v?.eventId ? v.endsAt : undefined }
}
export function writeFor(fields: Fields, before: Roster | null): RosterWrite {
  if (fields.eventEnabled && !fields.eventResolved) throw new Error('Aguarde a confirmação do período do evento ou escolha o evento novamente.')
  if (!fields.unit || fields.offset !== BRAZIL_OFFSET || !fields.startsAt || !fields.endsAt || fields.eventEnabled && !fields.eventId) throw new Error('Selecione unidade, datas e evento quando vinculado.')
  const date = (value: string, original?: string) => original && value === wallTime(original, fields.offset) ? original : `${value.length === 16 ? `${value}:00` : value}${fields.offset}`
  return validateRoster({ ministryId: fields.unit.ministryId, departmentId: fields.unit.kind === 'DEPARTMENT' ? fields.unit.id : null,
    eventId: fields.eventEnabled ? fields.eventId : null, startsAt: fields.eventEnabled && fields.eventStartsAt ? fields.eventStartsAt : date(fields.startsAt, before?.startsAt), endsAt: fields.eventEnabled && fields.eventEndsAt ? fields.eventEndsAt : date(fields.endsAt, before?.endsAt), accountIds: fields.accounts.map(v => v.accountId) })
}
