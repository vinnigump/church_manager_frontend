export class ApiError extends Error {
  constructor(public status: number) {
    super(({ 0: 'Não foi possível conectar. Tente novamente.', 401: 'Sessão expirada ou credenciais inválidas. Entre novamente.', 403: 'Você não tem permissão ou a proteção da sessão expirou.', 404: 'Recurso não encontrado.', 409: 'Os dados foram alterados. Atualize e tente novamente.', 422: 'Revise os dados informados.' } as Record<number, string>)[status] ?? 'Não foi possível concluir a solicitação.')
  }
}

export interface Account { id: string; personId: string; login: string; status: string }
interface Csrf { headerName: string; token: string }

export class ApiClient {
  private authorization?: string
  private csrf?: Csrf
  private generation = 0
  onUnauthorized?: () => void
  constructor(private base = import.meta.env.VITE_API_BASE_URL || '/api/v1') {
    if (!base.startsWith('/') || base.startsWith('//')) throw new Error('A API deve usar a mesma origem.')
  }
  clear() { this.generation++; this.authorization = undefined; this.csrf = undefined }
  async login(login: string, password: string): Promise<Account> {
    this.clear()
    const generation = this.generation
    if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) throw new Error('A autenticação exige HTTPS.')
    const bytes = new TextEncoder().encode(`${login}:${password}`)
    this.authorization = `Basic ${btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))}`
    try {
      const account = await this.request<Account>('/accounts/me')
      this.csrf = await this.request<Csrf>('/csrf')
      return account
    } catch (error) { if (generation === this.generation) this.clear(); throw error }
  }
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('..')) throw new Error('Caminho inválido.')
    const generation = this.generation
    const headers = new Headers(init.headers)
    if (this.authorization) headers.set('Authorization', this.authorization)
    if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method || 'GET').toUpperCase())) {
      if (!this.csrf) throw new ApiError(403)
      headers.set(this.csrf.headerName, this.csrf.token)
    }
    let response: Response
    try { response = await fetch(`${this.base}${path}`, { ...init, headers, credentials: 'same-origin', cache: 'no-store', redirect: 'error' }) }
    catch { throw new ApiError(0) }
    if (generation !== this.generation) throw new Error('Solicitação de uma sessão encerrada.')
    if (!response.ok) {
      if (response.status === 401) { this.clear(); this.onUnauthorized?.() }
      throw new ApiError(response.status)
    }
    const result = response.status === 204 ? undefined : await response.json()
    if (generation !== this.generation) throw new Error('Solicitação de uma sessão encerrada.')
    return result as T
  }
}
export const api = new ApiClient()
