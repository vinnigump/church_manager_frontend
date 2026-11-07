import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api } from '../api'
import { AuthContext, AuthProvider } from '../auth'

const church = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const id = '00000000-0000-0000-0000-000000000003'
const type = '00000000-0000-0000-0000-000000000004'
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const value = { id, churchId: church, eventTypeId: type, eventTypeVersionId: null, recurrenceRuleId: null, startsAt: '2026-11-08T10:00:00.123456Z', endsAt: '2026-11-08T11:00:00Z', capacity: null, modality: 'HYBRID', participationMode: 'REGISTRATION_REQUIRED', checkInRequired: false, status: 'DRAFT', firstPublishedAt: null, configured: true, revision: 4 }
const catalog = { items: [{ id: type, name: 'Encontro local', enabled: true, mandatory: false, scopeType: 'CHURCH' }], page: 0, size: 20, total: 1 }
const base = `/eventos/igrejas/${church}/ocorrencias`
const json = (v: unknown) => new Response(JSON.stringify(v))
type Handler = (url: string, init: RequestInit) => Response | Promise<Response> | undefined
function backend(handler?: Handler, permissions = ['EVENT_VIEW', 'EVENT_CREATE', 'EVENT_EDIT']) {
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init)
    if (custom !== undefined) return custom
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-FIXTURE-CSRF', token: 'fixture' })
    if (url.includes('/authorization?')) return json({ allowed: permissions.includes(new URL(url, 'https://example.test').searchParams.get('permissionCode') ?? '') })
    if (url.includes('/types?')) return json(catalog)
    if (url.includes('/occurrences?')) return json({ items: [value], page: 0, size: 20, total: 1 })
    if (url.endsWith(`/occurrences/${id}`)) return json(value)
    if (init.method === 'POST' && url.endsWith('/occurrences')) return json({ ...value, ...JSON.parse(String(init.body)) })
    throw new Error('Unexpected fixture request')
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function SwitchContext() { const navigate = useNavigate(); return <button onClick={() => navigate(`/eventos/igrejas/${other}/ocorrencias`)}>Outra igreja</button> }
function show(path = base, controls = false) {
  return render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}>{controls && <SwitchContext/>}<App/></AuthContext.Provider></MemoryRouter>)
}
async function authenticated() { await api.login('ana', 'fixture-password') }
function fillCreate() {
  fireEvent.change(screen.getByLabelText('Tipo de evento'), { target: { value: type } })
  fireEvent.change(screen.getByLabelText('Início (UTC)'), { target: { value: '2026-11-08T10:00:00' } })
  fireEvent.change(screen.getByLabelText('Término (UTC)'), { target: { value: '2026-11-08T11:00:00' } })
  fireEvent.change(screen.getByLabelText('Modalidade'), { target: { value: 'ONLINE' } })
  fireEvent.change(screen.getByLabelText('Participação'), { target: { value: 'OPEN_EVENT' } })
  fireEvent.change(screen.getByLabelText('Check-in obrigatório'), { target: { value: 'false' } })
}
const writes = (fetcher: ReturnType<typeof backend>) => fetcher.mock.calls.filter(([, init]) => ['POST', 'PUT'].includes(init?.method))
afterEach(() => api.clear())

describe('ocorrências administrativas', () => {
  it('lista, navega para detalhe, preserva configurações e não oferece publicação/inscrição', async () => {
    backend(); show()
    fireEvent.click(await screen.findByRole('link', { name: `Consultar ocorrência ${id}` }))
    expect(await screen.findByText('Versão vinculada')).toBeInTheDocument()
    expect(screen.queryByText('HYBRID', { exact: false })).not.toBeInTheDocument()
    expect(screen.getByText('Híbrido')).toBeInTheDocument()
    expect(screen.getByText('Ilimitada')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Editar rascunho' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /publicar|cancelar|inscrever|presença/i })).not.toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Detalhes da ocorrência | Church Manager'))
  })
  it('nega antes da leitura e visitante retorna ao login sem API', async () => {
    const fetcher = backend(undefined, [])
    const view = show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
    view.unmount(); fetcher.mockClear()
    render(<MemoryRouter initialEntries={[base]}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([`${base}/invalid`, '/eventos/igrejas/invalid/ocorrencias'])('não consulta contexto inválido %s', path => {
    const fetcher = backend(); show(path)
    expect(screen.getByRole('alert')).toHaveTextContent('acesso às ocorrências é inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('consulta não implica criar ou editar e edição direta exige permissão própria antes de GET', async () => {
    const fetcher = backend(undefined, ['EVENT_VIEW']); const view = show()
    await screen.findByRole('link', { name: `Consultar ocorrência ${id}` })
    expect(screen.queryByRole('link', { name: 'Criar rascunho de ocorrência' })).not.toBeInTheDocument()
    view.unmount(); fetcher.mockClear(); show(`${base}/${id}/editar`)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
  })
  it('EVENT_CREATE não implica EVENT_VIEW e não carrega tipos sem consulta autorizada', async () => {
    const fetcher = backend(undefined, ['EVENT_CREATE']); show(`${base}/nova`)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
  })
  it('lista vazia, erro uniforme com retry e paginação real', async () => {
    const fetcher = backend((url) => url.includes('/occurrences?') ? new Response(null, { status: 500 }) : undefined)
    show(); expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir a solicitação.')
    // First recover page zero, then move to the second page.
    fetcher.mockImplementation(async (url: string) => url.includes('/authorization?') ? json({ allowed: true }) : json({ items: [], page: url.includes('page=1') ? 1 : 0, size: 20, total: 21 }))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar ocorrências' }))
    await screen.findByText('Página 1 · 21 ocorrências.')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Página 2 · 21 ocorrências.')
    expect(screen.getByText('Nenhuma ocorrência nesta página.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
  })
  it('descarta resposta atrasada ao mudar igreja', async () => {
    let resolve!: (v: Response) => void
    backend(url => url.includes(`/churches/${church}/occurrences?`) ? new Promise<Response>(done => { resolve = done })
      : url.includes(`/churches/${other}/occurrences?`) ? json({ items: [], page: 0, size: 20, total: 0 }) : undefined)
    show(base, true)
    await screen.findByText('Carregando ocorrências…')
    fireEvent.click(screen.getByRole('button', { name: 'Outra igreja' }))
    await screen.findByText('Nenhuma ocorrência nesta página.')
    await act(async () => resolve(json({ items: [value], page: 0, size: 20, total: 1 })))
    expect(screen.queryByText(`Ocorrência ${id}`)).not.toBeInTheDocument()
  })
  it('preserva OPEN legado sem inferir modo de participação ou primeira publicação', async () => {
    backend(url => url.endsWith(`/occurrences/${id}`) ? json({ ...value, status: 'OPEN', configured: false, modality: null, participationMode: null, checkInRequired: null }) : undefined)
    show(`${base}/${id}`)
    expect(await screen.findByText('OPEN')).toBeInTheDocument()
    expect(screen.getByText('Incompleta; valores legados preservados')).toBeInTheDocument()
    expect(screen.getByText('Sem marco registrado')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Editar rascunho' })).not.toBeInTheDocument()
  })
})

describe('configuração explícita de rascunhos', () => {
  it('cria sem defaults de configuração, envia somente contrato e confirma sem publicar', async () => {
    const fetcher = backend(); await authenticated(); show(`${base}/nova`)
    await screen.findByRole('option', { name: /Encontro local/ })
    expect(screen.getByLabelText('Modalidade')).toHaveValue('')
    expect(screen.getByLabelText('Participação')).toHaveValue('')
    expect(screen.getByLabelText('Check-in obrigatório')).toHaveValue('')
    fillCreate()
    fireEvent.click(screen.getByRole('button', { name: 'Criar rascunho' }))
    expect(await screen.findByRole('link', { name: 'Consultar rascunho salvo' })).toHaveAttribute('href', `${base}/${id}`)
    expect(writes(fetcher)).toHaveLength(1)
    const [, init] = writes(fetcher)[0]
    expect(JSON.parse(init.body)).toEqual({ eventTypeId: type, startsAt: '2026-11-08T10:00:00Z', endsAt: '2026-11-08T11:00:00Z', capacity: null, modality: 'ONLINE', participationMode: 'OPEN_EVENT', checkInRequired: false })
    expect(init.headers.get('X-FIXTURE-CSRF')).toBe('fixture')
  })
  it('edição sem mudança conserva precisão original e revisão para no-op', async () => {
    const fetcher = backend(); await authenticated(); show(`${base}/${id}/editar`)
    await screen.findByRole('option', { name: /Encontro local/ })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await screen.findByRole('link', { name: 'Consultar rascunho salvo' })
    expect(JSON.parse(writes(fetcher)[0][1].body).startsAt).toBe(value.startsAt)
    expect(writes(fetcher)[0][1].headers.get('X-Expected-Revision')).toBe('4')
  })
  it('exige corrigir check-in de evento aberto, sem mudar o valor silenciosamente', async () => {
    const fetcher = backend(); await authenticated(); show(`${base}/nova`)
    await screen.findByRole('option', { name: /Encontro local/ }); fillCreate()
    fireEvent.change(screen.getByLabelText('Check-in obrigatório'), { target: { value: 'true' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar rascunho' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('evento aberto sem check-in')
    expect(screen.getByLabelText('Check-in obrigatório')).toHaveValue('true')
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('mantém trava de envio duplo durante reautorização por foco', async () => {
    let resolve!: (v: Response) => void
    const fetcher = backend((url, init) => init.method === 'POST' ? new Promise<Response>(done => { resolve = done }) : undefined)
    await authenticated(); show(`${base}/nova`)
    await screen.findByRole('option', { name: /Encontro local/ }); fillCreate()
    const button = screen.getByRole('button', { name: 'Criar rascunho' })
    fireEvent.click(button); fireEvent.click(button)
    fireEvent(window, new Event('focus'))
    await screen.findByRole('option', { name: /Encontro local/ })
    expect(screen.getByRole('button', { name: 'Criar rascunho' })).toBeDisabled()
    expect(screen.getByLabelText('Modalidade')).toHaveValue('ONLINE')
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => resolve(json({ ...value, ...JSON.parse(writes(fetcher)[0][1].body) })))
    await screen.findByRole('link', { name: 'Consultar rascunho salvo' })
  })
  it.each([409, 422, 500])('bloqueia novo PUT após %s, inclusive após foco, até reconciliação explícita', async status => {
    const fetcher = backend((url, init) => init.method === 'PUT' ? new Response(null, { status }) : undefined)
    await authenticated(); show(`${base}/${id}/editar`)
    await screen.findByRole('option', { name: /Encontro local/ })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Recarregue e confira')
    fireEvent(window, new Event('focus'))
    await screen.findByRole('option', { name: /Encontro local/ })
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar rascunho e descartar alterações locais' }))
    await screen.findByRole('option', { name: /Encontro local/ })
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled()
  })
  it('erro de POST não afirma ausência de criação nem permite repetição automática', async () => {
    const fetcher = backend((url, init) => init.method === 'POST' ? json({}) : undefined)
    await authenticated(); show(`${base}/nova`)
    await screen.findByRole('option', { name: /Encontro local/ }); fillCreate()
    fireEvent.click(screen.getByRole('button', { name: 'Criar rascunho' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A ocorrência pode ter sido criada')
    expect(screen.getByRole('button', { name: 'Criar rascunho' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('não atualiza revisão de campos sujos silenciosamente ao recuperar foco', async () => {
    let revision = 4
    const fetcher = backend(url => url.endsWith(`/occurrences/${id}`) ? json({ ...value, revision }) : undefined)
    await authenticated(); show(`${base}/${id}/editar`)
    await screen.findByRole('option', { name: /Encontro local/ })
    fireEvent.change(screen.getByLabelText('Capacidade (vazia: ilimitada)'), { target: { value: '12' } })
    revision = 5; fireEvent(window, new Event('focus'))
    await screen.findByText(/A revisão mudou/)
    expect(screen.getByLabelText('Capacidade (vazia: ilimitada)')).toHaveValue(12)
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar rascunho e descartar alterações locais' }))
    await screen.findByRole('option', { name: /Encontro local/ })
    expect(screen.getByLabelText('Capacidade (vazia: ilimitada)')).toHaveValue(null)
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled()
  })
  it('legado parcial exige configuração explícita e série bloqueia troca de tipo', async () => {
    backend(url => url.endsWith(`/occurrences/${id}`) ? json({ ...value, recurrenceRuleId: other, modality: null, participationMode: null, checkInRequired: null, configured: false }) : undefined)
    show(`${base}/${id}/editar`)
    await screen.findByRole('option', { name: /Encontro local/ })
    expect(screen.getByLabelText('Tipo de evento')).toBeDisabled()
    expect(screen.getByLabelText('Modalidade')).toHaveValue('')
    expect(screen.getByLabelText('Participação')).toHaveValue('')
    expect(screen.getByLabelText('Check-in obrigatório')).toHaveValue('')
  })
  it('paginar/atualizar catálogo não envia formulário nem perde tipo selecionado', async () => {
    const fetcher = backend(url => url.includes('/types?') ? json({ ...catalog, items: url.includes('page=1') ? [] : catalog.items, page: url.includes('page=1') ? 1 : 0, total: 21 }) : undefined)
    await authenticated(); show(`${base}/nova`)
    await screen.findByRole('option', { name: /Encontro local/ }); fillCreate()
    const picker = within(screen.getByRole('region', { name: 'Tipo da ocorrência' }))
    fireEvent.click(picker.getByRole('button', { name: 'Próxima página' }))
    await screen.findByRole('option', { name: /Tipo selecionado fora desta página/ })
    expect(screen.getByLabelText('Tipo de evento')).toHaveValue(type)
    fireEvent.click(picker.getByRole('button', { name: 'Atualizar tipos disponíveis' }))
    await screen.findByRole('option', { name: /Tipo selecionado fora desta página/ })
    expect(writes(fetcher)).toHaveLength(0)
  })
})
