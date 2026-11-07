import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../api'
import { listDenominationCatalog } from './catalog-api'
import { listTemplateHistory, readTemplate } from './template-api'

const denomination = '00000000-0000-0000-0000-000000000001'
const type = '00000000-0000-0000-0000-000000000002'
const version = { id: '00000000-0000-0000-0000-000000000003', number: 1, name: 'Encontro', status: 'PUBLISHED', revision: 1, createdAt: '2026-11-07T12:00:00Z', publishedAt: '2026-11-07T12:30:00Z' }
const template = { id: type, status: 'PUBLISHED', revision: 2, publishedVersionId: version.id, draft: null }
const history = { items: [version], page: 0, size: 20, total: 1 }
function respond(value: unknown) {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(value)))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

describe('consultas reais de templates EVT-005/006', () => {
  it('consulta catálogo denominacional paginado e projeta os campos públicos', async () => {
    const item = { id: type, name: 'Encontro', scopeType: 'DENOMINATION', mandatory: true, enabled: false }
    const fetcher = respond({ items: [{ ...item, secret: 'privado' }], page: 2, size: 20, total: 41 })
    expect(await listDenominationCatalog(denomination, 2)).toEqual({ items: [item], page: 2, size: 20, total: 41 })
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/events/denominations/${denomination}/types?page=2&size=20`)
  })
  it.each(['CHURCH', 'OTHER'])('rejeita origem %s no catálogo denominacional', async scopeType => {
    respond({ items: [{ id: type, name: 'Outro', scopeType, mandatory: true, enabled: true }], page: 0, size: 20, total: 1 })
    await expect(listDenominationCatalog(denomination)).rejects.toThrow('validar')
  })
  it('consulta template com Basic e política de mesma origem sem armazenamento', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url.endsWith('/accounts/me') ? { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' } : url.endsWith('/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'test' } : { ...template, privateUrl: 'segredo' })))
    vi.stubGlobal('fetch', fetcher)
    const client = new ApiClient()
    await client.login('ana', 'test-password')
    expect(await readTemplate(denomination, type, undefined, client)).toEqual(template)
    const [url, init] = fetcher.mock.calls[2]
    expect(url).toBe(`/api/v1/events/denominations/${denomination}/types/${type}`)
    expect(new Headers(init.headers).get('Authorization')).toBe(`Basic ${btoa('ana:test-password')}`)
    expect(init).toMatchObject({ credentials: 'same-origin', cache: 'no-store', redirect: 'error' })
  })
  it('histórico preserva valores e descarta campos não contratados', async () => {
    const fetcher = respond({ ...history, items: [{ ...version, privateUrl: 'segredo' }] })
    expect(await listTemplateHistory(denomination, type)).toEqual(history)
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/events/denominations/${denomination}/types/${type}/versions?page=0&size=20`)
  })
  it.each([
    {}, { ...template, id: denomination }, { ...template, revision: -1 },
    { ...template, status: 'ACTIVE' }, { ...template, publishedVersionId: 'invalid' },
    { ...template, draft: version }, { ...template, draft: { ...version, status: 'DRAFT', publishedAt: null } },
  ])('rejeita template incompatível %j', async value => {
    respond(value)
    await expect(readTemplate(denomination, type)).rejects.toThrow('validar')
  })
  it('aceita template descontinuado com rascunho remanescente sem tratá-lo como publicável', async () => {
    const value = { ...template, status: 'DISCONTINUED', draft: { ...version, id: denomination, number: 2, status: 'DRAFT', publishedAt: null } }
    respond(value)
    expect(await readTemplate(denomination, type)).toEqual(value)
  })
  it.each([
    {}, { ...history, page: 1 }, { ...history, size: 100 }, { ...history, total: -1 },
    { ...history, items: [version, version], total: 2 },
    ...[{ number: 0 }, { status: 'DISCONTINUED' }, { revision: 0.5 }, { createdAt: '2026-02-30T12:00:00Z' }, { publishedAt: null }, { createdAt: '2026-11-07' }].map(change => ({ ...history, items: [{ ...version, ...change }] })),
  ])('rejeita histórico incompatível %j', async value => {
    respond(value)
    await expect(listTemplateHistory(denomination, type)).rejects.toThrow('validar')
  })
  it('aceita timestamps com offset explícito', async () => {
    const value = { ...history, items: [{ ...version, createdAt: '2026-11-07T09:00:00-03:00' }] }
    respond(value)
    expect(await listTemplateHistory(denomination, type)).toEqual(value)
  })
  it('rejeita contextos e páginas inválidos antes da rede', async () => {
    const fetcher = respond(history)
    await expect(readTemplate('../private', type)).rejects.toThrow()
    await expect(readTemplate(denomination, 'invalid')).rejects.toThrow()
    await expect(listTemplateHistory(denomination, type, -1)).rejects.toThrow()
    await expect(listTemplateHistory(denomination, type, 100001)).rejects.toThrow()
    await expect(listDenominationCatalog('invalid')).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })
})
