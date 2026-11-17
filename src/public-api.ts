import { ApiError } from './api'
import { parseCsrf } from './session-contracts'
const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
function url(path: string) {
  if (!base.startsWith('/') || base.startsWith('//') || !path.startsWith('/public/') || path.includes('..')) throw new Error('Caminho público inválido.')
  return base + path
}
async function send(path: string, init: RequestInit, expected?: number): Promise<unknown> {
  let response: Response
  try { response = await fetch(url(path), { ...init, credentials: 'same-origin', cache: 'no-store', redirect: 'error' }) } catch { throw new ApiError(0) }
  if (!response.ok) throw new ApiError(response.status)
  if (expected !== undefined && response.status !== expected) throw new Error('Não foi possível confirmar a operação.')
  try { return response.status === 204 ? undefined : await response.json() } catch { throw new Error('Não foi possível validar a resposta.') }
}
export const publicRead = (path: string, signal: AbortSignal) => send(path, { signal })
/** Separate from authenticated credentials/session callbacks; CSRF is still mandatory. */
export async function publicCommand(path: string, body: unknown, signal: AbortSignal, expectedStatus?: number): Promise<unknown> {
  const csrf = parseCsrf(await publicRead('/public/csrf', signal))
  return send(path, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify(body) }, expectedStatus)
}
