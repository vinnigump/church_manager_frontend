import type { EventRecord } from './record-api'
import { civilDate } from './agenda-api'
export const recordRoute = (church: string) => `/eventos/igrejas/${church}/cadastro`
export const recordStatusLabel = (status: EventRecord['status']) => ({ DRAFT: 'Rascunho', AVAILABLE: 'Disponível', IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído', CANCELLED: 'Cancelado', PUBLISHED: 'Disponível (cadastro anterior)', OPEN: 'Aberto (cadastro anterior)', CLOSED: 'Fechado (cadastro anterior)' }[status])
export function recordSearch(search: URLSearchParams) {
  const clean = new URLSearchParams(), view = search.get('view'), page = search.get('page')
  if (view && ['week', 'month', 'list'].includes(view)) clean.set('view', view)
  for (const key of ['date', 'day']) if (civilDate(search.get(key))) clean.set(key, search.get(key)!)
  if (page && /^\d+$/.test(page) && Number(page) <= 100000) clean.set('page', page)
  return clean.size ? `?${clean}` : ''
}
