import { describe, expect, it, vi } from 'vitest'
import { ApiClient, ApiError } from './api'

describe('HTTP', () => {
  it('não restaura login quando a saída ocorre durante a resposta', async () => {
    let finish!: (response: Response) => void
    const fetcher = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', fetcher)
    const client = new ApiClient()
    const pending = client.login('ana', 'password-test')
    const rejected = expect(pending).rejects.toThrow('sessão encerrada')
    client.clear()
    finish(new Response(JSON.stringify({ id: '1', login: 'ana' })))
    await rejected
    expect(fetcher).toHaveBeenCalledTimes(1)
    await expect(client.request('/people', { method: 'POST' })).rejects.toMatchObject({ status: 403 })
  })
  it('ignora 401 antigo sem invalidar um login mais recente', async () => {
    let finish!: (response: Response) => void
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
      .mockImplementation(async (url: string) => new Response(JSON.stringify(url.endsWith('/csrf')
        ? { headerName: 'X-CSRF-TOKEN', token: 'new-token' }
        : { id: '10000000-0000-0000-0000-000000000003', personId: '10000000-0000-0000-0000-000000000002', login: 'bia', status: 'ACTIVE' })))
    vi.stubGlobal('fetch', fetcher)
    const client = new ApiClient(); client.onUnauthorized = vi.fn()
    const old = client.login('ana', 'old-password')
    const rejected = expect(old).rejects.toThrow('sessão encerrada')
    await client.login('bia', 'new-password')
    finish(new Response(null, { status: 401 }))
    await rejected
    expect(client.onUnauthorized).not.toHaveBeenCalled()
    await client.request('/people', { method: 'POST' })
    const options = fetcher.mock.calls[3][1] as RequestInit
    expect(new Headers(options.headers).get('Authorization')).toBe(`Basic ${btoa('bia:new-password')}`)
    expect(new Headers(options.headers).get('X-CSRF-TOKEN')).toBe('new-token')
  })
  it.each([401, 403, 404, 409, 422, 500])('normaliza erro %s sem exibir conteúdo sensível', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('segredo', { status })))
    await expect(new ApiClient().request('/accounts/me')).rejects.toMatchObject({ status })
    expect(new ApiError(status).message).not.toContain('segredo')
  })
  it('normaliza falha de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')))
    await expect(new ApiClient().request('/accounts/me')).rejects.toMatchObject({ status: 0 })
  })
  it('invalida credenciais ao receber 401', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetcher)
    const client = new ApiClient(); client.onUnauthorized = vi.fn()
    await expect(client.request('/accounts/me')).rejects.toBeInstanceOf(ApiError)
    expect(client.onUnauthorized).toHaveBeenCalledOnce()
  })
  it('bloqueia escrita sem CSRF e origens externas', async () => {
    expect(() => new ApiClient('https://example.org')).toThrow()
    await expect(new ApiClient().request('/people', { method: 'POST' })).rejects.toMatchObject({ status: 403 })
  })
  it('envia Basic e CSRF somente em memória e limpa ao sair', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(
      url.endsWith('/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' } : { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    const client = new ApiClient()
    await client.login('ana', 'password-test')
    await client.request('/people', { method: 'POST' })
    const options = fetcher.mock.calls[2][1] as RequestInit
    expect(new Headers(options.headers).get('Authorization')).toBe(`Basic ${btoa('ana:password-test')}`)
    expect(new Headers(options.headers).get('X-CSRF-TOKEN')).toBe('csrf-test')
    expect(options.credentials).toBe('same-origin')
    client.clear()
    await expect(client.request('/people', { method: 'POST' })).rejects.toMatchObject({ status: 403 })
  })
})
