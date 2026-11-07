import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext, AuthProvider } from '../auth'
import { createCalendar, readCalendar, setCalendarPublished, type AnnualCalendar } from './calendar-api'

const church = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const calendar: AnnualCalendar = { id: '00000000-0000-0000-0000-000000000003', churchId: church, year: 2026, status: 'DRAFT', revision: 4, createdAt: '2026-11-07T12:00:00Z', publishedAt: null }
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const route = (churchId = church, year = '2026') => `/eventos/igrejas/${churchId}/calendarios${year ? `/${year}` : ''}`
afterEach(() => api.clear())
function server({ initial = calendar, allowed = true, post }: { initial?: AnnualCalendar | null; allowed?: boolean; post?: () => Promise<Response> } = {}) {
  let value = initial && structuredClone(initial)
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-CSRF-TOKEN', token: 'test' })
    if (url.includes('/authorization?')) return json({ allowed })
    if (init.method === 'POST') {
      if (post) return post()
      if (url.endsWith('/2026')) { if (value) return json({}, 409); value = structuredClone(calendar); return json(value, 201) }
      if (new Headers(init.headers).get('X-Expected-Revision') !== String(value?.revision)) return json({}, 409)
      const published = url.endsWith('/publish')
      value = { ...value!, status: published ? 'PUBLISHED' : 'DRAFT', revision: value!.revision + 1, publishedAt: published ? '2026-11-07T12:30:00Z' : null }
    }
    return value ? json(value) : json({}, 404)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
const writes = (fetcher: ReturnType<typeof server>) => fetcher.mock.calls.filter(([, init]) => init.method === 'POST')
function Switch() { const navigate = useNavigate(); return <button onClick={() => navigate(route(other))}>Outra igreja</button> }
async function show(path = route(), controls = false) {
  await api.login('ana', 'test-password')
  render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}>{controls && <Switch/>}<App/></AuthContext.Provider></MemoryRouter>)
}

describe('contrato administrativo EVT-007', () => {
  it('consulta rota exata, projeta somente campos contratados e usa no-store', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ ...calendar, onlineUrl: 'privado' }))
    vi.stubGlobal('fetch', fetcher)
    expect(await readCalendar(church, 2026)).toEqual(calendar)
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/events/churches/${church}/calendars/2026`)
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' })
  })
  it('cria sem corpo e usa Basic/CSRF existentes', async () => {
    const fetcher = server({ initial: null })
    await api.login('ana', 'test-password')
    await createCalendar(church, 2026)
    const [url, init] = writes(fetcher)[0]
    expect(url).toBe(`/api/v1/events/churches/${church}/calendars/2026`)
    expect(init.body).toBeUndefined()
    expect(new Headers(init.headers).get('Authorization')).toBe(`Basic ${btoa('ana:test-password')}`)
    expect(new Headers(init.headers).get('X-CSRF-TOKEN')).toBe('test')
  })
  it.each([true, false])('publicação %s usa revisão lógica e nenhum ETag como revisão', async published => {
    const before: AnnualCalendar = { ...calendar, status: published ? 'DRAFT' : 'PUBLISHED', publishedAt: published ? null : '2026-11-07T12:30:00Z' }
    const fetcher = server({ initial: before })
    await api.login('ana', 'test-password')
    expect((await setCalendarPublished(before, published)).status).toBe(published ? 'PUBLISHED' : 'DRAFT')
    const [url, init] = writes(fetcher)[0]
    expect(url).toBe(`/api/v1/events/churches/${church}/calendars/2026/${published ? 'publish' : 'unpublish'}`)
    expect(init.body).toBeUndefined()
    expect(new Headers(init.headers).get('X-Expected-Revision')).toBe('4')
    expect(new Headers(init.headers).has('If-Match')).toBe(false)
  })
  it('não escreve sem CSRF', async () => {
    const fetcher = server()
    await expect(createCalendar(church, 2026, undefined, new ApiClient())).rejects.toMatchObject({ status: 403 })
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each([0, 10000, -1, 1.5, NaN])('ano inválido %s não faz request', async year => {
    const fetcher = server()
    await expect(readCalendar(church, year)).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([
    {}, { ...calendar, churchId: other }, { ...calendar, year: 2027 },
    { ...calendar, id: 'invalid' }, { ...calendar, status: 'OPEN' }, { ...calendar, revision: -1 },
    { ...calendar, createdAt: '2026-02-30T12:00:00Z' }, { ...calendar, publishedAt: '2026-11-07T12:30:00Z' },
    { ...calendar, status: 'PUBLISHED', publishedAt: null },
  ])('rejeita resposta incompatível %j', async value => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(value)))
    await expect(readCalendar(church, 2026)).rejects.toThrow('validar os dados')
  })
  it('não confirma publicação de outro calendário', async () => {
    server({ post: async () => json({ ...calendar, id: other, status: 'PUBLISHED', publishedAt: '2026-11-07T12:30:00Z' }) })
    await api.login('ana', 'test-password')
    await expect(setCalendarPublished(calendar, true)).rejects.toThrow('confirmar')
  })
})

describe('calendário anual administrativo', () => {
  it('exige permissão específica, exibe metadados e explica independência das ocorrências', async () => {
    const fetcher = server()
    await show()
    expect(await screen.findByText('Estado do planejamento: Rascunho')).toBeInTheDocument()
    const query = new URL(fetcher.mock.calls.find(([url]) => url.includes('/authorization?'))![0], 'https://example.test').searchParams
    expect(Object.fromEntries(query)).toEqual({ permissionCode: 'EVENT_CALENDAR_MANAGE', resourceType: 'CHURCH', resourceId: church })
    expect(screen.getByText(/não abre inscrições ou check-in/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /inscrever|presença/i })).not.toBeInTheDocument()
    expect(document.title).toBe('Calendário anual administrativo | Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('mostra somente seleção de ano quando não informado, sem buscar calendário', async () => {
    const fetcher = server()
    await show(route(church, ''))
    const input = await screen.findByLabelText('Ano do calendário')
    expect(fetcher.mock.calls.some(([url]) => url.includes('/calendars/'))).toBe(false)
    fireEvent.change(input, { target: { value: '2026' } })
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText('Estado do planejamento: Rascunho')).toBeInTheDocument()
  })
  it('nega sem consultar metadados ou oferecer ações', async () => {
    const fetcher = server({ allowed: false })
    await show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.some(([url]) => url.includes('/calendars/'))).toBe(false)
  })
  it.each([route('invalid'), route(church, '0'), route(church, '10000'), route(church, '2026.5')])('rota inválida %s não consulta domínio', async path => {
    const fetcher = server()
    await show(path)
    expect(screen.getByRole('alert')).toHaveTextContent('acesso ao calendário é inválido')
    expect(fetcher.mock.calls.some(([url]) => url.includes('/calendars/') || url.includes('/authorization?'))).toBe(false)
  })
  it('404 confirmado oferece criação explícita, sem sucesso simulado', async () => {
    const fetcher = server({ initial: null })
    await show()
    fireEvent.click(await screen.findByRole('button', { name: 'Criar calendário anual' }))
    expect(await screen.findByText('Calendário anual criado em rascunho.')).toBeInTheDocument()
    expect(await screen.findByText('Estado do planejamento: Rascunho')).toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('confirma publicação e retirada sem alterar ocorrências', async () => {
    const fetcher = server()
    await show()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar planejamento anual' }))
    expect(writes(fetcher)).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação' }))
    expect(await screen.findByText('Estado do planejamento: Publicado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retirar publicação do planejamento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar retirada de publicação' }))
    expect(await screen.findByText('Estado do planejamento: Rascunho')).toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(2)
    expect(writes(fetcher).every(([url]) => url.includes('/calendars/'))).toBe(true)
  })
  it('cancelar confirmação não envia escrita', async () => {
    const fetcher = server()
    await show()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar planejamento anual' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar alteração' }))
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each([403, 409, 422, 500])('falha de publicação %s não confirma e exige atualização', async status => {
    const fetcher = server({ post: async () => new Response('privado', { status }) })
    await show()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar planejamento anual' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Atualize o calendário')
    expect(screen.getByRole('alert')).not.toHaveTextContent('privado')
    expect(writes(fetcher)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar calendário' }))
    expect(await screen.findByRole('button', { name: 'Publicar planejamento anual' })).toBeEnabled()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('erro de leitura não oferece criação e permite retry', async () => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    let fail = true
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => url.includes('/calendars/') && fail ? new Response(null, { status: 500 }) : handler(url, init))
    await show()
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Criar calendário anual' })).not.toBeInTheDocument()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar calendário' }))
    expect(await screen.findByText('Estado do planejamento: Rascunho')).toBeInTheDocument()
  })
  it('trava publicação durante foco e ignora duplo clique', async () => {
    let finish!: (value: Response) => void
    const fetcher = server({ post: () => new Promise<Response>(resolve => { finish = resolve }) })
    await show()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar planejamento anual' }))
    const button = screen.getByRole('button', { name: 'Confirmar publicação' })
    fireEvent.click(button); fireEvent.click(button)
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: 'Publicar planejamento anual' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => { finish(json({ ...calendar, status: 'PUBLISHED', revision: 5, publishedAt: '2026-11-07T12:30:00Z' })) })
    expect(await screen.findByText('Planejamento anual publicado.')).toBeInTheDocument()
  })
  it('ignora escrita antiga ao mudar igreja', async () => {
    let finish!: (value: Response) => void
    const fetcher = server({ post: () => new Promise<Response>(resolve => { finish = resolve }) })
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => url.includes(`/churches/${other}/`) ? json({ ...calendar, churchId: other }) : handler(url, init))
    await show(route(), true)
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar planejamento anual' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação' }))
    fireEvent.click(screen.getByRole('button', { name: 'Outra igreja' }))
    await screen.findByText('Estado do planejamento: Rascunho')
    await act(async () => { finish(json({ ...calendar, status: 'PUBLISHED', revision: 5, publishedAt: '2026-11-07T12:30:00Z' })) })
    expect(screen.queryByText('Planejamento anual publicado.')).not.toBeInTheDocument()
  })
  it('descarta leitura do ano anterior ao selecionar outro ano', async () => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    let finish!: (value: Response) => void
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/calendars/2026')) return new Promise<Response>(resolve => { finish = resolve })
      if (url.endsWith('/calendars/2027')) return json({ ...calendar, year: 2027 })
      return handler(url, init)
    })
    await show()
    await screen.findByText('Carregando calendário…')
    const input = screen.getByLabelText('Ano do calendário')
    fireEvent.change(input, { target: { value: '2027' } })
    fireEvent.submit(input.closest('form')!)
    await screen.findByText('Planejamento de 2027')
    await act(async () => { finish(json({ ...calendar, status: 'PUBLISHED', publishedAt: '2026-11-07T12:30:00Z' })) })
    expect(screen.queryByText('Planejamento de 2026')).not.toBeInTheDocument()
    expect(screen.getByText('Estado do planejamento: Rascunho')).toBeInTheDocument()
  })
  it.each([
    async () => { throw new TypeError('network') },
    async () => json({ invalid: true }),
  ])('resultado incerto de publicação não vira sucesso ou retry', async post => {
    const fetcher = server({ post })
    await show()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar planejamento anual' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('resultado da alteração não pôde ser confirmado')
    expect(writes(fetcher)).toHaveLength(1)
    expect(screen.queryByText('Planejamento anual publicado.')).not.toBeInTheDocument()
  })
  it.each([true, false])('catálogo mostra acesso ao calendário somente com permissão %s', async allowed => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/authorization?')) {
        const code = new URL(url, 'https://example.test').searchParams.get('permissionCode')
        return json({ allowed: code === 'EVENT_VIEW' || (allowed && code === 'EVENT_CALENDAR_MANAGE') })
      }
      if (url.includes('/types?')) return json({ items: [], page: 0, size: 20, total: 0 })
      return handler(url, init)
    })
    await show(`/eventos/igrejas/${church}/catalogo`)
    await screen.findByText('Nenhum tipo de evento nesta página.')
    if (allowed) expect(await screen.findByRole('link', { name: 'Calendário anual administrativo' })).toHaveAttribute('href', route(church, ''))
    else expect(screen.queryByRole('link', { name: 'Calendário anual administrativo' })).not.toBeInTheDocument()
  })
  it('401 encerra sessão e volta ao login', async () => {
    server({ post: async () => new Response(null, { status: 401 }) })
    render(<MemoryRouter initialEntries={[route()]}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar planejamento anual' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação' }))
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou')
  })
})
