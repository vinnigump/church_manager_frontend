import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
import { transitionOccurrence } from './lifecycle-api'
import type { Occurrence } from './occurrence-api'

const church = '00000000-0000-0000-0000-000000000001'
const id = '00000000-0000-0000-0000-000000000002'
const other = '00000000-0000-0000-0000-000000000003'
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const occurrence: Occurrence = { id, churchId: church, eventTypeId: other, eventTypeVersionId: null, recurrenceRuleId: null, startsAt: '2032-01-01T13:00:00Z', endsAt: '2032-01-01T14:00:00Z', capacity: null, status: 'DRAFT', modality: 'ONLINE', participationMode: 'OPEN_EVENT', checkInRequired: false, firstPublishedAt: null, configured: true, revision: 7 }
const result = { id, status: 'PUBLISHED', revision: 8, preventive: false, moderate: false, unresolved: false }
const json = (v: unknown) => new Response(JSON.stringify(v))
const route = `/eventos/igrejas/${church}/ocorrencias/${id}/transicoes/publish`
function backend(handler?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined, permissions = ['EVENT_VIEW', 'EVENT_PUBLISH']) {
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init); if (custom !== undefined) return custom
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-PUBLICATION-CSRF', token: 'fixture' })
    if (url.includes('/authorization?')) return json({ allowed: permissions.includes(new URL(url, 'https://example.test').searchParams.get('permissionCode') ?? '') })
    if (url.endsWith(`/occurrences/${id}`)) return json(occurrence)
    if (url.endsWith('/publish')) return json(result)
    throw new Error('Unexpected fixture request')
  }); vi.stubGlobal('fetch', fetcher); return fetcher
}
function show(path = route) { return render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>) }
const writes = (fetcher: ReturnType<typeof backend>) => fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')
afterEach(() => api.clear())

describe('publicação 1.1.0 com gate de equipe no servidor', () => {
  it.each([{ status: 'PUBLISHED', revision: 8 }, { status: 'IN_PROGRESS', revision: 9 }, { status: 'COMPLETED', revision: 9 }])('confirma estado/revisão reconciliados %j sem inventar contexto do DTO', async patch => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue({ ...result, ...patch, privateUrl: 'private' })
    expect(await transitionOccurrence(church, occurrence, 'publish', undefined, client)).toEqual({ id, churchId: church, ...patch, publication: { preventive: false, moderate: false, unresolved: false } })
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/occurrences/${id}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Expected-Revision': '7' }, body: JSON.stringify({ overrides: [] }), signal: undefined })
  })
  it('república rascunho sem descartar primeiro marco registrado', async () => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(result)
    expect((await transitionOccurrence(church, { ...occurrence, firstPublishedAt: occurrence.startsAt }, 'publish', undefined, client)).status).toBe('PUBLISHED')
  })
  it.each([{}, { ...result, id: other }, { ...result, status: 'DRAFT' }, { ...result, status: 'OPEN' },
    { ...result, status: ['PUBLISHED'], revision: 9 }, { ...result, revision: 7 }, { ...result, revision: 9 },
    { ...result, status: 'IN_PROGRESS', revision: 8 }, { ...result, status: 'COMPLETED', revision: 8 },
    { ...result, preventive: undefined }, { ...result, moderate: 'false' }, { ...result, unresolved: null },
  ])('recusa resposta incompatível %j', async value => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(value)
    await expect(transitionOccurrence(church, occurrence, 'publish', undefined, client)).rejects.toThrow('confirmar')
  })
  it.each(['OPEN', 'CLOSED', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])('não publica/reabre estado %s', async status => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request')
    await expect(transitionOccurrence(church, { ...occurrence, status }, 'publish', undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
  it('não publica configuração ausente', async () => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request')
    await expect(transitionOccurrence(church, { ...occurrence, configured: false }, 'publish', undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
})

describe('ações antigas de publicação retiradas da interface', () => {
  it.each(['publish', 'unpublish'])('rota direta %s orienta cadastro atual sem consultar ou escrever publicação', async action => {
    const fetcher = backend(); show(route.replace('/publish', '/' + action))
    expect(await screen.findByRole('heading', { name: 'Publicação de ocorrências descontinuada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir cadastro atual do evento' })).toHaveAttribute('href', `/eventos/igrejas/${church}/cadastro/${id}`)
    expect(screen.queryByRole('button', { name: /publicar|transição/i })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
    expect(fetcher.mock.calls.some(([url]) => url.includes('/occurrences/'))).toBe(false)
  })
  it('detalhe preserva o histórico sem expor publicar ou despublicar mesmo com permissão legada', async () => {
    backend(); show(route.replace('/transicoes/publish', ''))
    expect(await screen.findByText('Primeira publicação')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^(Publicar|Despublicar) ocorrência$/ })).not.toBeInTheDocument()
  })
  it('contexto inválido permanece bloqueado sem consultar domínio', async () => {
    const fetcher = backend(); show(route.replace(church, 'invalida'))
    expect(await screen.findByRole('alert')).toHaveTextContent('acesso à transição é inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
