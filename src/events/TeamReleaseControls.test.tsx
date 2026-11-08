import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
import { releaseOccurrenceTeam } from './team-api'

const church = '00000000-0000-0000-0000-000000000001'
const occurrence = '00000000-0000-0000-0000-000000000002'
const member = '00000000-0000-0000-0000-000000000003'
const assignment = '00000000-0000-0000-0000-000000000004'
const account = { id: member, personId: member, login: 'ana', status: 'ACTIVE' }
const item = { id: assignment, membershipId: member, role: 'COORDINATOR' as const, assignedAt: '2032-01-01T13:00:00Z', releasedAt: null, eligible: true }
const page = { occurrenceId: occurrence, revision: 7, items: [item], page: 0, size: 20, total: 1 }
const result = { occurrenceId: occurrence, assignmentId: assignment, revision: 8 }
const route = `/eventos/igrejas/${church}/ocorrencias/${occurrence}/equipe`
const json = (v: unknown) => new Response(JSON.stringify(v))
function ContextSwitch() { const navigate = useNavigate(); return <button onClick={() => navigate(route.replace(occurrence, member))}>Trocar ocorrência de teste</button> }
function show() { return render(<MemoryRouter initialEntries={[route]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><ContextSwitch/><App/></AuthContext.Provider></MemoryRouter>) }
function backend(handler?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined, permissions = ['EVENT_VIEW', 'EVENT_EDIT']) {
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init); if (custom !== undefined) return custom
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-TEAM-CSRF', token: 'fixture' })
    if (url.includes('/authorization?')) return json({ allowed: permissions.includes(new URL(url, 'https://example.test').searchParams.get('permissionCode') ?? '') })
    if (url.includes('/team?')) return json(page)
    if (init.method === 'DELETE') return json(result)
    throw new Error('Unexpected fixture request')
  }); vi.stubGlobal('fetch', fetcher); return fetcher
}
const writes = (fetcher: ReturnType<typeof backend>) => fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')
async function confirm() { fireEvent.click(await screen.findByRole('button', { name: `Liberar atribuição ${assignment}` })); fireEvent.click(screen.getByRole('button', { name: 'Confirmar liberação' })) }
afterEach(() => api.clear())

describe('contrato de liberação preservando histórico', () => {
  it.each([7, 8])('confirma revisão %s (no-op ou mudança)', async revision => {
    const client = new ApiClient(); const signal = new AbortController().signal
    const request = vi.spyOn(client, 'request').mockResolvedValue({ ...result, revision, privateUrl: 'private' })
    expect(await releaseOccurrenceTeam(church, occurrence, page, assignment, signal, client)).toEqual({ ...result, revision })
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/occurrences/${occurrence}/team/${assignment}`, { method: 'DELETE', headers: { 'X-Expected-Revision': '7' }, signal })
  })
  it.each([{}, { ...result, occurrenceId: member }, { ...result, assignmentId: member }, { ...result, revision: 6 }, { ...result, revision: 9 }, { ...result, revision: 7.5 }])('recusa resposta incompatível %j', async value => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(value)
    await expect(releaseOccurrenceTeam(church, occurrence, page, assignment, undefined, client)).rejects.toThrow()
  })
  it.each([{ ...page, occurrenceId: member }, { ...page, revision: -1 }, { ...page, items: [] }, { ...page, items: [{ ...item, releasedAt: item.assignedAt }] }])('recusa snapshot não compatível %j antes de escrever', async before => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request')
    await expect(releaseOccurrenceTeam(church, occurrence, before, assignment, undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
})

describe('liberação administrativa de atribuição', () => {
  it('confirma antes do DELETE com CSRF e relê histórico sem removê-lo', async () => {
    let released = false
    const fetcher = backend((url, init) => {
      if (init.method === 'DELETE') { released = true; return json(result) }
      if (url.includes('/team?')) return json(released ? { ...page, revision: 8, items: [{ ...item, releasedAt: item.assignedAt, eligible: false }] } : page)
    }); await api.login('ana', 'fixture-password'); show()
    fireEvent.click(await screen.findByRole('button', { name: `Liberar atribuição ${assignment}` }))
    expect(writes(fetcher)).toHaveLength(0)
    expect(screen.getByText(/Liberar a coordenação pode impedir/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar liberação' }))
    expect(await screen.findByText(/Liberação confirmada na revisão 8/)).toBeInTheDocument()
    expect(await screen.findByText(/Liberada em:/)).toBeInTheDocument()
    expect(screen.getByText(/incluindo liberadas/)).toHaveTextContent('1 atribuições')
    expect(screen.queryByRole('button', { name: `Liberar atribuição ${assignment}` })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
    const init = writes(fetcher)[0][1]
    expect(init.headers.get('X-Expected-Revision')).toBe('7')
    expect(init.headers.get('X-TEAM-CSRF')).toBe('fixture')
    expect(init.body).toBeUndefined()
  })
  it.each([{ permissions: ['EVENT_VIEW'] }, { permissions: ['EVENT_VIEW', 'EVENT_PUBLISH'] }])('leitura/publicação não concedem edição %j', async ({ permissions }) => {
    const fetcher = backend(undefined, permissions); show()
    await screen.findByRole('heading', { name: 'Coordenação' })
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.includes('EVENT_EDIT'))).toBe(true))
    expect(screen.queryByRole('button', { name: `Liberar atribuição ${assignment}` })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('edição sem leitura não consulta histórico', async () => {
    const fetcher = backend(undefined, ['EVENT_EDIT']); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
  })
  it('permite liberar atribuição inelegível ainda não liberada', async () => {
    backend(url => url.includes('/team?') ? json({ ...page, items: [{ ...item, eligible: false }] }) : undefined); show()
    expect(await screen.findByRole('button', { name: `Liberar atribuição ${assignment}` })).toBeEnabled()
  })
  it('voltar não escreve e foco descarta confirmação/reconsulta revisão', async () => {
    let revision = 7
    const fetcher = backend(url => url.includes('/team?') ? json({ ...page, revision }) : undefined); show()
    fireEvent.click(await screen.findByRole('button', { name: `Liberar atribuição ${assignment}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Voltar sem liberar' }))
    fireEvent.click(screen.getByRole('button', { name: `Liberar atribuição ${assignment}` }))
    revision = 8; fireEvent(window, new Event('focus'))
    await screen.findByRole('button', { name: `Liberar atribuição ${assignment}` })
    expect(screen.queryByRole('button', { name: 'Confirmar liberação' })).not.toBeInTheDocument()
    expect(screen.getByText(/Revisão consultada/)).toHaveTextContent('8')
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each([403, 404, 409, 422, 500])('erro %s bloqueia replay até atualização explícita', async status => {
    const fetcher = backend((url, init) => init.method === 'DELETE' ? new Response(null, { status }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Atualize e confira a equipe')
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: `Liberar atribuição ${assignment}` })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar equipe e reavaliar acesso' }))
    expect(await screen.findByRole('button', { name: `Liberar atribuição ${assignment}` })).toBeEnabled()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('trava sobrevive a envio duplo e foco durante DELETE', async () => {
    let finish!: (response: Response) => void
    const fetcher = backend((url, init) => init.method === 'DELETE' ? new Promise<Response>(done => { finish = done }) : undefined)
    await api.login('ana', 'fixture-password'); show()
    fireEvent.click(await screen.findByRole('button', { name: `Liberar atribuição ${assignment}` }))
    const button = screen.getByRole('button', { name: 'Confirmar liberação' }); fireEvent.click(button); fireEvent.click(button)
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: `Liberar atribuição ${assignment}` })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => finish(json(result)))
    await screen.findByText(/Liberação confirmada/)
  })
  it('resposta incompatível é resultado incerto e não libera replay por foco', async () => {
    const fetcher = backend((url, init) => init.method === 'DELETE' ? json({ ...result, assignmentId: member }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar')
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: `Liberar atribuição ${assignment}` })).toBeDisabled()
    expect(screen.queryByText(/Liberação confirmada/)).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('troca de contexto aborta e descarta resultado atrasado sem prometer rollback', async () => {
    let finish!: (response: Response) => void
    const fetcher = backend((url, init) => {
      if (init.method === 'DELETE') return new Promise<Response>(done => { finish = done })
      if (url.includes(`/occurrences/${member}/team?`)) return json({ ...page, occurrenceId: member, items: [], total: 0 })
    }); await api.login('ana', 'fixture-password'); show(); await confirm()
    await waitFor(() => expect(writes(fetcher)).toHaveLength(1))
    const signal = writes(fetcher)[0][1].signal
    fireEvent.click(screen.getByRole('button', { name: 'Trocar ocorrência de teste' }))
    expect(await screen.findByText('Nenhuma atribuição nesta página.')).toBeInTheDocument()
    expect(signal.aborted).toBe(true)
    await act(async () => finish(json(result)))
    expect(screen.queryByText(/Liberação confirmada/)).not.toBeInTheDocument()
  })
})
