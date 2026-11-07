import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthContext, AuthProvider } from '../auth'

const church = '00000000-0000-0000-0000-000000000001'
const id = '00000000-0000-0000-0000-000000000002'
const other = '00000000-0000-0000-0000-000000000003'
const candidate = '00000000-0000-0000-0000-000000000004'
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const space = { occurrenceId: id, churchId: church, code: 'MAIN', name: 'Salão', revision: 7, defined: true, label: 'Salão' }
const item = { occurrenceId: candidate, startsAt: '2026-11-09T10:00:00Z', endsAt: '2026-11-09T11:00:00Z', status: 'DRAFT', outcome: 'PREVENTIVE', overlap: 'PT1H' }
const page = { occurrenceId: id, outcome: 'CRITICAL', hasUnresolvedSpaces: true, limitSeconds: 1800, items: [item], page: 0, size: 20, total: 21 }
const route = (occurrence = id) => `/eventos/igrejas/${church}/ocorrencias/${occurrence}/planejamento`
const json = (v: unknown) => new Response(JSON.stringify(v))
function mockBackend(handler?: (url: string) => Response | Promise<Response> | undefined) {
  const fetcher = vi.fn().mockImplementation(async (url: string) => {
    const custom = handler?.(url)
    if (custom !== undefined) return custom
    if (url.includes('/authorization?')) return json({ allowed: true })
    if (url.endsWith('/space')) return json(space)
    if (url.includes('/conflicts?')) return json(page)
    throw new Error('Unexpected fixture request')
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function SwitchOccurrence() { const navigate = useNavigate(); return <button onClick={() => navigate(route(other))}>Outra ocorrência</button> }
function show(path = route(), controls = false) {
  return render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}>{controls && <SwitchOccurrence/>}<App/></AuthContext.Provider></MemoryRouter>)
}
describe('consulta de planejamento', () => {
  it('mostra resumo global distinto dos candidatos, exatidão do código e limites sem ações operacionais', async () => {
    const fetcher = mockBackend(); show()
    await screen.findAllByText('Salão')
    expect(screen.getByText('MAIN')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Sobreposição crítica')
    expect(screen.getByText('Alerta preventivo de planejamento')).toBeInTheDocument()
    expect(screen.getByText(/Há espaços indefinidos/)).toBeInTheDocument()
    expect(screen.getByText(/Interseção.*PT1H/)).toBeInTheDocument()
    expect(screen.getByText(/Limite informado pelo servidor: 1800 segundos/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /publicar|exceção|reservar|salvar/i })).not.toBeInTheDocument()
    expect(fetcher.mock.calls[0][0]).toContain('permissionCode=EVENT_VIEW')
    expect(fetcher.mock.calls[0][0]).toContain(`resourceId=${church}`)
    expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true)
    await waitFor(() => expect(document.title).toBe('Espaço e sobreposições | Church Manager'))
  })
  it('sem código e página vazia não afirma disponibilidade ou ausência de conflitos', async () => {
    mockBackend(url => url.endsWith('/space') ? json({ ...space, code: null, name: null, defined: false, label: 'A definir' }) : url.includes('/conflicts?') ? json({ ...page, outcome: 'UNDETERMINED', items: [], total: 0 }) : undefined)
    show()
    expect(await screen.findByText('A definir')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Indeterminado')
    expect(screen.getByText(/Resultado vazio ou zero candidatos não comprova ausência/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
  })
  it('NONE também mantém ressalva e PREVENTIVE explica que rascunho não reserva', async () => {
    let result = 'NONE'
    mockBackend(url => url.includes('/conflicts?') ? json({ ...page, outcome: result, hasUnresolvedSpaces: false, items: [], total: 0 }) : undefined)
    show(); await screen.findByText(/isso não confirma disponibilidade/)
    result = 'PREVENTIVE'
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar planejamento' }))
    expect(await screen.findByText(/O rascunho não cria reserva/)).toBeInTheDocument()
  })
  it.each([false, 'true'])('nega decisão falsa/incompatível %j antes de consultar dados', async allowed => {
    const fetcher = mockBackend(() => json({ allowed })); show()
    await screen.findByRole('alert')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Salão')).not.toBeInTheDocument()
  })
  it('visitante e contexto inválido não consultam API', () => {
    const fetcher = mockBackend()
    const view = show(route('invalid'))
    expect(screen.getByRole('alert')).toHaveTextContent('acesso ao planejamento é inválido')
    expect(fetcher).not.toHaveBeenCalled()
    view.unmount()
    render(<MemoryRouter initialEntries={[route()]}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('paginação consulta o servidor e não recalcula resumo pela página vazia', async () => {
    const fetcher = mockBackend(url => url.includes('page=1') ? json({ ...page, page: 1, items: [] }) : undefined)
    show(); await screen.findAllByText('Salão')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Página 2 · 21 candidatos.')
    expect(screen.getByRole('status')).toHaveTextContent('Sobreposição crítica')
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/conflicts?page=1&size=20'))).toBe(true)
  })
  it('falha de um GET não exibe resultado parcial; retry é somente leitura', async () => {
    let fail = true
    const fetcher = mockBackend(url => url.includes('/conflicts?') && fail ? new Response(null, { status: 500 }) : undefined)
    show(); await screen.findByRole('alert')
    expect(screen.queryByText('Salão')).not.toBeInTheDocument()
    fail = false; fireEvent.click(screen.getByRole('button', { name: 'Atualizar planejamento' }))
    await screen.findAllByText('Salão')
    expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true)
  })
  it('foco oculta dados e exige reautorização, sem reutilizar decisão anterior', async () => {
    let allowed = true
    mockBackend(url => url.includes('/authorization?') ? json({ allowed }) : undefined)
    show(); await screen.findAllByText('Salão')
    allowed = false; fireEvent(window, new Event('focus'))
    expect(screen.queryByText('Salão')).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
  })
  it('descarta avaliação atrasada depois de mudar ocorrência', async () => {
    let resolve!: (v: Response) => void
    mockBackend(url => url.includes(`/${id}/conflicts?`) ? new Promise<Response>(done => { resolve = done }) : url.endsWith(`/${other}/space`) ? json({ ...space, occurrenceId: other, name: 'Outro espaço', label: 'Outro espaço' }) : url.includes(`/${other}/conflicts?`) ? json({ ...page, occurrenceId: other, items: [], total: 0 }) : undefined)
    show(route(), true); await screen.findByText('Carregando planejamento…')
    fireEvent.click(screen.getByRole('button', { name: 'Outra ocorrência' }))
    await screen.findAllByText('Outro espaço')
    await act(async () => resolve(json(page)))
    expect(screen.queryByText('Salão')).not.toBeInTheDocument()
    expect(screen.queryByText(`Ocorrência ${candidate}`)).not.toBeInTheDocument()
  })
})
