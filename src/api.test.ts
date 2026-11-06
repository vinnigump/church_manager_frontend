import { describe, expect, it, vi } from 'vitest'
import { ApiClient, ApiError } from './api'

describe('HTTP', () => {
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
      url.endsWith('/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' } : { id: '1', personId: '2', login: 'ana', status: 'ACTIVE' }), { status: 200 }))
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
