import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
import { generateAnnualSeries, type GenerationInput } from './generation-api'

const church = '00000000-0000-0000-0000-000000000001'
const type = '00000000-0000-0000-0000-000000000002'
const rule = '00000000-0000-0000-0000-000000000003'
const id = '00000000-0000-0000-0000-000000000004'
const other = '00000000-0000-0000-0000-000000000005'
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const input: GenerationInput = { year: 2032, frequency: 'DAILY', interval: 1, firstStartsAt: '2032-01-01T10:00:00.123456', through: '2032-01-03', durationMinutes: 60, eventTypeId: type, capacity: null, modality: 'ONLINE', participationMode: 'OPEN_EVENT', checkInRequired: false }
const item = { id, sourceOccurrenceId: null, startsAt: '2032-01-01T13:00:00.123456Z', endsAt: '2032-01-01T14:00:00.123456Z', status: 'DRAFT', revision: 0, adjusted: true }
const result = { churchId: church, year: 2032, timezone: 'America/Fortaleza', recurrenceRuleId: rule, items: [item] }
const catalog = { items: [{ id: type, name: 'Encontro', scopeType: 'CHURCH', mandatory: false, enabled: true }], page: 0, size: 20, total: 1 }
const json = (v: unknown) => new Response(JSON.stringify(v))
const route = (churchId = church) => `/eventos/igrejas/${churchId}/planejamento/gerar`
function backend(handler?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined, permissions = ['EVENT_VIEW', 'EVENT_CREATE']) {
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init); if (custom !== undefined) return custom
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-GENERATE-CSRF', token: 'fixture' })
    if (url.includes('/authorization?')) return json({ allowed: permissions.includes(new URL(url, 'https://example.test').searchParams.get('permissionCode') ?? '') })
    if (url.includes('/types?')) return json(catalog)
    if (url.endsWith('/planning/generate') && init.method === 'POST') return json(result)
    throw new Error('Unexpected fixture request')
  }); vi.stubGlobal('fetch', fetcher); return fetcher
}
function SwitchContext() { const navigate = useNavigate(); return <button onClick={() => navigate(route(other))}>Outra igreja</button> }
function show(churchId = church) { return render(<MemoryRouter initialEntries={[route(churchId)]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><SwitchContext/><App/></AuthContext.Provider></MemoryRouter>) }
const writes = (fetcher: ReturnType<typeof backend>) => fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')
async function fill() {
  await screen.findByLabelText('Tipo da série')
  fireEvent.change(screen.getByLabelText('Tipo da série'), { target: { value: type } })
  fireEvent.change(screen.getByLabelText('Ano da série'), { target: { value: '2032' } })
  fireEvent.change(screen.getByLabelText('Frequência'), { target: { value: 'DAILY' } })
  fireEvent.change(screen.getByLabelText('Primeiro início (hora civil da igreja)'), { target: { value: input.firstStartsAt } })
  fireEvent.change(screen.getByLabelText('Última data nominal inclusiva'), { target: { value: input.through } })
  fireEvent.change(screen.getByLabelText('Duração de cada ocorrência (minutos)'), { target: { value: '60' } })
  fireEvent.change(screen.getByLabelText('Modalidade'), { target: { value: 'ONLINE' } })
  fireEvent.change(screen.getByLabelText('Participação'), { target: { value: 'OPEN_EVENT' } })
  fireEvent.change(screen.getByLabelText('Check-in obrigatório'), { target: { value: 'false' } })
}
function confirm() { fireEvent.click(screen.getByRole('button', { name: 'Revisar geração' })); fireEvent.click(screen.getByRole('button', { name: 'Confirmar criação da série' })) }
afterEach(() => api.clear())

describe('geração anual 1.0.0', () => {
  it.each(['DAILY', 'WEEKLY', 'MONTHLY'] as const)('envia %s civil sem converter para fuso do navegador; projeta o resultado', async frequency => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue({ ...result, participants: ['private'], items: [{ ...item, privateUrl: 'private' }] })
    expect(await generateAnnualSeries(church, { ...input, frequency }, undefined, client)).toEqual(result)
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/planning/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, frequency }), signal: undefined })
  })
  it('aceita precisão de minutos acrescentando somente segundos zero', async () => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue({ ...result, items: [{ ...item, startsAt: '2032-01-01T13:00:00Z', endsAt: '2032-01-01T14:00:00Z' }] })
    await generateAnnualSeries(church, { ...input, firstStartsAt: '2032-01-01T10:00' }, undefined, client)
    expect(JSON.parse(String(request.mock.calls[0][1]?.body)).firstStartsAt).toBe('2032-01-01T10:00:00')
  })
  it.each([{ year: 0 }, { year: 10000 }, { frequency: 'YEARLY' }, { interval: 0 }, { interval: 367 },
    { firstStartsAt: '2032-02-30T10:00:00' }, { firstStartsAt: '2032-01-01T10:00:00Z' }, { firstStartsAt: '2032-01-01T10:00:00.1234567' },
    { through: '2031-12-31' }, { through: '2033-01-01' }, { durationMinutes: 0 }, { durationMinutes: 527041 }, { capacity: -1 },
    { capacity: 2147483648 }, { modality: 'REMOTE' }, { participationMode: 'OPEN' }, { checkInRequired: true }, { eventTypeId: 'bad' },
  ])('valida configuração antes de criar %j', async patch => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request')
    await expect(generateAnnualSeries(church, { ...input, ...patch } as GenerationInput, undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
  it.each([{}, { ...result, churchId: other }, { ...result, year: 2033 }, { ...result, timezone: '' }, { ...result, recurrenceRuleId: null },
    { ...result, items: [] }, { ...result, items: [item, item] }, { ...result, items: [{ ...item, sourceOccurrenceId: other }] },
    { ...result, items: [{ ...item, status: 'PUBLISHED' }] }, { ...result, items: [{ ...item, revision: 1 }] },
    { ...result, items: [{ ...item, adjusted: undefined }] }, { ...result, items: [{ ...item, endsAt: item.startsAt }] },
    { ...result, items: [{ ...item, endsAt: '2032-01-01T14:00:00.123457Z' }] },
  ])('não confirma resposta incompatível %j', async value => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(value)
    await expect(generateAnnualSeries(church, input, undefined, client)).rejects.toThrow('confirmar')
  })
})

describe('geração administrativa explícita', () => {
  it('escolhe tipo do catálogo, confirma uma vez com CSRF e apresenta instantes/ajustes reais retornados', async () => {
    const fetcher = backend(); await api.login('ana', 'fixture-password'); show(); await fill()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar geração' }))
    expect(writes(fetcher)).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à configuração' }))
    expect(screen.getByLabelText('Ano da série')).toHaveValue(2032)
    confirm()
    await screen.findByRole('heading', { name: 'Série criada em rascunho' })
    expect(screen.getByText(/fuso America\/Fortaleza/)).toBeInTheDocument()
    expect(screen.getByText(/Data ou horário ajustado pelo servidor/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `Consultar ocorrência ${id}` })).toHaveAttribute('href', `/eventos/igrejas/${church}/ocorrencias/${id}`)
    const call = writes(fetcher)[0][1]
    expect(call.headers.get('X-GENERATE-CSRF')).toBe('fixture')
    expect(JSON.parse(call.body)).toEqual(input)
    expect(writes(fetcher)).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Confirmar criação da série' })).not.toBeInTheDocument()
  })
  it.each([{ permissions: ['EVENT_VIEW'] }, { permissions: ['EVENT_CREATE'] }, { permissions: [] }])('não carrega catálogo nem escreve sem as permissões %j', async ({ permissions }) => {
    const fetcher = backend(undefined, permissions); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
  })
  it('contexto inválido não consulta permissões', async () => {
    const fetcher = backend(); show('bad')
    expect(await screen.findByRole('alert')).toHaveTextContent('acesso à geração é inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('configuração inválida não abre confirmação ou POST', async () => {
    const fetcher = backend(); show(); await fill()
    fireEvent.change(screen.getByLabelText('Check-in obrigatório'), { target: { value: 'true' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Configuração da série anual' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Evento aberto')
    expect(screen.queryByRole('button', { name: 'Confirmar criação da série' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('foco conserva campos mas descarta confirmação; nenhuma escrita implícita', async () => {
    const fetcher = backend(); show(); await fill()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar geração' }))
    fireEvent(window, new Event('focus')); await screen.findByLabelText('Tipo da série')
    expect(screen.getByLabelText('Primeiro início (hora civil da igreja)')).toHaveValue(input.firstStartsAt)
    expect(screen.queryByRole('button', { name: 'Confirmar criação da série' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('clique duplo/foco não liberam outro lote durante a escrita', async () => {
    let finish!: (response: Response) => void
    const fetcher = backend((url, init) => init.method === 'POST' ? new Promise<Response>(done => { finish = done }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await fill()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar geração' })); const button = screen.getByRole('button', { name: 'Confirmar criação da série' })
    fireEvent.click(button); fireEvent.click(button); fireEvent(window, new Event('focus'))
    await screen.findByLabelText('Tipo da série')
    expect(screen.getByRole('button', { name: 'Revisar geração' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => finish(json(result)))
    await screen.findByRole('heading', { name: 'Série criada em rascunho' })
  })
  it.each([403, 404, 409, 422, 500])('erro %s preserva campos e impede replay, inclusive após foco', async status => {
    const fetcher = backend((url, init) => init.method === 'POST' ? new Response(null, { status }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await fill(); confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('reenviar pode duplicar')
    fireEvent(window, new Event('focus')); await screen.findByLabelText('Tipo da série')
    expect(screen.getByLabelText('Ano da série')).toHaveValue(2032)
    expect(screen.getByRole('button', { name: 'Revisar geração' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: 'Configuração da série anual' }))
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('resposta incompatível exige conferência sem sucesso ou retry', async () => {
    const fetcher = backend((url, init) => init.method === 'POST' ? json({ ...result, churchId: other }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await fill(); confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar')
    expect(screen.queryByRole('heading', { name: 'Série criada em rascunho' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('troca de igreja elimina campos e resultado atrasado do contexto anterior', async () => {
    let finish!: (response: Response) => void
    const fetcher = backend((url, init) => init.method === 'POST' ? new Promise<Response>(done => { finish = done }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await fill(); confirm()
    await waitFor(() => expect(writes(fetcher)).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Outra igreja' })); await screen.findByLabelText('Tipo da série')
    await act(async () => finish(json(result)))
    expect(screen.getByLabelText('Ano da série')).toHaveValue(null)
    expect(screen.queryByRole('heading', { name: 'Série criada em rascunho' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar geração' })).toBeEnabled()
  })
})
