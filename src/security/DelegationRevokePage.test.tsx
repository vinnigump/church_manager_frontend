import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api } from '../api'
import { AuthContext } from '../auth'
import { revokeDelegation } from './delegations-api'

const denomination = '00000000-0000-0000-0000-000000000001'
const id = '00000000-0000-0000-0000-000000000002'
const account = { id: denomination, personId: id, login: 'ana', status: 'ACTIVE' }
const source = { id, profileId: denomination, organizationUnitId: denomination, delegateeUserId: id, status: 'ACTIVE', revision: 3, startsAt: '2026-11-01T12:00:00Z', endsAt: null }
const route = `/seguranca/denominacoes/${denomination}/delegacoes/${id}/revogar`
const json = (value: unknown) => new Response(JSON.stringify(value))
afterEach(() => api.clear())
async function server() {
  let revoked = false
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-CUSTOM-CSRF', token: 'test' })
    if (url.includes('/authorization?')) return json({ allowed: true })
    if (init?.method === 'POST') { revoked = true; return json({ id, status: 'REVOKED', revision: 4 }) }
    return json({ ...source, status: revoked ? 'REVOKED' : 'ACTIVE', revision: revoked ? 4 : 3 })
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
  fireEvent.click(await screen.findByRole('button', { name: 'Revogar fonte de delegação' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar revogação da fonte' }))
}
describe('revogação central de fonte', () => {
  it('confirma explicitamente, usa revisão/CSRF sem corpo e recarrega estado e permissão', async () => {
    const fetcher = await server(); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Revogar fonte de delegação' }))
    expect(screen.getByText(/histórico será preservado/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar revogação da fonte' }))
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
    await confirm()
    expect(await screen.findByText('Estado registrado: REVOKED')).toBeInTheDocument()
    const [url, init] = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(url).toBe(`/api/v1/security/denominations/${denomination}/delegations/${id}/revoke`)
    expect(init?.body).toBeUndefined()
    expect(new Headers(init?.headers).get('X-Expected-Revision')).toBe('3')
    expect(new Headers(init?.headers).get('X-CUSTOM-CSRF')).toBe('test')
    expect(fetcher.mock.calls.filter(([url]) => url.includes('/authorization?'))).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Revogar fonte de delegação' })).not.toBeInTheDocument()
  })
  it('delegado sem gestão central consulta metadados mas não recebe ação nem rota de revogação', async () => {
    const fetcher = await server(); const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url, init) => url.includes('/authorization?') ? json({ allowed: false }) : handler(url, init))
    show(route.replace('/revogar', ''))
    expect(await screen.findByText('Estado registrado: ACTIVE')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Revogar fonte de delegação' })).not.toBeInTheDocument()
  })
  it('acesso direto exige gestão central antes de carregar fonte', async () => {
    const fetcher = await server(); fetcher.mockImplementation(async () => json({ allowed: false }))
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each([403, 404, 409, 422, 500])('erro %s bloqueia até reautorizar e recarregar', async status => {
    const fetcher = await server(); const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url, init) => init?.method === 'POST' ? new Response(null, { status }) : handler(url, init))
    show(); await confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Atualize a fonte')
    expect(screen.getByRole('button', { name: 'Revogar fonte de delegação' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar fonte e permissão' }))
    expect(await screen.findByRole('button', { name: 'Revogar fonte de delegação' })).toBeEnabled()
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  })
  it('foco não libera segundo comando enquanto o primeiro aguarda', async () => {
    const fetcher = await server(); const handler = fetcher.getMockImplementation()!
    let finish!: (response: Response) => void
    fetcher.mockImplementation(async (url, init) => init?.method === 'POST' ? new Promise(resolve => { finish = resolve }) : handler(url, init))
    show(); await confirm()
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: 'Revogar fonte de delegação' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Atualizar fonte e permissão' })).toBeDisabled()
    await act(async () => finish(json({ id, status: 'REVOKED', revision: 4 })))
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  })
  it('perda da própria gestão remove controles após sucesso', async () => {
    const fetcher = await server(); const handler = fetcher.getMockImplementation()!
    let changed = false
    fetcher.mockImplementation(async (url, init) => {
      if (init?.method === 'POST') changed = true
      if (url.includes('/authorization?') && changed) return json({ allowed: false })
      return handler(url, init)
    })
    show(); await confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByRole('button', { name: 'Revogar fonte de delegação' })).not.toBeInTheDocument()
  })
  it.each([{ id: denomination }, { revision: 3 }, { status: 'ACTIVE' }])('rejeita resultado incompatível %j', async change => {
    const fetcher = await server(); fetcher.mockImplementation(async () => json({ id, status: 'REVOKED', revision: 4, ...change }))
    await expect(revokeDelegation(denomination, source)).rejects.toThrow('validar')
  })
  it('rejeita estado/revisão inválidos antes da rede', async () => {
    const fetcher = await server()
    await expect(revokeDelegation(denomination, { ...source, status: 'REVOKED' })).rejects.toThrow('validar')
    await expect(revokeDelegation(denomination, { ...source, revision: Number.MAX_SAFE_INTEGER })).rejects.toThrow('validar')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
