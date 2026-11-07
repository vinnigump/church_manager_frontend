import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthContext, AuthProvider } from '../auth'
import { listDelegatedAssignments, readDelegatedAssignment } from './assignments-api'

const denomination = '00000000-0000-0000-0000-000000000001'
const sourceId = '00000000-0000-0000-0000-000000000002'
const id = '00000000-0000-0000-0000-000000000003'
const other = '00000000-0000-0000-0000-000000000004'
const account = { id, personId: denomination, login: 'ana', status: 'ACTIVE' }
const assignment = { id, userId: id, profileId: denomination, organizationUnitId: denomination, delegationId: sourceId, status: 'ACTIVE', revision: 2, startsAt: '2026-11-01T12:00:00Z', endsAt: null }
const root = (source = sourceId) => `/seguranca/denominacoes/${denomination}/delegacoes/${source}/atribuicoes`
const json = (value: unknown) => new Response(JSON.stringify(value))
function server() {
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes('/assignments?')) {
      const page = Number(new URL(url, 'https://example.test').searchParams.get('page'))
      return json({ items: page ? [] : [assignment], page, size: 20, total: 21 })
    }
    return json(assignment)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function Switch() { const navigate = useNavigate(); return <button onClick={() => navigate(root(other))}>Outra fonte</button> }
function show(path = root()) {
  render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><Switch/><App/></AuthContext.Provider></MemoryRouter>)
}
describe('consulta de atribuições por fonte', () => {
  it('acesso vindo do detalhe da própria fonte não exige gestão central', async () => {
    const fetcher = server()
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async url => {
      if (url.endsWith(`/delegations/${sourceId}`)) return json({ id: sourceId, profileId: denomination, organizationUnitId: denomination, delegateeUserId: id, status: 'ACTIVE', revision: 1, startsAt: assignment.startsAt, endsAt: null })
      if (url.includes('/authorization?')) return json({ allowed: false })
      return handler(url)
    })
    show(`/seguranca/denominacoes/${denomination}/delegacoes/${sourceId}`)
    fireEvent.click(await screen.findByRole('link', { name: 'Consultar atribuições desta fonte' }))
    expect(await screen.findByRole('link', { name: `Consultar atribuição ${id}` })).toBeInTheDocument()
  })
  it('envia fonte obrigatória, usa autorização do GET e navega ao detalhe', async () => {
    const fetcher = server(); show()
    fireEvent.click(await screen.findByRole('link', { name: `Consultar atribuição ${id}` }))
    expect(await screen.findByRole('button', { name: 'Atualizar atribuição da fonte' })).toBeInTheDocument()
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/security/denominations/${denomination}/assignments?page=0&size=20&delegationId=${sourceId}`)
    expect(fetcher.mock.calls.some(([url]) => url.includes('/authorization?'))).toBe(false)
    expect(screen.getByText(/não concede gestão denominacional/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revogar|conceder/i })).not.toBeInTheDocument()
    expect(document.title).toBe('Detalhes da atribuição nesta fonte | Church Manager')
  })
  it('pagina sempre com a mesma fonte e recupera vazio', async () => {
    const fetcher = server(); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Próxima página' }))
    expect(await screen.findByText('Nenhuma atribuição desta fonte nesta página.')).toBeInTheDocument()
    expect(fetcher.mock.calls[1][0]).toContain(`page=1&size=20&delegationId=${sourceId}`)
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
    expect(await screen.findByRole('link', { name: `Consultar atribuição ${id}` })).toBeInTheDocument()
  })
  it.each([403, 404, 500])('erro %s nega dados sem revelar origem/proprietário', async status => {
    const fetcher = server(); fetcher.mockImplementation(async () => new Response('private-owner', { status }))
    show()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('private-owner')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: `Consultar atribuição ${id}` })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atualizar atribuições da fonte' })).toBeInTheDocument()
  })
  it('foco recarrega política do servidor e remove dados ao perder fonte utilizável', async () => {
    const fetcher = server(); show()
    await screen.findByRole('link', { name: `Consultar atribuição ${id}` })
    let finish!: (response: Response) => void
    fetcher.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    fireEvent(window, new Event('focus'))
    expect(screen.queryByRole('link', { name: `Consultar atribuição ${id}` })).not.toBeInTheDocument()
    await act(async () => finish(new Response(null, { status: 403 })))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
  it('troca de fonte descarta resposta anterior e não mostra dados antigos', async () => {
    const fetcher = server()
    let finish!: (response: Response) => void
    fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    show()
    fetcher.mockImplementation(async () => json({ items: [], page: 0, size: 20, total: 0 }))
    fireEvent.click(screen.getByRole('button', { name: 'Outra fonte' }))
    await screen.findByText('Nenhuma atribuição desta fonte nesta página.')
    await act(async () => finish(json({ items: [assignment], page: 0, size: 20, total: 1 })))
    expect(screen.queryByRole('link', { name: `Consultar atribuição ${id}` })).not.toBeInTheDocument()
    expect(fetcher.mock.calls[1][0]).toContain(`delegationId=${other}`)
  })
  it('visitante não consulta e rota inválida não faz rede', () => {
    const fetcher = server()
    const view = render(<MemoryRouter initialEntries={[root()]}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    expect(screen.getByLabelText('Login')).toBeInTheDocument()
    view.unmount()
    show(root('invalid'))
    expect(screen.getByRole('alert')).toHaveTextContent('inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([null, other])('rejeita atribuição de origem %s na lista e no detalhe', async delegationId => {
    const fetcher = server()
    fetcher.mockImplementation(async () => json({ items: [{ ...assignment, delegationId }], page: 0, size: 20, total: 1 }))
    await expect(listDelegatedAssignments(denomination, sourceId)).rejects.toThrow('validar')
    fetcher.mockImplementation(async () => json({ ...assignment, delegationId }))
    await expect(readDelegatedAssignment(denomination, sourceId, id)).rejects.toThrow('validar')
  })
  it('fonte inválida nunca cai na listagem central sem filtro', async () => {
    const fetcher = server()
    await expect(listDelegatedAssignments(denomination, '')).rejects.toThrow('validar')
    await expect(readDelegatedAssignment(denomination, '', id)).rejects.toThrow('validar')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
