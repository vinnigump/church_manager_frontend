import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthContext, AuthProvider, useAuth } from '../auth'

const denomination = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const type = '00000000-0000-0000-0000-000000000003'
const version = { id: '00000000-0000-0000-0000-000000000004', number: 1, name: 'Encontro original', status: 'PUBLISHED', revision: 1, createdAt: '2026-11-07T12:00:00Z', publishedAt: '2026-11-07T12:30:00Z' }
const draft = { ...version, id: other, number: 2, name: 'Novo nome em rascunho', status: 'DRAFT', publishedAt: null }
const template = { id: type, status: 'PUBLISHED', revision: 2, publishedVersionId: version.id, draft }
const catalog = { items: [{ id: type, name: 'Encontro original', scopeType: 'DENOMINATION', mandatory: true, enabled: true }], page: 0, size: 20, total: 1 }
const history = { items: [version], page: 0, size: 20, total: 1 }
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const route = (id = denomination) => `/eventos/denominacoes/${id}/catalogo`
const detailRoute = (id = denomination, templateId = type) => `/eventos/denominacoes/${id}/templates/${templateId}`
const json = (value: unknown) => new Response(JSON.stringify(value))
function server(allowed = true) {
  const fetcher = vi.fn().mockImplementation(async (url: string) => {
    if (url.includes('/authorization?')) return json({ allowed })
    if (url.includes('/versions?')) return json(history)
    return json(url.includes('/types?') ? catalog : template)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function SwitchContext({ detail = false }: { detail?: boolean }) {
  const navigate = useNavigate()
  return <button onClick={() => navigate(detail ? detailRoute(other) : route(other))}>Outra denominação</button>
}
function show(path = route(), controls = false) {
  return render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}>{controls && <SwitchContext detail={path.includes('/templates/')}/>}<App/></AuthContext.Provider></MemoryRouter>)
}
const reads = (fetcher: ReturnType<typeof server>) => fetcher.mock.calls.filter(([url]) => !url.includes('/authorization?'))

describe('catálogo denominacional autorizado', () => {
  it('consulta a permissão denominacional e navega ao detalhe sem inferir lifecycle de enabled', async () => {
    const fetcher = server()
    show()
    const link = await screen.findByRole('link', { name: 'Consultar versões de Encontro original' })
    expect(document.title).toBe('Catálogo denominacional | Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
    const query = new URL(fetcher.mock.calls[0][0], 'https://example.test').searchParams
    expect(Object.fromEntries(query)).toEqual({ permissionCode: 'EVENT_TEMPLATE_MANAGE', resourceType: 'DENOMINATION', resourceId: denomination })
    expect(screen.queryByText(/Estado do template/)).not.toBeInTheDocument()
    fireEvent.click(link)
    expect(await screen.findByText('Estado do template: Publicado')).toBeInTheDocument()
    expect(document.title).toBe('Versões do template | Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
    fireEvent.click(screen.getByRole('link', { name: 'Voltar ao catálogo denominacional' }))
    expect(await screen.findByRole('link', { name: /Consultar versões/ })).toBeInTheDocument()
  })
  it.each([route(), detailRoute()])('nega a rota %s sem buscar dados de domínio', async path => {
    const fetcher = server(false)
    show(path)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(reads(fetcher)).toHaveLength(0)
  })
  it.each([route('invalid'), detailRoute(denomination, 'invalid')])('rejeita contexto inválido na rota %s', path => {
    const fetcher = server()
    show(path)
    expect(screen.getByRole('alert')).toHaveTextContent('inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('visitante é redirecionado ao login sem consultar APIs', () => {
    const fetcher = server()
    render(<MemoryRouter initialEntries={[detailRoute()]}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('erro na decisão mantém os dados ocultos e permite reconsulta', async () => {
    const fetcher = server()
    fetcher.mockImplementationOnce(async () => new Response(null, { status: 500 }))
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('acesso permanece bloqueado')
    expect(reads(fetcher)).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Verificar novamente' }))
    expect(await screen.findByRole('link', { name: /Consultar versões/ })).toBeInTheDocument()
  })
  it('mostra catálogo vazio e permite atualizar', async () => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => url.includes('/types?') ? json({ ...catalog, items: [], total: 0 }) : handler(url))
    show()
    expect(await screen.findByText('Nenhum template no catálogo.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar catálogo' }))
    await screen.findByText('Nenhum template no catálogo.')
    expect(reads(fetcher)).toHaveLength(2)
  })
  it('descarta resposta antiga ao trocar denominação', async () => {
    const fetcher = server()
    let finish!: (value: Response) => void
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => url.includes(`/denominations/${denomination}/`) ? new Promise<Response>(resolve => { finish = resolve }) : handler(url))
    show(route(), true)
    await screen.findByText('Carregando templates…')
    fireEvent.click(screen.getByRole('button', { name: 'Outra denominação' }))
    await screen.findByRole('link', { name: /Consultar versões/ })
    await act(async () => { finish(json({ ...catalog, items: [{ ...catalog.items[0], name: 'Dado antigo' }] })) })
    expect(screen.queryByText('Dado antigo')).not.toBeInTheDocument()
  })
  it('pagina catálogo e recupera a última página válida quando o total diminui', async () => {
    const fetcher = server()
    let shrunk = false
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => {
      if (!url.includes('/types?')) return handler(url)
      const page = Number(new URL(url, 'https://example.test').searchParams.get('page'))
      return json({ ...catalog, page, total: shrunk ? 1 : 21, items: shrunk && page === 1 ? [] : catalog.items })
    })
    show()
    await screen.findByRole('link', { name: /Consultar versões/ })
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Página 2 · 21 templates no catálogo.')
    shrunk = true
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar catálogo' }))
    expect(await screen.findByText('Página 1 · 1 templates no catálogo.')).toBeInTheDocument()
    expect(reads(fetcher).map(([url]) => new URL(url, 'https://example.test').searchParams.get('page'))).toEqual(['0', '1', '1', '0'])
  })
  it('nega leitura após revogação observada no foco', async () => {
    const fetcher = server()
    show()
    await screen.findByRole('link', { name: /Consultar versões/ })
    fetcher.mockImplementation(async () => json({ allowed: false }))
    fireEvent(window, new Event('focus'))
    expect(screen.queryByRole('link', { name: /Consultar versões/ })).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
  })
  it('erro de consulta do catálogo não reflete corpo privado e permite retry', async () => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    let fail = true
    fetcher.mockImplementation(async (url: string) => url.includes('/types?') && fail ? new Response('privado', { status: 403 }) : handler(url))
    show()
    expect(await screen.findByRole('alert')).not.toHaveTextContent('privado')
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar catálogo' }))
    expect(await screen.findByRole('link', { name: /Consultar versões/ })).toBeInTheDocument()
  })
})

describe('consulta de template e histórico', () => {
  it('separa rascunho do histórico publicado, sem escritas automáticas', async () => {
    const fetcher = server()
    show(detailRoute())
    const draftRegion = await screen.findByRole('region', { name: 'Rascunho atual' })
    expect(within(draftRegion).getByText('Versão 2 · Novo nome em rascunho')).toBeInTheDocument()
    const historyRegion = screen.getByRole('region', { name: 'Histórico de versões' })
    expect(await within(historyRegion).findByText('Versão 1 · Encontro original')).toBeInTheDocument()
    expect(within(historyRegion).getByText('Versão publicada de referência na última consulta do template.')).toBeInTheDocument()
    expect(within(historyRegion).queryByText(/Novo nome/)).not.toBeInTheDocument()
    expect(within(historyRegion).getByText(/12:30:00 UTC/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument()
    expect(fetcher.mock.calls.every(([, init]) => !init.method || init.method === 'GET')).toBe(true)
  })
  it('apresenta descontinuado com histórico preservado', async () => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => url.endsWith(`/types/${type}`) ? json({ ...template, status: 'DISCONTINUED', draft: null }) : handler(url))
    show(detailRoute())
    expect(await screen.findByText('Estado do template: Descontinuado')).toBeInTheDocument()
    expect(screen.getByText('Não há rascunho atual.')).toBeInTheDocument()
    expect(await screen.findByText('Versão 1 · Encontro original')).toBeInTheDocument()
  })
  it('histórico vazio não apresenta versões sintéticas', async () => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => url.includes('/versions?') ? json({ ...history, items: [], total: 0 }) : handler(url))
    show(detailRoute())
    expect(await screen.findByText('Nenhuma versão no histórico.')).toBeInTheDocument()
  })
  it.each([403, 404, 409, 422, 500])('erro %s no detalhe não revela histórico ou corpo recebido', async status => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => url.endsWith(`/types/${type}`) ? new Response('segredo privado', { status }) : handler(url))
    show(detailRoute())
    expect(await screen.findByRole('alert')).not.toHaveTextContent('segredo privado')
    expect(screen.queryByRole('region', { name: 'Histórico de versões' })).not.toBeInTheDocument()
    expect(reads(fetcher)).toHaveLength(1)
  })
  it('recupera falha de rede do histórico sem repetir o detalhe', async () => {
    const fetcher = server()
    let fail = true
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => {
      if (url.includes('/versions?') && fail) { fail = false; throw new TypeError('network') }
      return handler(url)
    })
    show(detailRoute())
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar')
    expect(screen.getByText('Estado do template: Publicado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar histórico' }))
    expect(await screen.findByText('Versão 1 · Encontro original')).toBeInTheDocument()
    expect(reads(fetcher).filter(([url]) => url.endsWith(`/types/${type}`))).toHaveLength(1)
  })
  it('pagina histórico ocultando versões anteriores durante carregamento', async () => {
    const fetcher = server()
    let finish!: (value: Response) => void
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => {
      if (url.includes('/versions?page=1')) return new Promise<Response>(resolve => { finish = resolve })
      if (url.includes('/versions?')) return json({ ...history, total: 21 })
      return handler(url)
    })
    show(detailRoute())
    await screen.findByText('Versão 1 · Encontro original')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(screen.queryByText('Versão 1 · Encontro original')).not.toBeInTheDocument()
    expect(screen.getByText('Carregando histórico…')).toHaveAttribute('aria-busy', 'true')
    await act(async () => { finish(json({ ...history, page: 1, total: 21, items: [{ ...version, name: 'Outra versão' }] })) })
    expect(screen.getByText('Versão 1 · Outra versão')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
  })
  it('ignora detalhe atrasado de outra denominação mesmo se transporte ignorar abort', async () => {
    const fetcher = server()
    let finish!: (value: Response) => void
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => url.includes(`/denominations/${denomination}/`) ? new Promise<Response>(resolve => { finish = resolve }) : handler(url))
    show(detailRoute(), true)
    await screen.findByText('Carregando template…')
    fireEvent.click(screen.getByRole('button', { name: 'Outra denominação' }))
    await screen.findByText('Estado do template: Publicado')
    await act(async () => { finish(json({ ...template, status: 'DISCONTINUED' })) })
    expect(screen.queryByText('Estado do template: Descontinuado')).not.toBeInTheDocument()
  })
  it('401 no histórico encerra sessão com AuthProvider real', async () => {
    function Open() {
      const { login } = useAuth()
      const navigate = useNavigate()
      return <button onClick={async () => { await login('ana', 'test-password'); navigate(detailRoute()) }}>Abrir após login</button>
    }
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => {
      if (url.endsWith('/accounts/me')) return json(account)
      if (url.endsWith('/csrf')) return json({ headerName: 'X-CSRF-TOKEN', token: 'test' })
      if (url.includes('/versions?')) return new Response(null, { status: 401 })
      return handler(url)
    })
    render(<MemoryRouter><AuthProvider><Open/><App/></AuthProvider></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir após login' }))
    await screen.findByText('Sua sessão expirou. Entre novamente.')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou')
    expect(screen.queryByText('Estado do template: Publicado')).not.toBeInTheDocument()
  })
})
