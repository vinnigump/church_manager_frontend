import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
import { previewSeries, readSeries, saveSeries, validateSeriesSelections, type SeriesPage as SeriesData, type SeriesPreview } from './series-api'
import type { Occurrence } from './occurrence-api'

const church = '00000000-0000-0000-0000-000000000001'
const id = '00000000-0000-0000-0000-000000000002'
const second = '00000000-0000-0000-0000-000000000003'
const type = '00000000-0000-0000-0000-000000000004'
const series = '00000000-0000-0000-0000-000000000005'
const published = '00000000-0000-0000-0000-000000000006'
const account = { id, personId: second, login: 'ana', status: 'ACTIVE' }
const pattern = { year: 2032, frequency: 'MONTHLY' as const, interval: 1, firstStartsAt: '2032-01-01T13:00:00', through: '2032-03-01', durationMinutes: 60 }
const proposal = { ...pattern, firstStartsAt: '2032-02-01T13:00:00' }
const item: Occurrence = { id, churchId: church, eventTypeId: type, eventTypeVersionId: null, recurrenceRuleId: series, startsAt: '2032-01-01T13:00:00Z', endsAt: '2032-01-01T14:00:00Z', capacity: 10, status: 'DRAFT', modality: 'IN_PERSON', participationMode: 'REGISTRATION_REQUIRED', checkInRequired: false, firstPublishedAt: null, configured: true, revision: 7 }
const other = { ...item, id: second, revision: 8 }
const publicItem = { ...item, id: published, status: 'PUBLISHED', firstPublishedAt: item.startsAt }
const data: SeriesData = { id: series, churchId: church, eventTypeId: type, timezone: 'UTC', rrule: 'FREQ=MONTHLY;INTERVAL=1', active: true, revision: 4, pattern, boundedYear: 2032, items: [item, other, publicItem], page: 0, size: 20, total: 3 }
const slots = [{ index: 0, startsAt: '2032-02-01T13:00:00Z', endsAt: '2032-02-01T14:00:00Z', adjusted: false }, { index: 1, startsAt: '2032-03-01T13:00:00Z', endsAt: '2032-03-01T14:00:00Z', adjusted: true }]
const preview = { id: series, revision: 4, timezone: 'UTC', slots }
const boundPreview: SeriesPreview = { ...preview, pattern: proposal }
const config = { capacity: null, modality: 'ONLINE' as const, participationMode: 'OPEN_EVENT' as const, checkInRequired: false }
const selection = [{ before: item, slotIndex: 1 }]
const result = { id: series, revision: 5, patternChanged: true, items: [{ id, beforeRevision: 7, revision: 8, slotIndex: 1, changed: true }] }
const route = `/eventos/igrejas/${church}/planejamento/series/${series}`
const json = (v: unknown) => new Response(JSON.stringify(v))
function Switch() { const navigate = useNavigate(); return <button onClick={() => navigate(route.replace(series, type))}>Trocar série de teste</button> }
function show(path = route) { return render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><Switch/><App/></AuthContext.Provider></MemoryRouter>) }
function backend(handler?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined, permissions = ['EVENT_VIEW', 'EVENT_EDIT']) {
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init); if (custom !== undefined) return custom
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-SERIES-CSRF', token: 'fixture' })
    if (url.includes('/authorization?')) return json({ allowed: permissions.includes(new URL(url, 'https://example.test').searchParams.get('permissionCode') ?? '') })
    if (url.endsWith('/preview')) return json(preview)
    if (init.method === 'PUT') return json(result)
    if (url.includes(`/planning/series/${series}?`)) return json(data)
    throw new Error('Unexpected fixture request')
  }); vi.stubGlobal('fetch', fetcher); return fetcher
}
const writes = (fetcher: ReturnType<typeof backend>) => fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')
async function configure() {
  await screen.findByText(/Página 1 · 3 ocorrências/)
  fireEvent.change(await screen.findByLabelText('Modalidade'), { target: { value: 'ONLINE' } })
  fireEvent.change(screen.getByLabelText('Participação'), { target: { value: 'OPEN_EVENT' } })
  fireEvent.change(screen.getByLabelText('Check-in obrigatório'), { target: { value: 'false' } })
  fireEvent.change(screen.getByLabelText('Primeiro início civil no fuso da série'), { target: { value: proposal.firstStartsAt } })
}
async function calculate() { fireEvent.click(screen.getByRole('button', { name: 'Calcular prévia sem gravar' })); await screen.findByRole('heading', { name: 'Horários calculados sem gravação' }) }
async function review() {
  fireEvent.click(screen.getByLabelText(`Selecionar ocorrência ${id}`))
  fireEvent.change(screen.getByLabelText(`Destino para ${id}`), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Revisar edição selecionada' }))
  await screen.findByRole('heading', { name: 'Confirmar somente 1 ocorrências' })
}
afterEach(() => api.clear())

describe('contrato de leitura/prévia/edição seletiva', () => {
  it('lê série contextual e projeta somente DTO sem extras', async () => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue({ ...data, privateUrl: 'private' })
    expect(await readSeries(church, series, 0, undefined, client)).toEqual(data)
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/planning/series/${series}?page=0&size=20`, { signal: undefined })
  })
  it('preserva legado sem padrão nem ano demonstrado', async () => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue({ ...data, pattern: null, boundedYear: null })
    expect((await readSeries(church, series, 0, undefined, client)).pattern).toBeNull()
  })
  it.each([{ id: type }, { churchId: type }, { eventTypeId: 'bad' }, { timezone: '' }, { active: 'true' }, { revision: -1 }, { page: 1 }, { size: 10 }, { total: 4 }, { boundedYear: 0 },
    { items: [{ ...item, recurrenceRuleId: type }], total: 1 }, { items: [{ ...item, eventTypeId: series }], total: 1 }, { items: [item, item], total: 2 }, { pattern: undefined }])('recusa leitura incompatível %j', async patch => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue({ ...data, ...patch })
    await expect(readSeries(church, series, 0, undefined, client)).rejects.toThrow()
  })
  it('prévia envia somente padrão sem revisão de escrita e não executa PUT', async () => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue(preview)
    expect(await previewSeries(church, data, proposal, undefined, client)).toEqual(boundPreview)
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/planning/series/${series}/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(proposal), signal: undefined })
  })
  it.each([{ id: type }, { revision: 5 }, { timezone: 'America/Fortaleza' }, { slots: [] }, { slots: [{ ...slots[0], index: 1 }] }, { slots: [{ ...slots[0], adjusted: 'false' }] },
    { slots: [{ ...slots[0], endsAt: slots[0].startsAt }] }, { slots: [slots[0], { ...slots[0], index: 1 }] }])('recusa prévia incompatível %j', async patch => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue({ ...preview, ...patch })
    await expect(previewSeries(church, data, proposal, undefined, client)).rejects.toThrow()
  })
  it('PUT associa IDs aos índices explicitamente e projeta resposta', async () => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue({ ...result, privateUrl: 'private' })
    expect(await saveSeries(church, data, boundPreview, config, selection, undefined, client)).toEqual(result)
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/planning/series/${series}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Expected-Revision': '4' },
      body: JSON.stringify({ pattern: proposal, selections: [{ occurrenceId: id, expectedRevision: 7, slotIndex: 1 }], ...config }), signal: undefined })
  })
  it('no-op conserva revisão da série e ocorrência', async () => {
    const client = new ApiClient(); const unchanged = { id: series, revision: 4, patternChanged: false, items: [{ id, beforeRevision: 7, revision: 7, slotIndex: 0, changed: false }] }
    vi.spyOn(client, 'request').mockResolvedValue(unchanged)
    expect(await saveSeries(church, data, { ...boundPreview, pattern, slots: [{ ...slots[0], startsAt: item.startsAt, endsAt: item.endsAt }] }, { capacity: 10, modality: 'IN_PERSON', participationMode: 'REGISTRATION_REQUIRED', checkInRequired: false }, [{ before: item, slotIndex: 0 }], undefined, client)).toEqual(unchanged)
  })
  it.each([{ selections: [] }, { selections: [selection[0], selection[0]] }, { selections: [selection[0], { before: other, slotIndex: 1 }] },
    { selections: [{ before: publicItem, slotIndex: 0 }] }, { selections: [{ before: { ...item, firstPublishedAt: item.startsAt }, slotIndex: 0 }] },
    { selections: [{ before: item, slotIndex: -1 }] }, { selections: [{ before: item, slotIndex: 2 }] },
  ])('recusa seleção incompatível antes de gravar %j', async ({ selections }) => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request')
    await expect(saveSeries(church, data, boundPreview, config, selections, undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
  it('recusa prévia de revisão antiga', () => {
    expect(() => validateSeriesSelections(church, { ...data, revision: 5 }, boundPreview, selection)).toThrow()
  })
  it('aceita 366 associações explícitas distintas e rejeita 367', () => {
    const entries = Array.from({ length: 366 }, (_, index) => ({ before: { ...item, id: `10000000-0000-0000-0000-${String(index).padStart(12, '0')}` }, slotIndex: index }))
    const proposal = { ...boundPreview, slots: entries.map(entry => ({ ...slots[0], index: entry.slotIndex })) }
    expect(validateSeriesSelections(church, data, proposal, entries)).toHaveLength(366)
    expect(() => validateSeriesSelections(church, data, proposal, [...entries, entries[0]])).toThrow()
  })
  it.each([{ id: type }, { revision: 4 }, { items: [] }, { items: [{ ...result.items[0], id: second }] }, { items: [{ ...result.items[0], beforeRevision: 8 }] },
    { items: [{ ...result.items[0], slotIndex: 0 }] }, { items: [{ ...result.items[0], revision: 9 }] }, { items: [{ ...result.items[0], changed: false, revision: 7 }] },
  ])('recusa confirmação incompatível %j', async patch => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue({ ...result, ...patch })
    await expect(saveSeries(church, data, boundPreview, config, selection, undefined, client)).rejects.toThrow()
  })
})

describe('seleção administrativa com prévia do servidor', () => {
  it('prévia não grava, seleção não é automática e confirmação envia somente uma origem', async () => {
    const fetcher = backend(); await api.login('ana', 'fixture-password'); show(); await configure(); await calculate()
    expect(writes(fetcher)).toHaveLength(0)
    expect(await screen.findByRole('heading', { name: 'Associações explícitas (0)' })).toBeInTheDocument()
    expect(screen.getByLabelText(`Selecionar ocorrência ${published}`)).toBeDisabled()
    await review(); expect(writes(fetcher)).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar edição da seleção' }))
    expect(await screen.findByRole('heading', { name: 'Edição confirmada pelo servidor' })).toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
    const init = writes(fetcher)[0][1]
    expect(init.headers.get('X-SERIES-CSRF')).toBe('fixture')
    expect(init.headers.get('X-Expected-Revision')).toBe('4')
    const body = JSON.parse(init.body)
    expect(body).toEqual({ pattern: proposal, selections: [{ occurrenceId: id, expectedRevision: 7, slotIndex: 1 }], ...config })
    expect(body.selections.some((entry: { occurrenceId: string }) => [second, published].includes(entry.occurrenceId))).toBe(false)
    expect(fetcher.mock.calls.find(([url]) => url.endsWith('/preview'))?.[1].headers.get('X-SERIES-CSRF')).toBe('fixture')
  })
  it('destino faltante ou repetido não chega à confirmação', async () => {
    const fetcher = backend(); await api.login('ana', 'fixture-password'); show(); await configure(); await calculate()
    fireEvent.click(screen.getByLabelText(`Selecionar ocorrência ${id}`))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar edição selecionada' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('associe um horário diferente')
    fireEvent.change(screen.getByLabelText(`Destino para ${id}`), { target: { value: '0' } })
    fireEvent.click(screen.getByLabelText(`Selecionar ocorrência ${second}`))
    fireEvent.change(screen.getByLabelText(`Destino para ${second}`), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar edição selecionada' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('sem repetir destinos')
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('nova proposta descarta prévia/associações e exige novo cálculo', async () => {
    backend(); await api.login('ana', 'fixture-password'); show(); await configure(); await calculate(); await review()
    fireEvent.change(screen.getByLabelText('Intervalo entre repetições'), { target: { value: '2' } })
    expect(screen.queryByRole('heading', { name: 'Horários calculados sem gravação' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar edição da seleção' })).not.toBeInTheDocument()
    expect(screen.getByLabelText(`Destino para ${id}`)).toHaveValue('')
  })
  it('foco preserva campos e seleção, mas descarta confirmação', async () => {
    backend(); await api.login('ana', 'fixture-password'); show(); await configure(); await calculate(); await review()
    fireEvent(window, new Event('focus')); await screen.findByRole('button', { name: 'Revisar edição selecionada' })
    expect(screen.getByLabelText('Primeiro início civil no fuso da série')).toHaveValue(proposal.firstStartsAt)
    expect(screen.getByLabelText(`Destino para ${id}`)).toHaveValue('1')
    expect(screen.queryByRole('button', { name: 'Confirmar edição da seleção' })).not.toBeInTheDocument()
  })
  it('seleções em páginas diferentes conservam revisões e destinos explícitos', async () => {
    const firstPage = [item, ...Array.from({ length: 19 }, (_, index) => ({ ...item, id: `20000000-0000-0000-0000-${String(index).padStart(12, '0')}` }))]
    const fetcher = backend(url => url.includes(`/planning/series/${series}?`) ? json({ ...data, page: url.includes('page=1') ? 1 : 0, items: url.includes('page=1') ? [other] : firstPage, total: 21 }) : undefined)
    await api.login('ana', 'fixture-password'); show()
    await screen.findByText(/Página 1 · 21 ocorrências/)
    fireEvent.change(await screen.findByLabelText('Modalidade'), { target: { value: 'ONLINE' } })
    fireEvent.change(screen.getByLabelText('Participação'), { target: { value: 'OPEN_EVENT' } })
    fireEvent.change(screen.getByLabelText('Check-in obrigatório'), { target: { value: 'false' } })
    fireEvent.change(screen.getByLabelText('Primeiro início civil no fuso da série'), { target: { value: proposal.firstStartsAt } })
    await calculate()
    fireEvent.click(screen.getByLabelText(`Selecionar ocorrência ${id}`))
    fireEvent.change(screen.getByLabelText(`Destino para ${id}`), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    fireEvent.click(await screen.findByLabelText(`Selecionar ocorrência ${second}`))
    fireEvent.change(screen.getByLabelText(`Destino para ${second}`), { target: { value: '0' } })
    expect(screen.getByLabelText(`Destino para ${id}`)).toHaveValue('1')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar edição selecionada' }))
    expect(await screen.findByRole('heading', { name: 'Confirmar somente 2 ocorrências' })).toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('legado exige proposta explícita sem interpretar RRULE', async () => {
    backend(url => url.includes(`/planning/series/${series}?`) ? json({ ...data, pattern: null, boundedYear: null }) : undefined); show()
    expect(await screen.findByText(/Série legada sem parâmetros completos/)).toBeInTheDocument()
    expect(screen.getByLabelText('Ano da proposta')).toHaveValue(null)
    expect(screen.getByLabelText('Frequência')).toHaveValue('')
    expect(screen.getByLabelText('Primeiro início civil no fuso da série')).toHaveValue('')
    expect(screen.queryByRole('heading', { name: 'Horários calculados sem gravação' })).not.toBeInTheDocument()
  })
  it('nova configuração descarta confirmação mas conserva prévia de horários', async () => {
    backend(); await api.login('ana', 'fixture-password'); show(); await configure(); await calculate(); await review()
    fireEvent.change(screen.getByLabelText('Modalidade'), { target: { value: 'HYBRID' } })
    expect(screen.getByRole('heading', { name: 'Horários calculados sem gravação' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar edição da seleção' })).not.toBeInTheDocument()
    expect(screen.getByLabelText(`Destino para ${id}`)).toHaveValue('1')
  })
  it('nova revisão de selecionada bloqueia sem substituir original', async () => {
    let revision = 7
    backend(url => url.includes(`/planning/series/${series}?`) ? json({ ...data, items: [{ ...item, revision }, other, publicItem] }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await configure(); await calculate(); await review()
    revision = 8; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Revisões originais não foram substituídas')
    expect(screen.queryByRole('button', { name: 'Confirmar edição da seleção' })).not.toBeInTheDocument()
    expect(screen.getByText(/Origem .*revisão original/)).toHaveTextContent('original 7')
  })
  it('nova revisão da série bloqueia até descarte explícito', async () => {
    let revision = 4
    backend(url => url.includes(`/planning/series/${series}?`) ? json({ ...data, revision }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await configure(); await calculate(); await review()
    revision = 5; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('A revisão da série mudou')
    expect(screen.getByRole('button', { name: 'Calcular prévia sem gravar' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Descartar proposta e recarregar série' }))
    expect(await screen.findByRole('button', { name: 'Calcular prévia sem gravar' })).toBeEnabled()
    expect(await screen.findByRole('heading', { name: 'Associações explícitas (0)' })).toBeInTheDocument()
  })
  it('EVENT_VIEW permite leitura/prévia mas não edição', async () => {
    const fetcher = backend(undefined, ['EVENT_VIEW']); await api.login('ana', 'fixture-password'); show()
    await screen.findByText(/Página 1 · 3 ocorrências/)
    fireEvent.click(screen.getByRole('button', { name: 'Calcular prévia sem gravar' }))
    expect(await screen.findByRole('heading', { name: 'Horários calculados sem gravação' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revisar edição selecionada' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('EVENT_EDIT sem VIEW não consulta série', async () => {
    const fetcher = backend(undefined, ['EVENT_EDIT']); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
  })
  it.each([403, 409, 422, 500])('erro PUT %s não é sucesso e não repete após foco', async status => {
    const fetcher = backend((url, init) => init.method === 'PUT' ? new Response(null, { status }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await configure(); await calculate(); await review()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar edição da seleção' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('O resultado pode ter sido gravado')
    fireEvent(window, new Event('focus')); await screen.findByRole('button', { name: 'Revisar edição selecionada' })
    expect(writes(fetcher)).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Confirmar edição da seleção' })).not.toBeInTheDocument()
  })
  it('trava de escrita sobrevive a envio duplo e foco', async () => {
    let finish!: (response: Response) => void
    const fetcher = backend((url, init) => init.method === 'PUT' ? new Promise<Response>(done => { finish = done }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await configure(); await calculate(); await review()
    const button = screen.getByRole('button', { name: 'Confirmar edição da seleção' }); fireEvent.click(button); fireEvent.click(button)
    fireEvent(window, new Event('focus')); await screen.findByRole('button', { name: 'Revisar edição selecionada' })
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => finish(json(result)))
    await screen.findByRole('heading', { name: 'Edição confirmada pelo servidor' })
  })
  it('troca de série aborta e descarta escrita antiga', async () => {
    let finish!: (response: Response) => void
    const fetcher = backend((url, init) => {
      if (init.method === 'PUT') return new Promise<Response>(done => { finish = done })
      if (url.includes(`/planning/series/${type}?`)) return json({ ...data, id: type, items: [], total: 0 })
    }); await api.login('ana', 'fixture-password'); show(); await configure(); await calculate(); await review()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar edição da seleção' }))
    await waitFor(() => expect(writes(fetcher)).toHaveLength(1))
    const signal = writes(fetcher)[0][1].signal
    fireEvent.click(screen.getByRole('button', { name: 'Trocar série de teste' }))
    await screen.findByText('Nenhuma ocorrência nesta página da série.')
    expect(signal.aborted).toBe(true)
    await act(async () => finish(json(result)))
    expect(screen.queryByRole('heading', { name: 'Edição confirmada pelo servidor' })).not.toBeInTheDocument()
  })
  it('contexto inválido é rejeitado antes da rede', () => {
    const fetcher = backend(); show(route.replace(series, 'invalid'))
    expect(screen.getByRole('alert')).toHaveTextContent('acesso à série é inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
