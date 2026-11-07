import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext, AuthProvider } from '../auth'
import { createDenominationalType } from './catalog-api'

const denomination = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const created = { id: '00000000-0000-0000-0000-000000000003', name: 'Novo template', scopeType: 'DENOMINATION', mandatory: true, enabled: false }
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const route = (id = denomination) => `/eventos/denominacoes/${id}/catalogo`
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
afterEach(() => api.clear())
function server({ post, allowed = true, failReadAfterCreate = false }: { post?: () => Promise<Response>; allowed?: boolean; failReadAfterCreate?: boolean } = {}) {
  let saved = false
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-CSRF-TOKEN', token: 'test' })
    if (url.includes('/authorization?')) return json({ allowed })
    if (init.method === 'POST') { if (post) return post(); saved = true; return json(created, 201) }
    if (url.endsWith(`/types/${created.id}`)) return json({ id: created.id, status: 'DRAFT', revision: 0, publishedVersionId: null, draft: null })
    if (url.includes('/versions?')) return json({ items: [], page: 0, size: 20, total: 0 })
    if (saved && failReadAfterCreate) return new Response(null, { status: 500 })
    return json({ items: saved ? [created] : [], page: 0, size: 20, total: saved ? 1 : 0 })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
const writes = (fetcher: ReturnType<typeof server>) => fetcher.mock.calls.filter(([, init]) => init.method === 'POST')
function Switch() { const navigate = useNavigate(); return <button onClick={() => navigate(route(other))}>Outra denominação</button> }
async function show(controls = false) {
  await api.login('ana', 'test-password')
  render(<MemoryRouter initialEntries={[route()]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}>{controls && <Switch/>}<App/></AuthContext.Provider></MemoryRouter>)
}
async function submit(name = created.name) {
  const input = await screen.findByLabelText('Nome do novo template')
  fireEvent.change(input, { target: { value: name } })
  fireEvent.submit(input.closest('form')!)
}

describe('criação pelo contrato denominacional EVT-005/006', () => {
  it('envia somente nome normalizado, Basic/CSRF/cookie e valida a resposta', async () => {
    const fetcher = server()
    await api.login('ana', 'test-password')
    expect(await createDenominationalType(denomination, '  Novo template  ')).toEqual(created)
    const [url, init] = writes(fetcher)[0]
    expect(url).toBe(`/api/v1/events/denominations/${denomination}/types`)
    expect(JSON.parse(String(init.body))).toEqual({ name: created.name })
    const headers = new Headers(init.headers)
    expect(headers.get('Authorization')).toBe(`Basic ${btoa('ana:test-password')}`)
    expect(headers.get('X-CSRF-TOKEN')).toBe('test')
    expect(init).toMatchObject({ credentials: 'same-origin', cache: 'no-store' })
  })
  it.each(['', ' ', 'a'.repeat(181)])('rejeita nome inválido %j', async name => {
    const fetcher = server()
    await expect(createDenominationalType(denomination, name)).rejects.toThrow('180 caracteres')
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('não envia ID inválido ou escrita sem CSRF', async () => {
    const fetcher = server()
    await expect(createDenominationalType('../private', created.name)).rejects.toThrow()
    await expect(createDenominationalType(denomination, created.name, undefined, new ApiClient())).rejects.toMatchObject({ status: 403 })
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each([
    { ...created, scopeType: 'CHURCH' }, { ...created, mandatory: false },
    { ...created, enabled: true }, { ...created, id: 'invalid' }, { ...created, name: 'Outro nome' },
  ])('não confirma criação incompatível %j', async value => {
    server({ post: async () => json(value, 201) })
    await api.login('ana', 'test-password')
    await expect(createDenominationalType(denomination, created.name)).rejects.toThrow()
  })
})

describe('formulário autorizado de criação denominacional', () => {
  it('valida nome, cria e reconcilia catálogo com link para o detalhe', async () => {
    const fetcher = server()
    await show()
    await submit(' ')
    expect(screen.getByRole('alert')).toHaveTextContent('180 caracteres')
    expect(writes(fetcher)).toHaveLength(0)
    await submit()
    expect(await screen.findByText(/Template criado com rascunho inicial/)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: created.name })).toBeInTheDocument()
    expect(screen.getByLabelText('Nome do novo template')).toHaveValue('')
    fireEvent.click(screen.getByRole('link', { name: `Abrir template criado: ${created.name}` }))
    expect(await screen.findByText('Estado do template: Rascunho')).toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('nega formulário sem permissão, sem consultar catálogo', async () => {
    const fetcher = server({ allowed: false })
    await show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByLabelText('Nome do novo template')).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([url]) => url.includes('/events/denominations/'))).toBe(false)
  })
  it.each([400, 403, 404, 409, 422])('trata erro %s sem sucesso e exige atualização para nova tentativa', async status => {
    const fetcher = server({ post: async () => new Response('dado privado', { status }) })
    await show()
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Atualize o catálogo')
    expect(screen.getByRole('alert')).not.toHaveTextContent('dado privado')
    expect(screen.getByRole('button', { name: 'Criar template' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: /Abrir template criado/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar catálogo' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Criar template' })).toBeEnabled())
    expect(writes(fetcher)).toHaveLength(1)
  })
  it.each([
    async () => { throw new TypeError('network') },
    async () => new Response(null, { status: 500 }),
    async () => json({ invalid: true }, 201),
  ])('resultado incerto não é criação confirmada nem gera retry', async post => {
    const fetcher = server({ post })
    await show()
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('resultado da criação não pôde ser confirmado')
    expect(screen.queryByText(/Template criado com rascunho inicial/)).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('preserva sucesso confirmado se a leitura posterior falhar', async () => {
    server({ failReadAfterCreate: true })
    await show()
    await submit()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Template criado com rascunho inicial/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Abrir template criado/ })).toBeInTheDocument()
  })
  it('mantém criação bloqueada se a consulta de reconciliação falhar', async () => {
    const fetcher = server({ post: async () => { throw new TypeError('network') } })
    await show()
    await screen.findByText('Nenhum template no catálogo.')
    await submit()
    await screen.findByRole('alert')
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => url.includes('/types?') ? new Response(null, { status: 500 }) : handler(url, init))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar catálogo' }))
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    expect(screen.getByRole('button', { name: 'Criar template' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('uma consulta iniciada antes da falha não libera nova criação', async () => {
    const fetcher = server({ post: async () => { throw new TypeError('network') } })
    const handler = fetcher.getMockImplementation()!
    let finish!: (value: Response) => void
    let delayed = true
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/types?') && delayed) { delayed = false; return new Promise<Response>(resolve => { finish = resolve }) }
      return handler(url, init)
    })
    await show()
    await submit()
    await screen.findByRole('alert')
    await act(async () => { finish(json({ items: [], page: 0, size: 20, total: 0 })) })
    expect(screen.getByRole('button', { name: 'Criar template' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar catálogo' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Criar template' })).toBeEnabled())
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('mantém trava durante foco e impede dois POSTs', async () => {
    let finish!: (value: Response) => void
    const fetcher = server({ post: () => new Promise<Response>(resolve => { finish = resolve }) })
    await show()
    const input = await screen.findByLabelText('Nome do novo template')
    fireEvent.change(input, { target: { value: created.name } })
    fireEvent.submit(input.closest('form')!)
    fireEvent.submit(input.closest('form')!)
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: 'Criando template…' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => { finish(json(created, 201)) })
    expect(await screen.findByText(/Template criado com rascunho inicial/)).toBeInTheDocument()
  })
  it('ignora criação atrasada após mudar de denominação', async () => {
    let finish!: (value: Response) => void
    const fetcher = server({ post: () => new Promise<Response>(resolve => { finish = resolve }) })
    await show(true)
    await submit()
    fireEvent.click(screen.getByRole('button', { name: 'Outra denominação' }))
    await screen.findByLabelText('Nome do novo template')
    await act(async () => { finish(json(created, 201)) })
    expect(screen.queryByRole('link', { name: /Abrir template criado/ })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('401 na criação encerra a sessão com AuthProvider', async () => {
    server({ post: async () => new Response(null, { status: 401 }) })
    render(<MemoryRouter initialEntries={[route()]}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)
    await submit()
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou')
  })
})
