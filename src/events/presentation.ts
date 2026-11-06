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

export function localDate(instant: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant))
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-')
}
export function dateTime(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(instant))
}
