import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthContext } from '../auth'
const church = '00000000-0000-0000-0000-000000000001', unit = '00000000-0000-0000-0000-000000000002', other = '00000000-0000-0000-0000-000000000003'
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const item = { id: unit, churchId: church, kind: 'MINISTRY', ministryId: unit, name: 'Acolhimento', ministryName: 'Acolhimento', active: true }
const json = (v: unknown) => new Response(JSON.stringify(v))
type Handler = (url: string, init: RequestInit) => Response | Promise<Response> | undefined
function backend(handler?: Handler, permissions = ['GROUP_MEMBERSHIP_MANAGE']) {
  const fetcher = vi.fn(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init); if (custom !== undefined) return custom
    if (url.endsWith('/authorization/contexts')) return json({ contexts: [{ resourceType: 'CHURCH', resourceId: church, label: 'Igreja A' }] })
    if (url.includes('/authorization?')) return json({ allowed: permissions.includes(new URL(url, 'https://example.test').searchParams.get('permissionCode') ?? '') })
    if (url.includes('/managed-ministry-units?')) return json({ items: [item], page: 0, size: 20, total: 1 })
    throw new Error('Unexpected fixture request')
  }); vi.stubGlobal('fetch', fetcher); return fetcher
}
function Switch() { const navigate = useNavigate(); return <button onClick={() => navigate(`/ministerios/igrejas/${other}`)}>Outra igreja</button> }
function tree(path = '/ministerios', current = account) { return <MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account: current, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><Switch/><App/></AuthContext.Provider></MemoryRouter> }
describe('gestão ministerial com diretório real (transporte simulado)', () => {
  it('descobre igreja, abre diretório e vínculo sem digitar UUID', async () => {
    backend(); render(tree())
    fireEvent.click(await screen.findByRole('link', { name: 'Ministérios de Igreja A' }))
    expect(await screen.findByRole('link', { name: 'Consultar integrantes de Acolhimento' })).toHaveAttribute('href', `/igrejas/${church}/grupos/MINISTRY/${unit}/vinculos`)
    expect(screen.getByRole('heading', { name: 'Acolhimento' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/UUID/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Criar grupo|Excluir/i })).not.toBeInTheDocument()
  })
  it('liderança candidata pode ver diretório vazio sem inferir concessão à unidade', async () => {
    backend(url => url.includes('/managed-ministry-units?') ? json({ items: [], page: 0, size: 20, total: 0 }) : undefined, ['GROUP_MEMBERSHIP_MANAGE_LED'])
    render(tree(`/ministerios/igrejas/${church}`))
    await screen.findByText('Nenhum ministério ou departamento disponível para sua gestão com estes filtros.')
    expect(screen.queryByRole('link', { name: /Consultar integrantes/ })).not.toBeInTheDocument()
  })
  it('nega sem permissão antes de consultar diretório', async () => {
    const fetcher = backend(undefined, []); render(tree(`/ministerios/igrejas/${church}`))
    await screen.findByText('Acesso não autorizado à gestão do grupo.')
    expect(fetcher.mock.calls.some(([url]) => url.includes('/managed-ministry-units'))).toBe(false)
  })
  it('busca e tipo são aplicados no servidor e reiniciam paginação', async () => {
    const fetcher = backend(url => url.includes('/managed-ministry-units?') ? json({ items: [], page: Number(new URL(url, 'https://example.test').searchParams.get('page')), size: 20, total: 21 }) : undefined)
    render(tree(`/ministerios/igrejas/${church}`)); await screen.findByText('21 resultados · Página 1')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' })); await screen.findByText('21 resultados · Página 2')
    fireEvent.change(screen.getByLabelText('Pesquisar pelo nome'), { target: { value: 'Recepção' } })
    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'DEPARTMENT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pesquisar' })); await screen.findByText('21 resultados · Página 1')
    expect(fetcher.mock.calls.some(([url]) => url.includes('page=0&size=20&kind=DEPARTMENT&q=Recep'))).toBe(true)
  })
  it('mostra departamento/pai e estado inativo sem permitir novos vínculos', async () => {
    backend(url => url.includes('/managed-ministry-units?') ? json({ items: [{ ...item, id: other, kind: 'DEPARTMENT', name: 'Recepção', active: false }], page: 0, size: 20, total: 1 }) : undefined)
    render(tree(`/ministerios/igrejas/${church}`))
    await screen.findByText('Departamento de Acolhimento · Inativo')
    expect(screen.getByRole('link', { name: 'Consultar integrantes de Recepção' })).toHaveAttribute('href', `/igrejas/${church}/grupos/DEPARTMENT/${other}/vinculos`)
  })
  it('revogação ao foco remove dados e atalhos', async () => {
    backend(); render(tree(`/ministerios/igrejas/${church}`)); await screen.findByText('Acolhimento')
    backend(undefined, []); fireEvent.focus(window)
    await screen.findByText('Acesso não autorizado à gestão do grupo.')
    expect(screen.queryByText('Acolhimento')).not.toBeInTheDocument()
  })
  it('erro de permissão na descoberta falha fechado e não mostra lista parcial', async () => {
    backend(url => url.includes('/authorization?') ? new Response('private-detail', { status: 500 }) : undefined)
    render(tree()); await screen.findByText('Não foi possível confirmar seus acessos.')
    expect(screen.queryByText('Igreja A')).not.toBeInTheDocument(); expect(screen.queryByText('private-detail')).not.toBeInTheDocument()
  })
  it('troca de igreja cancela consulta antiga sem exibir resposta tardia', async () => {
    let finish!: (value: Response) => void
    backend(url => url.includes(`/churches/${church}/managed-ministry-units?`) ? new Promise<Response>(done => { finish = done })
      : url.includes(`/churches/${other}/managed-ministry-units?`) ? json({ items: [], page: 0, size: 20, total: 0 }) : undefined)
    render(tree(`/ministerios/igrejas/${church}`)); await waitFor(() => expect(finish).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: 'Outra igreja' })); await screen.findByText(/Nenhum ministério ou departamento/)
    await act(async () => finish(json({ items: [item], page: 0, size: 20, total: 1 })))
    expect(screen.queryByText('Acolhimento')).not.toBeInTheDocument()
  })
  it('nova sessão da mesma conta limpa o diretório anterior', async () => {
    backend(); const view = render(tree(`/ministerios/igrejas/${church}`)); await screen.findByText('Acolhimento')
    backend(undefined, []); view.rerender(tree(`/ministerios/igrejas/${church}`, { ...account }))
    expect(screen.queryByText('Acolhimento')).not.toBeInTheDocument()
    await screen.findByText('Acesso não autorizado à gestão do grupo.')
  })
  it('URL inválida não consulta API', () => {
    const fetcher = backend(); render(tree('/ministerios/igrejas/invalid'))
    expect(screen.getByRole('alert')).toHaveTextContent('Igreja inválida')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
