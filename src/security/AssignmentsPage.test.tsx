import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthContext } from '../auth'
import { listAssignments, readAssignment } from './assignments-api'

const denomination = '00000000-0000-0000-0000-000000000001'
const id = '00000000-0000-0000-0000-000000000002'
const route = `/seguranca/denominacoes/${denomination}/atribuicoes`
const account = { id: denomination, personId: id, login: 'ana', status: 'ACTIVE' }
const assignment = { id, userId: id, profileId: denomination, organizationUnitId: denomination, delegationId: null, status: 'ACTIVE', revision: 2, startsAt: '2027-01-01T12:00:00Z', endsAt: null }
const json = (value: unknown) => new Response(JSON.stringify(value))
function server(allowed = true) {
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes('/authorization?')) return json({ allowed })
    if (url.includes('/assignments?')) {
      const page = Number(new URL(url, 'https://example.test').searchParams.get('page'))
      return json({ items: page ? [] : [assignment], page, size: 20, total: 21 })
    }
    return json(assignment)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function show(path = route) {
  render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>)
}
describe('consultas de atribuições', () => {
  it('exige permissão própria, consulta detalhe e distingue estado de autorização', async () => {
    const fetcher = server()
    show()
    fireEvent.click(await screen.findByRole('link', { name: `Consultar atribuição ${id}` }))
    expect(await screen.findByRole('button', { name: 'Atualizar atribuição' })).toBeInTheDocument()
    expect(screen.getByText(/não representam autorização efetiva/)).toBeInTheDocument()
    expect(screen.getByText('Estado registrado: ACTIVE')).toBeInTheDocument()
    expect(screen.getByText('Fim exclusivo: Sem fim definido')).toBeInTheDocument()
    expect(document.title).toBe('Detalhes da atribuição | Church Manager')
    expect(new URL(fetcher.mock.calls[0][0], 'https://example.test').searchParams.get('permissionCode')).toBe('security:assignment:manage')
    expect(screen.queryByRole('button', { name: /conceder|revogar/i })).not.toBeInTheDocument()
  })
  it('recupera página vazia com navegação anterior', async () => {
    server(); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Próxima página' }))
    expect(await screen.findByText('Nenhuma atribuição nesta página.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
    expect(await screen.findByRole('link', { name: `Consultar atribuição ${id}` })).toBeInTheDocument()
  })
  it.each([route, `${route}/${id}`])('nega %s sem GET de domínio', async path => {
    const fetcher = server(false); show(path)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('não consulta rota inválida', () => {
    const fetcher = server(); show(`${route}/invalid`)
    expect(screen.getByRole('alert')).toHaveTextContent('inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([403, 404, 500])('trata erro %s e oferece atualização', async status => {
    const fetcher = server()
    fetcher.mockImplementation(async url => url.includes('/authorization?') ? json({ allowed: true }) : new Response(null, { status }))
    show()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atualizar atribuições' })).toBeInTheDocument()
  })
  it.each([{ revision: -1 }, { startsAt: '2026-02-30T12:00:00Z' }, { delegationId: 'invalid' }, { userId: null }, { endsAt: 'tomorrow' }])('rejeita DTO inválido %j', async change => {
    const fetcher = server()
    fetcher.mockImplementation(async () => json({ ...assignment, ...change }))
    await expect(readAssignment(denomination, id)).rejects.toThrow('validar')
  })
  it('rejeita identidade divergente e página duplicada', async () => {
    const fetcher = server()
    fetcher.mockImplementation(async () => json({ ...assignment, id: denomination }))
    await expect(readAssignment(denomination, id)).rejects.toThrow('validar')
    fetcher.mockImplementation(async () => json({ items: [assignment, assignment], page: 0, size: 20, total: 2 }))
    await expect(listAssignments(denomination)).rejects.toThrow('validar')
  })
  it('projeta apenas campos conhecidos e valida entrada antes da rede', async () => {
    const fetcher = server()
    fetcher.mockImplementation(async () => json({ ...assignment, secret: 'private' }))
    expect(await readAssignment(denomination, id)).toEqual(assignment)
    fetcher.mockClear()
    await expect(listAssignments(denomination, 100001)).rejects.toThrow('validar')
    await expect(readAssignment('invalid', id)).rejects.toThrow('validar')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
