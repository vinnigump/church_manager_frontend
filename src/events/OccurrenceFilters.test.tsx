import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
import { listFilteredOccurrences, listOccurrences, occurrenceStatuses, type Occurrence, type OccurrenceFilters } from './occurrence-api'

const church = '00000000-0000-0000-0000-000000000001'
const id = '00000000-0000-0000-0000-000000000002'
const other = '00000000-0000-0000-0000-000000000003'
const value: Occurrence = { id, churchId: church, eventTypeId: other, eventTypeVersionId: null, recurrenceRuleId: null, startsAt: '2026-11-08T08:00:00Z', endsAt: '2026-11-08T12:00:00Z', capacity: null, status: 'DRAFT', modality: 'ONLINE', participationMode: 'OPEN_EVENT', checkInRequired: false, firstPublishedAt: null, configured: true, revision: 7 }
const page = { items: [value], page: 0, size: 20, total: 1 }
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const filters: OccurrenceFilters = { from: '2026-11-08T10:00:00.123456Z', to: '2026-11-08T11:00:00Z', modality: 'ONLINE', status: 'DRAFT' }
const json = (v: unknown) => new Response(JSON.stringify(v))
const base = `/eventos/igrejas/${church}/ocorrencias`
function clientFor(response: unknown) { const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue(response); return { client, request } }
function server(handler?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined, allowed = true) {
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init); if (custom !== undefined) return custom
    if (url.includes('/authorization?')) return json({ allowed: allowed && new URL(url, 'https://example.test').searchParams.get('permissionCode') === 'EVENT_VIEW' })
    if (url.includes('/occurrences?')) { const params = new URL(url, 'https://example.test').searchParams; return json({ ...page, items: [], page: Number(params.get('page')), total: 21 }) }
    throw new Error('Unexpected fixture request')
  }); vi.stubGlobal('fetch', fetcher); return fetcher
}
function SwitchChurch() { const navigate = useNavigate(); return <button onClick={() => navigate(`/eventos/igrejas/${other}/ocorrencias`)}>Outra igreja</button> }
function show() { return render(<MemoryRouter initialEntries={[base]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><SwitchChurch/><App/></AuthContext.Provider></MemoryRouter>) }
const reads = (fetcher: ReturnType<typeof server>) => fetcher.mock.calls.filter(([url]) => url.includes('/occurrences?'))
const lastParams = (fetcher: ReturnType<typeof server>) => new URL(reads(fetcher).at(-1)![0], 'https://example.test').searchParams
async function ready() { await screen.findByText('Página 1 · 21 ocorrências.') }
afterEach(() => api.clear())

describe('filtros de ocorrências 1.1.0', () => {
  it('serializa filtros por AND, preserva microssegundos/offset e projeta resposta sem extras', async () => {
    const { client, request } = clientFor({ ...page, items: [{ ...value, privateUrl: 'private', participants: ['private'] }] })
    expect(await listFilteredOccurrences(church, filters, 0, undefined, client)).toEqual(page)
    const params = new URL(`https://example.test${request.mock.calls[0][0]}`).searchParams
    expect(Object.fromEntries(params)).toEqual({ page: '0', size: '20', ...filters })
    await listFilteredOccurrences(church, { from: '2026-11-08T07:00:00.123456-03:00' }, 0, undefined, client)
    expect(new URL(`https://example.test${request.mock.calls[1][0]}`).searchParams.get('from')).toBe('2026-11-08T07:00:00.123456-03:00')
  })
  it('mantém chamada anterior sem filtros e total global do servidor', async () => {
    const { client, request } = clientFor({ ...page, total: 51 })
    expect((await listOccurrences(church, 0, undefined, client)).total).toBe(51)
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/occurrences?page=0&size=20`, { signal: undefined })
  })
  it.each(occurrenceStatuses)('consulta estado %s sem reinterpretação', async status => {
    const { client } = clientFor({ ...page, items: [{ ...value, status }] })
    expect((await listFilteredOccurrences(church, { status }, 0, undefined, client)).items[0].status).toBe(status)
  })
  it.each(['IN_PERSON', 'ONLINE', 'HYBRID'] as const)('consulta modalidade %s', async modality => {
    const { client } = clientFor({ ...page, items: [{ ...value, modality }] })
    expect((await listFilteredOccurrences(church, { modality }, 0, undefined, client)).items[0].modality).toBe(modality)
  })
  it.each([
    { from: 'bad' }, { to: '2026-02-30T10:00:00Z' }, { from: '2026-11-08T10:00:00.123456001Z' },
    { from: '2026-11-08T10:00:00Z', to: '2026-11-08T10:00:00Z' },
    { from: '2026-11-08T11:00:00Z', to: '2026-11-08T10:00:00Z' }, { modality: 'ALL' }, { status: 'open' }, { status: 'OPEN_EVENT' },
  ])('recusa filtro inválido antes da rede %j', async invalid => {
    const { client, request } = clientFor(page)
    await expect(listFilteredOccurrences(church, invalid as OccurrenceFilters, 0, undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
  it.each([{ endsAt: filters.from }, { startsAt: filters.to }, { modality: 'HYBRID' }, { modality: null, configured: false }, { status: 'PUBLISHED' }, { churchId: other }])('não apresenta resultado fora dos filtros/contexto %j', async patch => {
    const { client } = clientFor({ ...page, items: [{ ...value, ...patch }] })
    await expect(listFilteredOccurrences(church, filters, 0, undefined, client)).rejects.toThrow()
  })
  it('aceita interseção positiva de um microssegundo e limites independentes', async () => {
    const { client, request } = clientFor({ ...page, items: [{ ...value, endsAt: '2026-11-08T10:00:00.123457Z' }] })
    expect((await listFilteredOccurrences(church, { from: filters.from }, 0, undefined, client)).items).toHaveLength(1)
    request.mockResolvedValue({ ...page, items: [{ ...value, startsAt: '2026-11-08T10:59:59.999999Z' }] })
    expect((await listFilteredOccurrences(church, { to: filters.to }, 0, undefined, client)).items).toHaveLength(1)
  })
  it('não envia contexto ou página inválida', async () => {
    const { client, request } = clientFor(page)
    await expect(listFilteredOccurrences('bad', {}, 0, undefined, client)).rejects.toThrow()
    await expect(listFilteredOccurrences(church, {}, 100001, undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
})

describe('consulta filtrada administrativa', () => {
  it('aplica explicitamente, pagina com filtros, volta à página inicial ao reaplicar e limpa todos os limites', async () => {
    const fetcher = server(); show(); await ready()
    fireEvent.change(screen.getByLabelText('Limite inicial (UTC)'), { target: { value: '2026-11-08T10:00:00.123456' } })
    fireEvent.change(screen.getByLabelText('Limite final exclusivo (UTC)'), { target: { value: '2026-11-08T11:00' } })
    fireEvent.change(screen.getByLabelText('Modalidade do filtro'), { target: { value: 'ONLINE' } })
    fireEvent.change(screen.getByLabelText('Estado do filtro'), { target: { value: 'DRAFT' } })
    expect(reads(fetcher)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' })); await ready()
    expect(Object.fromEntries(lastParams(fetcher))).toEqual({ page: '0', size: '20', ...filters })
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Página 2 · 21 ocorrências.')
    expect(lastParams(fetcher).get('from')).toBe(filters.from)
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' })); await ready()
    expect(lastParams(fetcher).get('page')).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' })); await ready()
    expect(Object.fromEntries(lastParams(fetcher))).toEqual({ page: '0', size: '20' })
    expect(screen.getByLabelText('Limite inicial (UTC)')).toHaveValue('')
  })
  it('intervalo invertido não altera a consulta aplicada', async () => {
    const fetcher = server(); show(); await ready()
    fireEvent.change(screen.getByLabelText('Limite inicial (UTC)'), { target: { value: '2026-11-09T10:00' } })
    fireEvent.change(screen.getByLabelText('Limite final exclusivo (UTC)'), { target: { value: '2026-11-08T11:00' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Filtros das ocorrências' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('término posterior')
    expect(reads(fetcher)).toHaveLength(1)
    expect(screen.getByText('Página 1 · 21 ocorrências.')).toBeInTheDocument()
  })
  it('foco conserva filtros aplicados, paginação e campos ainda não aplicados', async () => {
    const fetcher = server(); show(); await ready()
    fireEvent.change(screen.getByLabelText('Estado do filtro'), { target: { value: 'OPEN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' })); await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' })); await screen.findByText('Página 2 · 21 ocorrências.')
    fireEvent.change(screen.getByLabelText('Estado do filtro'), { target: { value: 'CLOSED' } })
    fireEvent(window, new Event('focus')); await screen.findByText('Página 2 · 21 ocorrências.')
    expect(screen.getByLabelText('Estado do filtro')).toHaveValue('CLOSED')
    expect(lastParams(fetcher).get('status')).toBe('OPEN')
    expect(lastParams(fetcher).get('page')).toBe('1')
  })
  it('sem EVENT_VIEW não expõe filtros nem consulta ocorrências', async () => {
    const fetcher = server(undefined, false); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByLabelText('Estado do filtro')).not.toBeInTheDocument()
    expect(reads(fetcher)).toHaveLength(0)
  })
  it('outra igreja limpa filtros e não apresenta resultado anterior', async () => {
    const fetcher = server(); show(); await ready()
    fireEvent.change(screen.getByLabelText('Estado do filtro'), { target: { value: 'OPEN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' })); await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Outra igreja' })); await ready()
    expect(reads(fetcher).at(-1)![0]).toContain(`/churches/${other}/`)
    expect(lastParams(fetcher).get('status')).toBeNull()
    expect(screen.getByLabelText('Estado do filtro')).toHaveValue('')
  })
  it('resposta antiga atrasada não substitui resultado de filtros novos', async () => {
    let resolve!: (response: Response) => void
    const fetcher = server(url => url.includes('/occurrences?') && new URL(url, 'https://example.test').searchParams.get('status') === 'OPEN'
      ? new Promise<Response>(done => { resolve = done }) : undefined)
    show(); await ready()
    fireEvent.change(screen.getByLabelText('Estado do filtro'), { target: { value: 'OPEN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(lastParams(fetcher).get('status')).toBe('OPEN'))
    fireEvent.change(screen.getByLabelText('Estado do filtro'), { target: { value: 'CLOSED' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' })); await ready()
    await act(async () => resolve(json({ ...page, items: [{ ...value, status: 'OPEN' }] })))
    expect(screen.queryByRole('link', { name: `Consultar ocorrência ${id}` })).not.toBeInTheDocument()
    expect(screen.getByText(/Filtros aplicados:/)).toHaveTextContent('estado CLOSED')
  })
  it('erro do servidor não vira lista vazia nem total zero', async () => {
    server(url => url.includes('/occurrences?') ? new Response(null, { status: 403 }) : undefined); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('permissão')
    expect(screen.queryByText(/0 ocorrências/)).not.toBeInTheDocument()
  })
})
