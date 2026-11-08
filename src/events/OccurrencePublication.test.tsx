import { act, fireEvent, render, screen } from '@testing-library/react'
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
async function confirm() { fireEvent.click(await screen.findByRole('button', { name: 'Publicar ocorrência' })); fireEvent.click(screen.getByRole('button', { name: 'Confirmar transição' })) }
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

describe('confirmação administrativa de publicação', () => {
  it.each([{ status: 'PUBLISHED', revision: 8 }, { status: 'IN_PROGRESS', revision: 9 }, { status: 'COMPLETED', revision: 9 }])('exige confirmação/CSRF e relê estado efetivo %j', async patch => {
    let published = false
    const fetcher = backend((url, init) => {
      if (init.method === 'POST') { published = true; return json({ ...result, ...patch, preventive: true, moderate: true, unresolved: true }) }
      if (url.endsWith(`/occurrences/${id}`)) return json(published ? { ...occurrence, ...patch, firstPublishedAt: occurrence.startsAt } : occurrence)
    }); await api.login('ana', 'fixture-password'); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar ocorrência' }))
    expect(writes(fetcher)).toHaveLength(0)
    expect(screen.getByText(/exatamente um coordenador/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar transição' }))
    expect(await screen.findByText(`Estado registrado: ${patch.status} · Revisão: ${patch.revision}`)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(`Publicação confirmada. Estado confirmado pelo servidor: ${patch.status}`)
    expect(screen.getByRole('status')).toHaveTextContent('Alerta preventivo')
    expect(screen.getByRole('status')).toHaveTextContent('sobreposição moderada')
    expect(screen.getByRole('status')).toHaveTextContent('espaços indefinidos')
    expect(writes(fetcher)).toHaveLength(1)
    const init = writes(fetcher)[0][1]
    expect(init.headers.get('X-PUBLICATION-CSRF')).toBe('fixture')
    expect(init.headers.get('X-Expected-Revision')).toBe('7')
    expect(JSON.parse(init.body)).toEqual({ overrides: [] })
  })
  it.each([{ permissions: ['EVENT_VIEW', 'EVENT_EDIT'] }, { permissions: ['EVENT_PUBLISH'] }])('exige leitura e publicação próprias %j', async ({ permissions }) => {
    const fetcher = backend(undefined, permissions); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
  })
  it('detalhe oferece publicação somente sob permissão própria para rascunho configurado', async () => {
    backend(); show(route.replace('/transicoes/publish', ''))
    expect(await screen.findByRole('link', { name: 'Publicar ocorrência' })).toHaveAttribute('href', route)
  })
  it('rascunho sem configuração orienta completar dados antes de publicar', async () => {
    const fetcher = backend(url => url.endsWith(`/occurrences/${id}`) ? json({ ...occurrence, modality: null, configured: false }) : undefined); show()
    expect(await screen.findByText('A ocorrência precisa de configuração explícita antes da publicação.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar ocorrência' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each([403, 409, 422, 500])('recusa %s não vira sucesso nem retry automático após foco', async status => {
    const fetcher = backend((url, init) => init.method === 'POST' ? new Response(null, { status }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Atualize e confira')
    if (status === 422) expect(screen.getByRole('alert')).toHaveTextContent('coordenação formal ativa')
    expect(screen.queryByText(/Publicação confirmada/)).not.toBeInTheDocument()
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: 'Publicar ocorrência' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('foco invalida confirmação e consulta revisão nova', async () => {
    let revision = 7
    const fetcher = backend(url => url.endsWith(`/occurrences/${id}`) ? json({ ...occurrence, revision }) : undefined); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar ocorrência' }))
    revision = 8; fireEvent(window, new Event('focus')); await screen.findByRole('button', { name: 'Publicar ocorrência' })
    expect(screen.queryByRole('button', { name: 'Confirmar transição' })).not.toBeInTheDocument()
    expect(screen.getByText(/Estado registrado:/)).toHaveTextContent('Revisão: 8')
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('trava de publicação sobrevive a envio duplo e reautorização', async () => {
    let finish!: (response: Response) => void
    const fetcher = backend((url, init) => init.method === 'POST' ? new Promise<Response>(done => { finish = done }) : undefined)
    await api.login('ana', 'fixture-password'); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar ocorrência' }))
    const button = screen.getByRole('button', { name: 'Confirmar transição' }); fireEvent.click(button); fireEvent.click(button)
    fireEvent(window, new Event('focus')); expect(await screen.findByRole('button', { name: 'Publicar ocorrência' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => finish(json(result)))
    await screen.findByText(/Publicação confirmada/)
  })
})
