import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api } from '../api'
import { AuthContext } from '../auth'
import { revokeAssignment } from './assignments-api'

const denomination = '00000000-0000-0000-0000-000000000001'
const id = '00000000-0000-0000-0000-000000000002'
const account = { id: denomination, personId: id, login: 'ana', status: 'ACTIVE' }
const assignment = { id, userId: id, profileId: denomination, organizationUnitId: denomination, delegationId: null, status: 'ACTIVE', revision: 7, startsAt: '2026-11-01T12:00:00Z', endsAt: null }
const route = `/seguranca/denominacoes/${denomination}/atribuicoes/${id}/revogar`
const json = (value: unknown) => new Response(JSON.stringify(value))
afterEach(() => api.clear())
async function server() {
  let revoked = false
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-CUSTOM-CSRF', token: 'test' })
    if (url.includes('/authorization?')) return json({ allowed: true })
    if (init?.method === 'POST') { revoked = true; return json({ id, status: 'REVOKED', revision: 8 }) }
    return json({ ...assignment, status: revoked ? 'REVOKED' : 'ACTIVE', revision: revoked ? 8 : 7 })
  })
  vi.stubGlobal('fetch', fetcher)
  await api.login('ana', 'test-password')
  fetcher.mockClear()
  return fetcher
}
function show(path = route) {
  render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>)
}
async function confirm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Revogar atribuição' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar revogação' }))
}
describe('revogação central de atribuição', () => {
  it('exige confirmação, envia revisão e CSRF sem corpo e reconsulta permissão/dados', async () => {
    const fetcher = await server(); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Revogar atribuição' }))
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar revogação' }))
    await confirm()
    expect(await screen.findByText('Estado registrado: REVOKED')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revogar atribuição' })).not.toBeInTheDocument()
    const [url, init] = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(url).toBe(`/api/v1/security/denominations/${denomination}/assignments/${id}/revoke`)
    expect(init?.body).toBeUndefined()
    expect(new Headers(init?.headers).get('X-Expected-Revision')).toBe('7')
    expect(new Headers(init?.headers).get('X-CUSTOM-CSRF')).toBe('test')
    expect(fetcher.mock.calls.filter(([url]) => url.includes('/authorization?'))).toHaveLength(2)
  })
  it('nega permissão central antes de consultar detalhe', async () => {
    const fetcher = await server()
    fetcher.mockImplementation(async () => json({ allowed: false }))
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Revogar atribuição' })).not.toBeInTheDocument()
  })
  it('remove controle ao perder a própria permissão após comando', async () => {
    const fetcher = await server()
    const handler = fetcher.getMockImplementation()!
    let changed = false
    fetcher.mockImplementation(async (url, init) => {
      if (init?.method === 'POST') changed = true
      if (url.includes('/authorization?') && changed) return json({ allowed: false })
      return handler(url, init)
    })
    show(); await confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByRole('button', { name: 'Revogar atribuição' })).not.toBeInTheDocument()
  })
  it.each([403, 404, 409, 422, 500])('falha %s bloqueia repetição até reconciliação', async status => {
    const fetcher = await server()
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url, init) => init?.method === 'POST' ? new Response(null, { status }) : handler(url, init))
    show(); await confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Atualize a atribuição')
    expect(screen.getByRole('button', { name: 'Revogar atribuição' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar atribuição e permissão' }))
    expect(await screen.findByRole('button', { name: 'Revogar atribuição' })).toBeEnabled()
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  })
  it('trava persiste ao foco reautorizar enquanto comando está pendente', async () => {
    const fetcher = await server()
    const handler = fetcher.getMockImplementation()!
    let finish!: (response: Response) => void
    fetcher.mockImplementation(async (url, init) => init?.method === 'POST' ? new Promise(resolve => { finish = resolve }) : handler(url, init))
    show(); await confirm()
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: 'Revogar atribuição' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Atualizar atribuição e permissão' })).toBeDisabled()
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    await act(async () => finish(json({ id, status: 'REVOKED', revision: 8 })))
  })
  it.each([{ id: denomination }, { revision: 7 }, { status: 'ACTIVE' }])('rejeita resultado incompatível %j', async change => {
    const fetcher = await server()
    fetcher.mockImplementation(async () => json({ id, revision: 8, status: 'REVOKED', ...change }))
    await expect(revokeAssignment(denomination, assignment)).rejects.toThrow('validar')
  })
  it('não envia estado ou revisão inválidos', async () => {
    const fetcher = await server()
    await expect(revokeAssignment(denomination, { ...assignment, status: 'REVOKED' })).rejects.toThrow('validar')
    await expect(revokeAssignment(denomination, { ...assignment, revision: Number.MAX_SAFE_INTEGER })).rejects.toThrow('validar')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
