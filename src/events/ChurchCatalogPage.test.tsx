import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthContext, AuthProvider, useAuth } from '../auth'
import { listChurchCatalog } from './catalog-api'

const churchA = '00000000-0000-0000-0000-000000000001'
const churchB = '00000000-0000-0000-0000-000000000002'
const item = { id: '00000000-0000-0000-0000-000000000003', scopeType: 'DENOMINATION', name: 'Encontro denominacional', mandatory: true, enabled: true }
const page = { items: [item], page: 0, size: 20, total: 1 }
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const json = (value: unknown) => new Response(JSON.stringify(value))
const route = (id: string) => `/eventos/igrejas/${id}/catalogo`
function show(id = churchA, controls = false) {
  return render(<MemoryRouter initialEntries={[route(id)]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}>{controls && <SwitchChurch/>}<App/></AuthContext.Provider></MemoryRouter>)
}
function SwitchChurch() { const navigate = useNavigate(); return <button onClick={() => navigate(route(churchB))}>Outra igreja</button> }
function LoginThenOpen() {
  const { login } = useAuth()
  const navigate = useNavigate()
  return <button onClick={async () => { await login('ana', 'test-password'); navigate(route(churchA)) }}>Abrir catálogo após login</button>
}
function mockCatalog(value: unknown = page, allowed = true) {
  const fetcher = vi.fn().mockImplementation(async (url: string) => json(url.includes('/authorization?') ? { allowed: allowed && new URL(url, 'https://example.test').searchParams.get('permissionCode') === 'EVENT_VIEW' } : value))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

describe('cliente do contrato de catálogo 1.0.0', () => {
  it('usa rota e paginação publicadas e descarta campos extras', async () => {
    const fetcher = mockCatalog({ ...page, items: [{ ...item, privateUrl: 'segredo' }] })
    const result = await listChurchCatalog(churchA)
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/events/churches/${churchA}/types?page=0&size=20`)
    expect(result).toEqual(page)
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' })
  })
  it.each([
    {}, { ...page, page: 1 }, { ...page, size: 100 }, { ...page, total: -1 },
    { ...page, items: [{ ...item, enabled: 'true' }] },
    { ...page, items: [{ ...item, scopeType: 'UNKNOWN' }] },
    { ...page, items: [{ ...item, id: 'invalid' }] },
    { ...page, items: [item, item], total: 2 },
  ])('rejeita resposta incompatível %j', async value => {
    mockCatalog(value)
    await expect(listChurchCatalog(churchA)).rejects.toThrow('validar os dados')
  })
  it('rejeita parâmetros inválidos antes de consultar', async () => {
    const fetcher = mockCatalog()
    await expect(listChurchCatalog('../private')).rejects.toThrow()
    await expect(listChurchCatalog(churchA, 100001)).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('consulta paginada do catálogo autorizada', () => {
  it('exibe somente os campos reais, sem status de versão ou ações não concedidas', async () => {
    const fetcher = mockCatalog()
    show()
    expect(await screen.findByText(item.name)).toBeInTheDocument()
    expect(document.title).toBe('Catálogo de eventos | Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
    expect(screen.getByText('Origem denominacional')).toBeInTheDocument()
    expect(screen.getByText('Obrigatório no catálogo')).toBeInTheDocument()
    expect(screen.getByText('Habilitado')).toBeInTheDocument()
    expect(screen.queryByText(/Publicado|Rascunho/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remover|criar|habilitar|publicar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
    const authQuery = new URL(fetcher.mock.calls[0][0], 'https://example.test').searchParams
    expect(authQuery.get('permissionCode')).toBe('EVENT_VIEW')
    expect(authQuery.get('resourceId')).toBe(churchA)
  })
  it('nega acesso sem buscar catálogo quando allowed=false', async () => {
    const fetcher = mockCatalog(page, false)
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(item.name)).not.toBeInTheDocument()
  })
  it('visitante é redirecionado sem consultar decisões ou catálogo', () => {
    const fetcher = mockCatalog()
    render(<MemoryRouter initialEntries={[route(churchA)]}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('contexto inválido não consulta API', () => {
    const fetcher = mockCatalog()
    show('invalid')
    expect(screen.getByRole('alert')).toHaveTextContent('acesso ao catálogo é inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('401 da API de catálogo encerra sessão e redireciona ao login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/authorization?')) return json({ allowed: true })
      if (url.includes('/events/churches/')) return new Response(null, { status: 401 })
      return json(url.endsWith('/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'test' } : account)
    }))
    render(<MemoryRouter><AuthProvider><LoginThenOpen/><App/></AuthProvider></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir catálogo após login' }))
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou')
    expect(screen.queryByText(item.name)).not.toBeInTheDocument()
  })
  it('mostra vazio sem dados simulados', async () => {
    mockCatalog({ ...page, items: [], total: 0 })
    show()
    expect(await screen.findByText('Nenhum tipo de evento nesta página.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
  it('pagina sem manter registros da página anterior enquanto carrega', async () => {
    let finish!: (value: Response) => void
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/authorization?')) return json({ allowed: true })
      if (url.includes('page=1')) return new Promise<Response>(resolve => { finish = resolve })
      return json({ ...page, total: 21 })
    })
    vi.stubGlobal('fetch', fetcher)
    show()
    await screen.findByText(item.name)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(screen.queryByText(item.name)).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Carregando catálogo')
    await act(async () => { finish(json({ ...page, page: 1, total: 21, items: [{ ...item, name: 'Outro tipo' }] })) })
    expect(screen.getByText('Outro tipo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
    expect(await screen.findByText(item.name)).toBeInTheDocument()
  })
  it.each([403, 404, 409, 422, 500])('trata erro %s na listagem após consulta autorizada', async status => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => url.includes('/authorization?') ? json({ allowed: true }) : new Response('dado privado', { status })))
    show()
    expect(await screen.findByRole('button', { name: 'Atualizar catálogo' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('dado privado')).not.toBeInTheDocument()
    expect(screen.queryByText(item.name)).not.toBeInTheDocument()
  })
  it('recupera erro de rede com nova tentativa', async () => {
    let attempt = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/authorization?')) return json({ allowed: true })
      if (attempt++ === 0) throw new TypeError('network')
      return json(page)
    }))
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Atualizar catálogo' }))
    expect(await screen.findByText(item.name)).toBeInTheDocument()
  })
  it('descarta resposta de igreja anterior mesmo que o request ignore abort', async () => {
    let finish!: (value: Response) => void
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/authorization?')) return json({ allowed: true })
      if (url.includes(`/churches/${churchA}/`)) return new Promise<Response>(resolve => { finish = resolve })
      return json({ ...page, items: [{ ...item, name: 'Catálogo B' }] })
    }))
    show(churchA, true)
    await screen.findByText('Carregando catálogo…')
    fireEvent.click(screen.getByRole('button', { name: 'Outra igreja' }))
    await screen.findByText('Catálogo B')
    await act(async () => { finish(json(page)) })
    expect(screen.queryByText(item.name)).not.toBeInTheDocument()
    expect(screen.getByText('Catálogo B')).toBeInTheDocument()
  })
})

describe('recuperação da paginação quando o catálogo encolhe', () => {
  it.each([0, 20])('reconsulta a primeira página quando o total cai para %s', async total => {
    let shrunk = false
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/authorization?')) return json({ allowed: true })
      const currentPage = Number(new URL(url, 'https://example.test').searchParams.get('page'))
      return json({ items: shrunk && (currentPage > 0 || total === 0) ? [] : [{ ...item, name: `Tipo da página ${currentPage + 1}` }], page: currentPage, size: 20, total: shrunk ? total : 41 })
    })
    vi.stubGlobal('fetch', fetcher)
    show()
    await screen.findByText('Tipo da página 1')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Tipo da página 2')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Tipo da página 3')
    shrunk = true
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar catálogo' }))
    await screen.findByText(`Página 1 · ${total} tipos de evento no catálogo.`)
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
    expect(screen.queryByText('Tipo da página 3')).not.toBeInTheDocument()
    if (total === 0) expect(screen.getByText('Nenhum tipo de evento nesta página.')).toBeInTheDocument()
    else expect(screen.getByText('Tipo da página 1')).toBeInTheDocument()
    const reads = fetcher.mock.calls.filter(([url]) => !url.includes('/authorization?'))
    expect(reads.map(([url]) => new URL(url, 'https://example.test').searchParams.get('page'))).toEqual(['0', '1', '2', '2', '0'])
    expect(fetcher.mock.calls.every(([, init]) => !init.method || init.method === 'GET')).toBe(true)
  })

  it('preserva a página atual quando ela ainda existe após atualizar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/authorization?')) return json({ allowed: true })
      const currentPage = Number(new URL(url, 'https://example.test').searchParams.get('page'))
      return json({ ...page, page: currentPage, total: 21 })
    }))
    show()
    await screen.findByText(item.name)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Página 2 · 21 tipos de evento no catálogo.')
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar catálogo' }))
    expect(await screen.findByText('Página 2 · 21 tipos de evento no catálogo.')).toBeInTheDocument()
  })
})
