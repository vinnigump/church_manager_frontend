import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import AuthorizedResources, { discoverResources } from './AuthorizedResources'
import { AuthContext } from './auth'

const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const a = { resourceType: 'CHURCH', resourceId: '20000000-0000-0000-0000-000000000001', label: 'Igreja A' }
const b = { resourceType: 'CHURCH', resourceId: '20000000-0000-0000-0000-000000000002', label: 'Igreja B' }
const d = { resourceType: 'DENOMINATION', resourceId: '30000000-0000-0000-0000-000000000001', label: 'Denominação D' }
const response = (value: unknown) => new Response(JSON.stringify(value))
function tree(current: typeof account | null = account, app = false, path = '/') {
  return <MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account: current, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}>
    {app ? <App/> : <AuthorizedResources/>}
  </AuthContext.Provider></MemoryRouter>
}
function mockResources(resources = [a, b, d]) {
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/authorization/contexts')) return response({ contexts: resources })
    const query = new URL(url, 'https://example.test').searchParams
    return response({ allowed: query.get('permissionCode') === 'EVENT_VIEW' || query.get('permissionCode') === 'security:audit:read' })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

describe('descoberta integrada de recursos', () => {
  it('usa GET sem filtros, cache ou conta-alvo e encaminha cancelamento', async () => {
    const fetcher = mockResources()
    const controller = new AbortController()
    expect(await discoverResources(controller.signal)).toEqual([a, b, d])
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/v1/accounts/me/authorization/contexts', expect.objectContaining({ signal: controller.signal, credentials: 'same-origin', cache: 'no-store' }))
  })
  it.each([null, {}, { contexts: null }, { contexts: [], extra: true }, { contexts: [a, a] }, { contexts: [{ ...a, resourceType: 'GLOBAL' }] }, { contexts: [{ ...a, resourceId: 'invalid' }] }, { contexts: [{ ...a, label: '' }] }, { contexts: [{ ...a, permissions: [] }] }])('rejeita snapshot inválido inteiro %j', async data => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(data)))
    await expect(discoverResources()).rejects.toThrow('validar os recursos')
  })
  it('abre Home sem seletor e só mostra destinos com permissão própria', async () => {
    mockResources()
    render(tree(account, true))
    expect(screen.getByRole('heading', { name: 'Bem-vindo' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Catálogo de eventos' })).toHaveLength(2))
    const item = screen.getByRole('heading', { name: a.label }).closest('li')!
    expect(within(item).getByRole('link', { name: 'Catálogo de eventos' })).toHaveAttribute('href', `/eventos/igrejas/${a.resourceId}/catalogo`)
    expect(await screen.findByRole('link', { name: 'Auditoria' })).toHaveAttribute('href', `/seguranca/denominacoes/${d.resourceId}/auditoria`)
    expect(screen.queryByRole('link', { name: 'Perfis de acesso' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendário anual' })).not.toBeInTheDocument()
  })
  it('lista vazia mantém conta e navegação sem seleção obrigatória', async () => {
    mockResources([])
    render(tree(account, true))
    expect(await screen.findByText('Nenhum recurso autorizado disponível.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Acessar minha conta/ })).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
  it('falha suspende opções e permite recuperação explícita sem exibir corpo sensível', async () => {
    mockResources([a])
    render(tree())
    await screen.findByRole('link', { name: 'Catálogo de eventos' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('segredo', { status: 503 })))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar acessos' }))
    expect(screen.queryByText(a.label)).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar')
    expect(screen.queryByText('segredo')).not.toBeInTheDocument()
    mockResources([b])
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar acessos' }))
    expect(await screen.findByText(b.label)).toBeInTheDocument()
  })
  it('revalida ao foco, remove A e preserva navegação autorizada em B', async () => {
    mockResources([a, b])
    render(tree())
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Catálogo de eventos' })).toHaveLength(2))
    mockResources([b])
    fireEvent.focus(window)
    expect(screen.queryByText(a.label)).not.toBeInTheDocument()
    expect(await screen.findByText(b.label)).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Catálogo de eventos' })).toHaveAttribute('href', `/eventos/igrejas/${b.resourceId}/catalogo`)
  })
  it.each(['success', 'error'] as const)('cancela descoberta e descarta %s tardio após nova verificação', async outcome => {
    let resolve!: (value: Response) => void
    let reject!: (error: Error) => void
    const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() => new Promise<Response>((yes, no) => { resolve = yes; reject = no }))
    vi.stubGlobal('fetch', fetcher)
    render(tree())
    mockResources([b])
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar acessos' }))
    await screen.findByRole('link', { name: 'Catálogo de eventos' })
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true)
    await act(async () => { if (outcome === 'success') resolve(response({ contexts: [a] })); else reject(new Error('segredo')) })
    expect(screen.queryByText(a.label)).not.toBeInTheDocument()
    expect(screen.getByText(b.label)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('limpa e cancela descoberta ao encerrar sessão, sem restaurar resposta antiga', async () => {
    let resolve!: (value: Response) => void
    const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() => new Promise<Response>(yes => { resolve = yes }))
    vi.stubGlobal('fetch', fetcher)
    const view = render(tree())
    view.rerender(tree(null))
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true)
    await act(async () => { resolve(response({ contexts: [a] })) })
    expect(screen.queryByText(a.label)).not.toBeInTheDocument()
  })
  it('não reaproveita snapshot ao entrar novamente na mesma conta', async () => {
    mockResources([a])
    const view = render(tree())
    await screen.findByRole('link', { name: 'Catálogo de eventos' })
    mockResources([b])
    view.rerender(tree({ ...account }))
    expect(screen.queryByText(a.label)).not.toBeInTheDocument()
    expect(await screen.findByText(b.label)).toBeInTheDocument()
  })
  it('revogação na rota cancela leitura em andamento e descarta o resultado tardio', async () => {
    let resolve!: (value: Response) => void
    let allowed = true
    let pendingSignal: AbortSignal | undefined
    const fetcher = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/authorization?')) return Promise.resolve(response({ allowed }))
      pendingSignal = init?.signal ?? undefined
      return new Promise<Response>(yes => { resolve = yes })
    })
    vi.stubGlobal('fetch', fetcher)
    render(tree(account, true, `/eventos/igrejas/${a.resourceId}/catalogo`))
    await screen.findByText('Carregando catálogo…')
    expect(pendingSignal?.aborted).toBe(false)
    allowed = false
    fireEvent.focus(window)
    expect(pendingSignal?.aborted).toBe(true)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    await act(async () => { resolve(response({ items: [{ name: 'Conteúdo antigo' }], total: 1, page: 0, size: 20 })) })
    expect(screen.queryByText('Conteúdo antigo')).not.toBeInTheDocument()
    expect(screen.queryByText('Carregando catálogo…')).not.toBeInTheDocument()
  })
  it('acesso direto indevido consulta permissão e nunca busca o catálogo', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ allowed: false }))
    vi.stubGlobal('fetch', fetcher)
    render(tree(account, true, `/eventos/igrejas/${a.resourceId}/catalogo`))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
    expect(screen.queryByRole('button', { name: 'Atualizar catálogo' })).not.toBeInTheDocument()
  })
})
