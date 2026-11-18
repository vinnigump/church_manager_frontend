import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
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
      if (url.endsWith('/2026')) { if (value) return json({}, 409); value = { ...structuredClone(calendar), revision: 0 }; return json(value, 201) }
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

describe('calendário anual histórico somente leitura', () => {
  it.each(['DRAFT', 'PUBLISHED'] as const)('preserva metadados %s sem oferecer criação/publicação', async status => {
    const fetcher = server({ initial: { ...calendar, status, publishedAt: status === 'PUBLISHED' ? '2026-11-07T12:30:00Z' : null } }); await show()
    expect(await screen.findByText('Estado do planejamento: ' + (status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'))).toBeInTheDocument()
    expect(screen.getByText(/Consulta histórica somente para leitura/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /criar|publicar|retirar/i })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
    const query = new URL(fetcher.mock.calls.find(([url]) => url.includes('/authorization?'))![0], 'https://example.test').searchParams
    expect(query.get('permissionCode')).toBe('EVENT_CALENDAR_MANAGE')
  })
  it('404 informa ausência sem criar nem oferecer publicação', async () => {
    const fetcher = server({ initial: null }); await show()
    expect(await screen.findByText('Não há calendário anual para 2026 nesta igreja.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /criar|publicar/i })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('consulta outro ano somente após seleção explícita', async () => {
    const fetcher = server(); await show(route(church, ''))
    const input = await screen.findByLabelText('Ano do calendário')
    expect(fetcher.mock.calls.some(([url]) => url.includes('/calendars/'))).toBe(false)
    fireEvent.change(input, { target: { value: '2026' } }); fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText('Estado do planejamento: Rascunho')).toBeInTheDocument()
  })
  it('nega leitura sem permissão específica antes de consultar histórico', async () => {
    const fetcher = server({ allowed: false }); await show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.some(([url]) => url.includes('/calendars/'))).toBe(false)
  })
  it.each([route('invalid'), route(church, '0'), route(church, '10000'), route(church, '2026.5')])('contexto inválido %s não consulta domínio', async path => {
    const fetcher = server(); await show(path)
    expect(screen.getByRole('alert')).toHaveTextContent('acesso ao calendário é inválido')
    expect(fetcher.mock.calls.some(([url]) => url.includes('/calendars/') || url.includes('/authorization?'))).toBe(false)
  })
  it('foco relê o histórico sem mutações', async () => {
    const fetcher = server(); await show(); await screen.findByText('Estado do planejamento: Rascunho')
    const before = fetcher.mock.calls.filter(([url]) => url.includes('/calendars/')).length
    fireEvent.focus(window)
    await act(async () => { await Promise.resolve() })
    expect(fetcher.mock.calls.filter(([url]) => url.includes('/calendars/')).length).toBeGreaterThan(before)
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('troca de igreja não conserva metadados da igreja anterior', async () => {
    const fetcher = server(); await show(route(), true); await screen.findByText('Estado do planejamento: Rascunho')
    fireEvent.click(screen.getByRole('button', { name: 'Outra igreja' }))
    expect(screen.queryByText('Estado do planejamento: Rascunho')).not.toBeInTheDocument()
    await screen.findByRole('alert')
    expect(writes(fetcher)).toHaveLength(0)
  })
})
