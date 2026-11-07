// Modelos internos de apresentação. Não representam DTOs ou contratos HTTP.
export type ViewState<T> =
  | { kind: 'unavailable' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; items: readonly T[] }

export interface ChurchContext { id: string; name: string }
export interface CatalogItem {
  id: string
  churchId: string
  title: string
  origin: 'denomination' | 'local'
  status: 'draft' | 'published' | 'discontinued'
}
export interface AgendaItem {
  id: string
  churchId: string
  title: string
  startsAt: string
  endsAt: string
  status: 'draft' | 'published' | 'inProgress' | 'completed' | 'cancelled'
  participation: 'open' | 'registration'
  checkInEnabled: boolean
}

// Validação defensiva da apresentação, sem substituir o futuro adaptador HTTP.
export function canDisplayAgenda(items: readonly AgendaItem[], timeZone: string) {
  try { new Intl.DateTimeFormat('pt-BR', { timeZone }).format(0) }
  catch { return false }
  const validInstant = (value: string) => {
    if (typeof value !== 'string') return false
    const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value)
    if (!match || !Number.isFinite(Date.parse(value))) return false
    const calendarDate = new Date(`${match[1]}T00:00:00Z`)
    return Number.isFinite(calendarDate.getTime()) && calendarDate.toISOString().slice(0, 10) === match[1]
  }
  return items.every(item => validInstant(item.startsAt) && validInstant(item.endsAt)
    && Date.parse(item.endsAt) > Date.parse(item.startsAt))
}

export function localDate(instant: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant))
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-')
}
export function dateTime(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(instant))
}
