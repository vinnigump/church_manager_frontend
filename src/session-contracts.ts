import { isUuid } from './validation'

export interface Account { id: string; personId: string; login: string; status: string }
export interface Csrf { headerName: string; token: string }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const invalid = () => new Error('Não foi possível validar os dados da sessão. Entre novamente.')

// identity-v1.openapi.json e AccountController/AccountModels implementados.
export function parseAccount(value: unknown): Account {
  if (!record(value) || typeof value.id !== 'string' || !isUuid(value.id) || typeof value.personId !== 'string' || !isUuid(value.personId)
    || typeof value.login !== 'string' || value.login.length > 254 || typeof value.status !== 'string' || value.status.length > 20) throw invalid()
  return { id: value.id, personId: value.personId, login: value.login, status: value.status }
}
export function parseCsrf(value: unknown): Csrf {
  if (!record(value) || typeof value.headerName !== 'string' || !value.headerName || value.headerName.trim() !== value.headerName
    || typeof value.token !== 'string' || !value.token || value.token.trim() !== value.token
    || ['authorization', 'cookie', 'host', 'content-length', 'origin', 'referer'].includes(value.headerName.toLowerCase())) throw invalid()
  try { new Headers().set(value.headerName, value.token) }
  catch { throw invalid() }
  return { headerName: value.headerName, token: value.token }
}
