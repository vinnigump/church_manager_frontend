import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthContext, AuthProvider } from '../auth'
import { listDelegations, readDelegation } from './delegations-api'

const denomination = '00000000-0000-0000-0000-000000000001'
const id = '00000000-0000-0000-0000-000000000002'
const route = `/seguranca/denominacoes/${denomination}/delegacoes`
const account = { id, personId: denomination, login: 'ana', status: 'ACTIVE' }
const source = { id, profileId: denomination, organizationUnitId: denomination, delegateeUserId: id, status: 'REVOKED', revision: 2, startsAt: '2026-11-01T12:00:00Z', endsAt: null }
const json = (value: unknown) => new Response(JSON.stringify(value))
function server(allowed = true) {
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes('/authorization?')) return json({ allowed })
    if (url.includes('/delegations?')) {
      const page = Number(new URL(url, 'https://example.test').searchParams.get('page'))
      return json({ items: page ? [] : [source], page, size: 20, total: 21 })
    }
    return json(source)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function show(path = route) {
  render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>)
}
describe('consulta de fontes de delegação', () => {
  it('lista com permissão central e navega para histórico sem declarar fonte operacional', async () => {
    const fetcher = server(); show()
    fireEvent.click(await screen.findByRole('link', { name: `Consultar fonte ${id}` }))
    expect(await screen.findByRole('button', { name: 'Atualizar fonte de delegação' })).toBeInTheDocument()
    expect(screen.getByText('Estado registrado: REVOKED')).toBeInTheDocument()
    expect(screen.getByText(/não concede gestão denominacional/)).toBeInTheDocument()
    expect(new URL(fetcher.mock.calls[0][0], 'https://example.test').searchParams.get('permissionCode')).toBe('security:assignment:manage')
    expect(document.title).toBe('Detalhes da fonte de delegação | Church Manager')
    expect(screen.queryByRole('button', { name: /conceder|revogar/i })).not.toBeInTheDocument()
  })
  it('detalhe próprio usa autorização do GET mesmo sem gestão central', async () => {
    const fetcher = server(false); show(`${route}/${id}`)
    expect(await screen.findByText('Estado registrado: REVOKED')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Fontes de delegação da denominação' })).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([url]) => url.includes('/delegations?'))).toBe(false)
  })
  it('sem permissão central não lista fontes', async () => {
    const fetcher = server(false); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('visitante não consulta metadados', () => {
    const fetcher = server()
    render(<MemoryRouter initialEntries={[`${route}/${id}`]}><AuthProvider><App/></AuthProvider></MemoryRouter>)
    expect(screen.getByLabelText('Login')).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('pagina e recupera página vazia', async () => {
    server(); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Próxima página' }))
    expect(await screen.findByText('Nenhuma fonte de delegação nesta página.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
    expect(await screen.findByRole('link', { name: `Consultar fonte ${id}` })).toBeInTheDocument()
  })
  it.each([403, 404, 500])('erro %s do detalhe não revela proprietário', async status => {
    const fetcher = server(false)
    fetcher.mockImplementation(async url => url.includes('/authorization?') ? json({ allowed: false }) : new Response('private-owner', { status }))
    show(`${route}/${id}`)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('private-owner')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atualizar fonte de delegação' })).toBeInTheDocument()
  })
  it.each([{ revision: -1 }, { delegateeUserId: null }, { endsAt: 'invalid' }, { startsAt: '2026-02-30T12:00:00Z' }])('rejeita DTO inválido %j', async change => {
    const fetcher = server(); fetcher.mockImplementation(async () => json({ ...source, ...change }))
    await expect(readDelegation(denomination, id)).rejects.toThrow('validar')
  })
  it('rejeita identidade divergente e duplicatas na página', async () => {
    const fetcher = server(); fetcher.mockImplementation(async () => json({ ...source, id: denomination }))
    await expect(readDelegation(denomination, id)).rejects.toThrow('validar')
    fetcher.mockImplementation(async () => json({ items: [source, source], page: 0, size: 20, total: 2 }))
    await expect(listDelegations(denomination)).rejects.toThrow('validar')
  })
  it('projeta DTO e rejeita entradas antes da rede', async () => {
    const fetcher = server(); fetcher.mockImplementation(async () => json({ ...source, private: true }))
    expect(await readDelegation(denomination, id)).toEqual(source)
    fetcher.mockClear()
    await expect(listDelegations(denomination, 100001)).rejects.toThrow('validar')
    await expect(readDelegation('invalid', id)).rejects.toThrow('validar')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
