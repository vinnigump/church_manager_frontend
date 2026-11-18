import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth'
import App from '../App'
import OwnTrailPages from './OwnTrailPages'

const id = '00000000-0000-0000-0000-000000000001'
const account = { id, personId: id, login: 'ana', status: 'ACTIVE' }
const trail = { id, churchId: id, churchName: 'Igreja sintética', templateId: id, name: 'Percurso de membresia', versionId: id, versionNumber: 1,
  status: 'IN_PROGRESS', startedAt: '2035-01-01T10:00:00Z', completedAt: null, taskCount: 2, completedTaskCount: 0 }
const task = { id, position: 1, name: 'Acolhimento', type: 'MANUAL', required: true, status: 'BLOCKED', completedAt: null }
const page = (items: unknown[], p = 0, total = items.length) => ({ items, page: p, size: 20, total })
const json = (value: unknown) => new Response(JSON.stringify(value))
function tree(path = '/minhas-trilhas', current: typeof account | null = account) {
  return <MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account: current, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}>
    <Routes><Route path="minhas-trilhas" element={<OwnTrailPages/>}/><Route path="minhas-trilhas/:trailId" element={<OwnTrailPages detail/>}/><Route path="entrar" element={<h1>Entrar</h1>}/></Routes>
  </AuthContext.Provider></MemoryRouter>
}
function backend(handler?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined) {
  const fetcher = vi.fn(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init); if (custom !== undefined) return custom
    if (url.endsWith('/execution')) return new Response('', { status: 404 })
    if (url.includes('/tasks?')) return json(page([task]))
    if (url.endsWith(`/trails/${id}`)) return json(trail)
    if (url.includes('/trails?')) return json(page([trail]))
    throw new Error('Unexpected fixture request')
  }); vi.stubGlobal('fetch', fetcher); return fetcher
}
describe('consulta pessoal de trilhas (transporte simulado)', () => {
  it('o atalho do Início abre a rota integrada de consulta pessoal', async () => {
    backend(url => url.endsWith('/authorization/contexts') ? json({ contexts: [] }) : undefined)
    render(<MemoryRouter><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>)
    fireEvent.click(screen.getByRole('link', { name: /Minhas trilhas/ }))
    await screen.findByRole('heading', { name: 'Minhas trilhas' })
    expect(await screen.findByRole('link', { name: 'Acompanhar Percurso de membresia' })).toHaveAttribute('href', `/minhas-trilhas/${id}`)
  })
  it('lista percurso próprio com igreja/estado, sem ações administrativas', async () => {
    const fetcher = backend(); render(tree())
    expect(await screen.findByRole('link', { name: 'Acompanhar Percurso de membresia' })).toHaveAttribute('href', `/minhas-trilhas/${id}`)
    expect(screen.getByText('Igreja sintética · Em andamento')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /concluir|dispensar|criar/i })).not.toBeInTheDocument()
    expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true)
  })
  it('detalha etapas e distingue bloqueio sem simular conclusão', async () => {
    backend(); render(tree(`/minhas-trilhas/${id}`))
    await screen.findByRole('heading', { name: '1. Acolhimento' })
    expect(screen.getByText('Aguardando etapas anteriores')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Todas as minhas trilhas' })).toHaveAttribute('href', '/minhas-trilhas')
  })
  it('trata vazio e paginação com consulta real da próxima página', async () => {
    const fetcher = backend(url => url.includes('/trails?') ? json(page([], Number(new URL(url, 'https://example.test').searchParams.get('page')), 21)) : undefined)
    render(tree()); await screen.findByText('Você ainda não tem percursos registrados.')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' })); await screen.findByText('21 percursos · Página 2')
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/trails?page=1&size=20'))).toBe(true)
  })
  it('erro não mostra detalhes privados nem percorre recursos alheios', async () => {
    backend(() => new Response('private-secret', { status: 404 })); render(tree(`/minhas-trilhas/${id}`))
    await screen.findByText('Recurso não encontrado.')
    expect(screen.queryByText('private-secret')).not.toBeInTheDocument(); expect(screen.queryByText(trail.name)).not.toBeInTheDocument()
  })
  it('nova sessão descarta resposta pendente da mesma conta', async () => {
    let finish!: (response: Response) => void
    const first = backend(() => new Promise<Response>(done => { finish = done }))
    const view = render(tree()); backend(() => json(page([])))
    view.rerender(tree('/minhas-trilhas', { ...account }))
    await screen.findByText('Você ainda não tem percursos registrados.')
    expect(first.mock.calls[0][1]?.signal?.aborted).toBe(true)
    await act(async () => finish(json(page([trail]))))
    expect(screen.queryByText(trail.name)).not.toBeInTheDocument()
  })
  it('retorno do foco atualiza o estado próprio', async () => {
    backend(); render(tree()); await screen.findByRole('link', { name: 'Acompanhar Percurso de membresia' })
    backend(() => json(page([]))); fireEvent.focus(window)
    expect(screen.queryByText(trail.name)).not.toBeInTheDocument()
    await screen.findByText('Você ainda não tem percursos registrados.')
  })
  it('id inválido e visitante não consultam backend', async () => {
    const fetcher = backend(); const view = render(tree('/minhas-trilhas/invalid'))
    await screen.findByText('Acesso inválido ao percurso. Abra novamente sua lista de trilhas.'); expect(fetcher).not.toHaveBeenCalled()
    view.unmount(); render(tree('/minhas-trilhas', null)); await screen.findByRole('heading', { name: 'Entrar' }); expect(fetcher).not.toHaveBeenCalled()
  })
})
