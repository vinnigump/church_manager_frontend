import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../api'
import { instantNanos, listOccurrences, parseOccurrence, readOccurrence, saveOccurrence, validateOccurrenceWrite, type Occurrence, type OccurrenceWrite } from './occurrence-api'

const church = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const id = '00000000-0000-0000-0000-000000000003'
const type = '00000000-0000-0000-0000-000000000004'
const version = '00000000-0000-0000-0000-000000000005'
const input: OccurrenceWrite = { eventTypeId: type, startsAt: '2026-11-08T10:00:00.123456Z', endsAt: '2026-11-08T11:00:00Z', capacity: null, modality: 'HYBRID', participationMode: 'REGISTRATION_REQUIRED', checkInRequired: false }
const value: Occurrence = { ...input, id, churchId: church, eventTypeVersionId: version, recurrenceRuleId: null, status: 'DRAFT', firstPublishedAt: null, revision: 4, configured: true }
const page = { items: [value], page: 0, size: 20, total: 1 }
function clientFor(response: unknown) { const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue(response); return { client, request } }

describe('contrato administrativo de ocorrências 1.0.0', () => {
  it('consulta página no contexto e projeta somente o contrato, sem links/participantes', async () => {
    const { client, request } = clientFor({ ...page, items: [{ ...value, onlineUrl: 'private', participants: ['private'] }] })
    expect(await listOccurrences(church, 0, undefined, client)).toEqual(page)
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/occurrences?page=0&size=20`, { signal: undefined })
  })
  it.each([{}, { ...page, page: 1 }, { ...page, size: 100 }, { ...page, total: -1 }, { ...page, items: [value, value], total: 2 },
    { ...page, items: [{ ...value, churchId: other }] }, { ...page, items: [{ ...value, configured: false }] },
    { ...page, items: [{ ...value, id: 'bad' }] }, { ...page, items: [{ ...value, revision: Number.MAX_SAFE_INTEGER + 1 }] },
    { ...page, items: [{ ...value, startsAt: '2026-02-30T10:00:00Z' }] }, { ...page, items: [{ ...value, modality: 'VIRTUAL' }] },
    { ...page, items: [{ ...value, checkInRequired: 'false' }] }, { ...page, items: [{ ...value, eventTypeVersionId: undefined }] },
  ])('rejeita página incompatível sem normalizar %j', async response => {
    await expect(listOccurrences(church, 0, undefined, clientFor(response).client)).rejects.toThrow()
  })
  it('preserva legado e configuração parcial, sem converter OPEN ou exigir invariantes de escrita na leitura', () => {
    const legacy = { ...value, status: 'OPEN', configured: false, modality: null, participationMode: null, capacity: -1, firstPublishedAt: null }
    expect(parseOccurrence(legacy, church)).toEqual(legacy)
  })
  it('rejeita ID de detalhe divergente e parâmetros inválidos antes da rede', async () => {
    const { client, request } = clientFor(value)
    await expect(listOccurrences('../escape', 0, undefined, client)).rejects.toThrow()
    await expect(listOccurrences(church, 100001, undefined, client)).rejects.toThrow()
    await expect(readOccurrence(church, 'bad', undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
    await expect(readOccurrence(church, other, undefined, client)).rejects.toThrow()
  })
  it('compara instantes sem perder microssegundos e aceita offsets equivalentes', () => {
    expect(instantNanos(input.startsAt)).toBe(instantNanos('2026-11-08T07:00:00.123456-03:00'))
    expect(instantNanos(input.startsAt) - instantNanos('2026-11-08T10:00:00.123455Z')).toBe(1000n)
    expect(validateOccurrenceWrite({ ...input, endsAt: '2026-11-08T10:00:00.123457Z' })).toBeDefined()
  })
  it.each([
    { capacity: -1 }, { capacity: 2147483648 }, { capacity: 1.5 }, { startsAt: '2026-11-08T10:00:00.1234567Z' },
    { endsAt: input.startsAt }, { endsAt: '2026-11-08T09:00:00Z' }, { modality: null }, { checkInRequired: null },
    { participationMode: 'OPEN_EVENT', checkInRequired: true }, { eventTypeId: 'bad' },
  ])('bloqueia configuração de escrita inválida %j', async patch => {
    const { client, request } = clientFor(value)
    await expect(saveOccurrence(church, { ...input, ...patch } as OccurrenceWrite, null, undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
  it('POST usa cookie, Basic e CSRF dinâmico; não envia campos de servidor ou extras', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url.endsWith('/csrf') ? { headerName: 'X-REAL-CSRF', token: 'fixture-token' }
      : url.endsWith('/accounts/me') ? { id, personId: other, login: 'ana', status: 'ACTIVE' } : value)))
    vi.stubGlobal('fetch', fetcher)
    const client = new ApiClient()
    await client.login('ana', 'fixture-password')
    await saveOccurrence(church, { ...input, status: 'PUBLISHED', actorId: other } as OccurrenceWrite, null, undefined, client)
    const [url, init] = fetcher.mock.calls[2]
    expect(url).toBe(`/api/v1/events/churches/${church}/occurrences`)
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store' })
    expect(init.headers.get('X-REAL-CSRF')).toBe('fixture-token')
    expect(init.headers.get('Authorization')).toMatch(/^Basic /)
    expect(init.headers.has('X-Expected-Revision')).toBe(false)
    expect(JSON.parse(init.body)).toEqual(input)
  })
  it('PUT envia revisão numérica, preserva versão e aceita no-op sem incremento', async () => {
    const { client, request } = clientFor(value)
    expect(await saveOccurrence(church, input, value, undefined, client)).toEqual(value)
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/occurrences/${id}`, expect.objectContaining({ method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Expected-Revision': '4' } }))
    request.mockResolvedValue({ ...value, capacity: 0, revision: 5 })
    expect((await saveOccurrence(church, { ...input, capacity: 0 }, value, undefined, client)).capacity).toBe(0)
  })
  it.each([{ status: 'PUBLISHED' }, { firstPublishedAt: input.startsAt }, { churchId: other }, { recurrenceRuleId: other, eventTypeId: other }])('bloqueia edição incompatível %j', async patch => {
    const { client, request } = clientFor(value)
    await expect(saveOccurrence(church, input, { ...value, ...patch }, undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
  it.each([{ status: 'PUBLISHED' }, { firstPublishedAt: input.startsAt }, { eventTypeVersionId: other }, { revision: 6 }, { capacity: 1 }, { recurrenceRuleId: other }, { churchId: other }, { id: other }])('não confirma escrita com retorno incompatível %j', async patch => {
    await expect(saveOccurrence(church, input, value, undefined, clientFor({ ...value, ...patch }).client)).rejects.toThrow()
  })
  it('não repete uma escrita após erro', async () => {
    const { client, request } = clientFor(null)
    request.mockRejectedValue(new Error('network'))
    await expect(saveOccurrence(church, input, null, undefined, client)).rejects.toThrow()
    expect(request).toHaveBeenCalledTimes(1)
  })
})
