import { api, type ApiClient } from '../api'

// Contrato backend event-type-catalog-v1.openapi.json, versão 1.0.0 (EVT-005).
export interface EventTypeView {
  id: string
  scopeType: 'DENOMINATION' | 'CHURCH'
  name: string
  mandatory: boolean
  enabled: boolean
}
export interface EventTypePage { items: EventTypeView[]; page: number; size: number; total: number }
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function parseEventType(item: unknown): EventTypeView {
  if (!record(item) || typeof item.id !== 'string' || !isUuid(item.id) || typeof item.name !== 'string'
    || !['DENOMINATION', 'CHURCH'].includes(String(item.scopeType))
    || typeof item.mandatory !== 'boolean' || typeof item.enabled !== 'boolean') throw new Error('Não foi possível validar os dados do catálogo.')
  return { id: item.id, scopeType: item.scopeType as EventTypeView['scopeType'], name: item.name, mandatory: item.mandatory, enabled: item.enabled }
}

export async function createLocalType(churchId: string, name: string, signal?: AbortSignal, client: ApiClient = api) {
  if (!isUuid(churchId) || !name.trim() || name.trim().length > 180) throw new Error('Informe um nome de até 180 caracteres.')
  const result = parseEventType(await client.request<unknown>(`/events/churches/${churchId}/types`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }), signal,
  }))
  if (result.scopeType !== 'CHURCH' || result.mandatory || !result.enabled) throw new Error('Não foi possível confirmar a criação local.')
  return result
}

export async function setLocalTypeEnabled(churchId: string, type: EventTypeView, enabled: boolean, signal?: AbortSignal, client: ApiClient = api) {
  if (!isUuid(churchId) || !isUuid(type.id) || type.scopeType !== 'CHURCH' || type.mandatory) throw new Error('Somente tipos locais não obrigatórios podem ser alterados.')
  const result = parseEventType(await client.request<unknown>(`/events/churches/${churchId}/types/${type.id}/enabled`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }), signal,
  }))
  if (result.id !== type.id || result.scopeType !== 'CHURCH' || result.mandatory || result.enabled !== enabled) throw new Error('Não foi possível confirmar a alteração local.')
  return result
}

export async function listChurchCatalog(churchId: string, page = 0, signal?: AbortSignal, client: ApiClient = api): Promise<EventTypePage> {
  if (!isUuid(churchId) || !Number.isSafeInteger(page) || page < 0 || page > 100000) throw new Error('Contexto de catálogo inválido.')
  const size = 20
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  const result = await client.request<unknown>(`/events/churches/${churchId}/types?${params}`, { signal })
  const invalid = () => new Error('Não foi possível validar os dados do catálogo.')
  if (!record(result) || !Array.isArray(result.items) || result.page !== page || result.size !== size
    || !Number.isSafeInteger(result.total) || (result.total as number) < 0
    || result.items.length > size || (result.total as number) < result.items.length) throw invalid()
  const items = result.items.map(parseEventType)
  if (new Set(items.map(item => item.id)).size !== items.length) throw invalid()
  return { items, page, size, total: result.total as number }
}
