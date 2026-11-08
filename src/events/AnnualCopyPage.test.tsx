import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
import { copyAnnualDrafts } from './copy-api'
import type { Occurrence } from './occurrence-api'

const church = '00000000-0000-0000-0000-000000000001'
const id = '00000000-0000-0000-0000-000000000002'
const type = '00000000-0000-0000-0000-000000000003'
const destination = '00000000-0000-0000-0000-000000000004'
const other = '00000000-0000-0000-0000-000000000005'
const nextDestination = '00000000-0000-0000-0000-000000000006'
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const source: Occurrence = { id, churchId: church, eventTypeId: type, eventTypeVersionId: null, recurrenceRuleId: null, startsAt: '2032-01-01T13:00:00.123456Z', endsAt: '2032-01-01T14:00:00.123456Z', capacity: null, status: 'DRAFT', modality: 'ONLINE', participationMode: 'OPEN_EVENT', checkInRequired: false, firstPublishedAt: null, configured: true, revision: 7 }
const copied = { id: destination, sourceOccurrenceId: id, startsAt: '2033-01-01T13:00:00.123456Z', endsAt: '2033-01-01T14:00:00.123456Z', status: 'DRAFT', revision: 0, adjusted: false }
const result = { churchId: church, year: 2033, timezone: 'America/Fortaleza', recurrenceRuleId: null, items: [copied] }
const json = (v: unknown) => new Response(JSON.stringify(v))
const route = (churchId = church) => `/eventos/igrejas/${churchId}/planejamento/copiar`
function clientFor(value: unknown) { const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue(value); return { client, request } }
function backend(handler?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined, permissions = ['EVENT_VIEW', 'EVENT_CREATE']) {
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init); if (custom !== undefined) return custom
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-COPY-CSRF', token: 'fixture' })
    if (url.includes('/authorization?')) return json({ allowed: permissions.includes(new URL(url, 'https://example.test').searchParams.get('permissionCode') ?? '') })
    if (url.includes('/occurrences?')) {
      const page = Number(new URL(url, 'https://example.test').searchParams.get('page'))
      return json({ items: [{ ...source, churchId: url.includes(`/churches/${other}/`) ? other : church, id: page ? other : id, revision: page ? 8 : 7 }], page, size: 20, total: 21 })
    }
    if (init.method === 'POST') {
      const body = JSON.parse(String(init.body))
      return json({ ...result, items: body.sources.map((v: { occurrenceId: string }, index: number) => ({ ...copied, id: index ? nextDestination : destination, sourceOccurrenceId: v.occurrenceId })) })
    }
    throw new Error('Unexpected fixture request')
  }); vi.stubGlobal('fetch', fetcher); return fetcher
}
function SwitchContext() { const navigate = useNavigate(); return <button onClick={() => navigate(route(other))}>Outra igreja</button> }
function show(churchId = church) { return render(<MemoryRouter initialEntries={[route(churchId)]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><SwitchContext/><App/></AuthContext.Provider></MemoryRouter>) }
const writes = (fetcher: ReturnType<typeof backend>) => fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')
async function selectFirst() {
  fireEvent.click(await screen.findByRole('checkbox', { name: `Selecionar origem ${id}` }))
  fireEvent.change(screen.getByLabelText('Ano de origem'), { target: { value: '2032' } })
  fireEvent.change(screen.getByLabelText('Ano de destino'), { target: { value: '2033' } })
}
function confirm() { fireEvent.click(screen.getByRole('button', { name: 'Revisar cópia' })); fireEvent.click(screen.getByRole('button', { name: 'Confirmar criação das cópias' })) }
afterEach(() => api.clear())

describe('contrato de cópia anual 1.0.0', () => {
  it('envia somente anos e IDs/revisões selecionados, sem transportar registros/configuração de origem', async () => {
    const { client, request } = clientFor({ ...result, participants: ['private'], items: [{ ...copied, privateUrl: 'private' }] })
    expect(await copyAnnualDrafts(church, 2032, 2033, [source], undefined, client)).toEqual(result)
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/planning/copy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceYear: 2032, targetYear: 2033, sources: [{ occurrenceId: id, expectedRevision: 7 }] }), signal: undefined })
  })
  it('permite DRAFT com marco anterior e legado não configurado sem inventar edição', async () => {
    const { client } = clientFor(result)
    const legacy = { ...source, firstPublishedAt: source.startsAt, configured: false, modality: null, participationMode: null, checkInRequired: null }
    expect(await copyAnnualDrafts(church, 2032, 2033, [legacy], undefined, client)).toEqual(result)
  })
  it.each(['PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OPEN', 'CLOSED'])('não envia origem %s', async status => {
    const { client, request } = clientFor(result)
    await expect(copyAnnualDrafts(church, 2032, 2033, [{ ...source, status }], undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
  it.each([{ sources: [] }, { sources: [source, source] }, { sources: [{ ...source, churchId: other }] }, { sources: [{ ...source, revision: -1 }] }, { sources: [{ ...source, endsAt: source.startsAt }] }])('recusa seleção inválida antes da rede %j', async ({ sources }) => {
    const { client, request } = clientFor(result)
    await expect(copyAnnualDrafts(church, 2032, 2033, sources, undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
  it('aceita até100 origens e rejeita101 sem criar lote', async () => {
    const sources = Array.from({ length: 101 }, (_, n) => ({ ...source, id: `00000000-0000-0000-0001-${String(n).padStart(12, '0')}` }))
    const items = sources.slice(0, 100).map((v, n) => ({ ...copied, id: `00000000-0000-0000-0002-${String(n).padStart(12, '0')}`, sourceOccurrenceId: v.id }))
    const { client, request } = clientFor({ ...result, items })
    expect((await copyAnnualDrafts(church, 2032, 2033, sources.slice(0, 100), undefined, client)).items).toHaveLength(100)
    request.mockClear()
    await expect(copyAnnualDrafts(church, 2032, 2033, sources, undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
  it.each([{}, { ...result, churchId: other }, { ...result, year: 2032 }, { ...result, timezone: '' }, { ...result, recurrenceRuleId: type },
    { ...result, items: [] }, { ...result, items: [copied, copied] }, { ...result, items: [{ ...copied, id }] },
    { ...result, items: [{ ...copied, sourceOccurrenceId: other }] }, { ...result, items: [{ ...copied, sourceOccurrenceId: null }] },
    { ...result, items: [{ ...copied, status: 'PUBLISHED' }] }, { ...result, items: [{ ...copied, revision: 1 }] },
    { ...result, items: [{ ...copied, adjusted: undefined }] }, { ...result, items: [{ ...copied, endsAt: '2033-01-01T14:00:00.123457Z' }] },
  ])('não confirma destino/contexto incompatível %j', async response => {
    const { client } = clientFor(response)
    await expect(copyAnnualDrafts(church, 2032, 2033, [source], undefined, client)).rejects.toThrow('validar')
  })
  it('rejeita anos/contexto inválidos e não altera objetos selecionados', async () => {
    const { client, request } = clientFor(result)
    await expect(copyAnnualDrafts(church, 0, 2033, [source], undefined, client)).rejects.toThrow()
    await expect(copyAnnualDrafts(church, 2032, 10000, [source], undefined, client)).rejects.toThrow()
    await expect(copyAnnualDrafts('bad', 2032, 2033, [source], undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
    const before = JSON.stringify(source)
    await copyAnnualDrafts(church, 2032, 2033, [source], undefined, client)
    expect(JSON.stringify(source)).toBe(before)
  })
  it.each(['id', 'sourceOccurrenceId'] as const)('não confirma duplicação do campo %s em lote com duas origens', async field => {
    const second = { ...source, id: other }
    const item2 = { ...copied, id: nextDestination, sourceOccurrenceId: other, [field]: copied[field] }
    const { client } = clientFor({ ...result, items: [copied, item2] })
    await expect(copyAnnualDrafts(church, 2032, 2033, [source, second], undefined, client)).rejects.toThrow()
  })
})

describe('seleção e confirmação de cópia', () => {
  it('contexto inválido não consulta permissões ou origens', async () => {
    const fetcher = backend(); show('bad')
    expect(await screen.findByRole('alert')).toHaveTextContent('acesso à cópia é inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('conserva seleção entre páginas, revisões e CSRF; cria somente após confirmação', async () => {
    const fetcher = backend(); await api.login('ana', 'fixture-password'); show(); await selectFirst()
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: `Selecionar origem ${other}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar cópia' }))
    expect(writes(fetcher)).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à seleção' }))
    expect(screen.getByRole('heading', { name: '2 origens selecionadas (máximo 100)' })).toBeInTheDocument()
    confirm(); await screen.findByRole('heading', { name: 'Lote de cópias criado em rascunho' })
    expect(writes(fetcher)).toHaveLength(1)
    const init = writes(fetcher)[0][1]
    expect(init.headers.get('X-COPY-CSRF')).toBe('fixture')
    expect(JSON.parse(init.body)).toEqual({ sourceYear: 2032, targetYear: 2033, sources: [{ occurrenceId: id, expectedRevision: 7 }, { occurrenceId: other, expectedRevision: 8 }] })
    expect(screen.getByRole('link', { name: `Consultar cópia ${destination}` })).toHaveAttribute('href', `/eventos/igrejas/${church}/ocorrencias/${destination}`)
    expect(screen.queryByRole('button', { name: 'Confirmar criação das cópias' })).not.toBeInTheDocument()
  })
  it.each([{ permissions: ['EVENT_VIEW'] }, { permissions: ['EVENT_CREATE'] }, { permissions: [] }])('não lê origens nem escreve sem permissões %j', async ({ permissions }) => {
    const fetcher = backend(undefined, permissions); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
  })
  it('estado publicado não é selecionável, mesmo com configuração válida', async () => {
    const fetcher = backend(url => url.includes('/occurrences?') ? json({ items: [{ ...source, status: 'PUBLISHED' }], page: 0, size: 20, total: 1 }) : undefined); show()
    expect(await screen.findByRole('checkbox', { name: `Selecionar origem ${id}` })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Revisar cópia' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('foco preserva seleção/anos mas cancela confirmação', async () => {
    const fetcher = backend(); show(); await selectFirst(); fireEvent.click(screen.getByRole('button', { name: 'Revisar cópia' }))
    fireEvent(window, new Event('focus')); await screen.findByRole('checkbox', { name: `Selecionar origem ${id}` })
    expect(screen.getByRole('checkbox', { name: `Selecionar origem ${id}` })).toBeChecked()
    expect(screen.getByLabelText('Ano de destino')).toHaveValue(2033)
    expect(screen.queryByRole('button', { name: 'Confirmar criação das cópias' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('revisão concorrente não atualiza seleção silenciosamente; exige remoção/reseleção', async () => {
    let revision = 7
    const fetcher = backend(url => url.includes('/occurrences?') ? json({ items: [{ ...source, revision }], page: 0, size: 20, total: 1 }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await selectFirst()
    revision = 8; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('mudou de revisão ou estado')
    expect(screen.getByText(/revisão selecionada 7/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar cópia' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: 'Cópia manual de planejamento' }))
    expect(writes(fetcher)).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: `Remover origem ${id}` }))
    fireEvent.click(screen.getByRole('checkbox', { name: `Selecionar origem ${id}` }))
    confirm(); await screen.findByRole('heading', { name: 'Lote de cópias criado em rascunho' })
    expect(JSON.parse(writes(fetcher)[0][1].body).sources).toEqual([{ occurrenceId: id, expectedRevision: 8 }])
  })
  it('envio duplo/foco mantêm uma só cópia pendente', async () => {
    let finish!: (response: Response) => void
    const fetcher = backend((url, init) => init.method === 'POST' ? new Promise<Response>(done => { finish = done }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await selectFirst(); fireEvent.click(screen.getByRole('button', { name: 'Revisar cópia' }))
    const button = screen.getByRole('button', { name: 'Confirmar criação das cópias' }); fireEvent.click(button); fireEvent.click(button)
    fireEvent(window, new Event('focus')); await screen.findByRole('checkbox', { name: `Selecionar origem ${id}` })
    expect(screen.getByRole('button', { name: 'Revisar cópia' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => finish(json(result)))
    await screen.findByRole('heading', { name: 'Lote de cópias criado em rascunho' })
  })
  it('origem publicada durante seleção bloqueia envio e pode ser removida explicitamente', async () => {
    let status = 'DRAFT'
    const fetcher = backend(url => url.includes('/occurrences?') ? json({ items: [{ ...source, status }], page: 0, size: 20, total: 1 }) : undefined)
    show(); await selectFirst(); status = 'PUBLISHED'; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('mudou de revisão ou estado')
    expect(screen.getByRole('button', { name: 'Revisar cópia' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: `Remover origem ${id}` }))
    expect(screen.getByRole('heading', { name: '0 origens selecionadas (máximo 100)' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: `Selecionar origem ${id}` })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('perda de acesso oculta seleção e restauração não executa cópia', async () => {
    let allowed = true
    const fetcher = backend(url => url.includes('/authorization?') ? json({ allowed }) : undefined)
    show(); await selectFirst(); fireEvent.click(screen.getByRole('button', { name: 'Revisar cópia' }))
    allowed = false; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByRole('heading', { name: '1 origens selecionadas (máximo 100)' })).not.toBeInTheDocument()
    allowed = true; fireEvent(window, new Event('focus'))
    await screen.findByRole('checkbox', { name: `Selecionar origem ${id}` })
    expect(screen.getByRole('heading', { name: '1 origens selecionadas (máximo 100)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar criação das cópias' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each([403, 404, 409, 422, 500])('erro %s não libera replay após foco', async status => {
    const fetcher = backend((url, init) => init.method === 'POST' ? new Response(null, { status }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await selectFirst(); confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('reenviar pode duplicar')
    fireEvent(window, new Event('focus')); await screen.findByRole('checkbox', { name: `Selecionar origem ${id}` })
    expect(screen.getByLabelText('Ano de origem')).toHaveValue(2032)
    fireEvent.submit(screen.getByRole('form', { name: 'Cópia manual de planejamento' }))
    expect(screen.getByRole('button', { name: 'Revisar cópia' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('resposta inválida não anuncia sucesso e não repete POST', async () => {
    const fetcher = backend((url, init) => init.method === 'POST' ? json({ ...result, recurrenceRuleId: type }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await selectFirst(); confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar')
    expect(screen.queryByRole('heading', { name: 'Lote de cópias criado em rascunho' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('outro contexto não recebe seleção nem resultado tardio', async () => {
    let finish!: (response: Response) => void
    const fetcher = backend((url, init) => init.method === 'POST' ? new Promise<Response>(done => { finish = done }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await selectFirst(); confirm()
    await waitFor(() => expect(writes(fetcher)).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Outra igreja' })); await screen.findByRole('checkbox', { name: `Selecionar origem ${id}` })
    await act(async () => finish(json(result)))
    expect(screen.getByRole('heading', { name: '0 origens selecionadas (máximo 100)' })).toBeInTheDocument()
    expect(screen.getByLabelText('Ano de origem')).toHaveValue(null)
    expect(screen.queryByRole('heading', { name: 'Lote de cópias criado em rascunho' })).not.toBeInTheDocument()
  })
})
