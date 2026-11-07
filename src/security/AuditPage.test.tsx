import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthContext } from '../auth'
import { listAudit } from './audit-api'

const denomination = '00000000-0000-0000-0000-000000000001'
const id = '00000000-0000-0000-0000-000000000002'
const root = `/seguranca/denominacoes/${denomination}`
const route = `${root}/auditoria`
const account = { id, personId: denomination, login: 'ana', status: 'ACTIVE' }
const entry = { id, occurredAt: '2026-11-07T12:00:00Z', actorUserId: id, action: 'PROFILE_PUBLISHED', resourceType: 'ACCESS_ROLE', resourceId: denomination, outcome: 'SUCCESS' }
const json = (value: unknown) => new Response(JSON.stringify(value))
function server(allowed = true) {
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes('/authorization?')) return json({ allowed })
    if (url.endsWith(`/profiles/${denomination}`)) return json({ id: denomination, code: 'READER', name: 'Consulta', scopeType: 'CHURCH', status: 'ACTIVE', revision: 1, publishedVersionId: null })
    if (url.includes('/versions?')) return json({ items: [], page: 0, size: 20, total: 0 })
    const params = new URL(url, 'https://example.test').searchParams
    const page = Number(params.get('page'))
    return json({ items: page ? [] : [entry], page, size: 20, total: 21 })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function show(path = route) {
  render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>)
}
describe('auditoria estruturada denominacional', () => {
  it('exige permissão específica e mostra somente metadados UTC', async () => {
    const fetcher = server(); show()
    expect(await screen.findByRole('heading', { name: 'PROFILE_PUBLISHED' })).toBeInTheDocument()
    expect(screen.getByText('Resultado: Sucesso')).toBeInTheDocument()
    expect(screen.getByText(/não comprova recebimento pelo cliente/)).toBeInTheDocument()
    expect(new URL(fetcher.mock.calls[0][0], 'https://example.test').searchParams.get('permissionCode')).toBe('security:audit:read')
    expect(document.title).toBe('Auditoria de segurança | Church Manager')
  })
  it('nega auditoria mesmo com gestão de perfis e atribuições', async () => {
    const fetcher = server()
    fetcher.mockImplementation(async url => json({ allowed: !url.includes('security%3Aaudit%3Aread') }))
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('filtra tipo e período UTC apenas ao aplicar, recuperando página vazia', async () => {
    const fetcher = server(); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Nenhum registro de auditoria nesta página e filtros.')
    fireEvent.change(screen.getByLabelText('Tipo de recurso'), { target: { value: 'ACCESS_ROLE' } })
    fireEvent.change(screen.getByLabelText('Início inclusivo (UTC)'), { target: { value: '2026-11-07T00:00' } })
    fireEvent.change(screen.getByLabelText('Fim exclusivo (UTC)'), { target: { value: '2026-11-08T00:00' } })
    expect(fetcher).toHaveBeenCalledTimes(3)
    fireEvent.submit(screen.getByRole('button', { name: 'Aplicar filtros de auditoria' }).closest('form')!)
    await screen.findByRole('heading', { name: 'PROFILE_PUBLISHED' })
    const params = new URL(fetcher.mock.calls.at(-1)![0], 'https://example.test').searchParams
    expect(Object.fromEntries(params)).toEqual({ page: '0', size: '20', resourceType: 'ACCESS_ROLE', from: '2026-11-07T00:00:00Z', to: '2026-11-08T00:00:00Z' })
  })
  it('intervalo inválido não consulta', async () => {
    const fetcher = server(); show(); await screen.findByText('Resultado: Sucesso')
    fireEvent.change(screen.getByLabelText('Início inclusivo (UTC)'), { target: { value: '2026-11-08T00:00' } })
    fireEvent.change(screen.getByLabelText('Fim exclusivo (UTC)'), { target: { value: '2026-11-07T00:00' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Aplicar filtros de auditoria' }).closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('posterior')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('contexto de perfil fornece recurso persistido e mantém tipo fixo', async () => {
    server(); show(`${root}/perfis/${denomination}`)
    fireEvent.click(await screen.findByRole('link', { name: 'Consultar auditoria deste recurso' }))
    expect(await screen.findByText('Resultado: Sucesso')).toBeInTheDocument()
    expect(screen.getByLabelText('Tipo de recurso')).toBeDisabled()
    expect(screen.getByText(`Recurso selecionado: Perfil · ${denomination}`)).toBeInTheDocument()
  })
  it.each([403, 422, 500])('erro %s não é tratado como auditoria vazia', async status => {
    const fetcher = server()
    fetcher.mockImplementation(async url => url.includes('/authorization?') ? json({ allowed: true }) : new Response('sensitive-metadata', { status }))
    show()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum registro de auditoria nesta página e filtros.')).not.toBeInTheDocument()
    expect(screen.queryByText('sensitive-metadata')).not.toBeInTheDocument()
  })
  it.each([`${root}/auditoria/INVALID/${id}`, `${root}/auditoria/ACCESS_ROLE/invalid`])('rota %s inválida não consulta', path => {
    const fetcher = server(); show(path)
    expect(screen.getByRole('alert')).toHaveTextContent('inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([{ resourceType: 'PERSON' }, { outcome: 'UNKNOWN' }, { actorUserId: null }, { occurredAt: '2026-02-30T12:00:00Z' }])('rejeita DTO incompatível %j', async change => {
    const fetcher = server(); fetcher.mockImplementation(async () => json({ items: [{ ...entry, ...change }], page: 0, size: 20, total: 1 }))
    await expect(listAudit(denomination)).rejects.toThrow('validar')
  })
  it('descarta campos extras e admite resourceId null', async () => {
    const fetcher = server(); fetcher.mockImplementation(async () => json({ items: [{ ...entry, resourceId: null, metadata: { private: true }, freeText: 'secret' }], page: 0, size: 20, total: 1 }))
    expect((await listAudit(denomination)).items).toEqual([{ ...entry, resourceId: null }])
  })
  it('não aceita duplicatas nem registros fora do recurso filtrado', async () => {
    const fetcher = server(); fetcher.mockImplementation(async () => json({ items: [entry, entry], page: 0, size: 20, total: 2 }))
    await expect(listAudit(denomination)).rejects.toThrow('validar')
    fetcher.mockImplementation(async () => json({ items: [entry], page: 0, size: 20, total: 1 }))
    await expect(listAudit(denomination, { resourceId: id })).rejects.toThrow('validar')
  })
  it('preserva precisão submilissegundo e limite superior exclusivo', async () => {
    const fetcher = server(); fetcher.mockImplementation(async () => json({ items: [{ ...entry, occurredAt: '2026-11-07T12:00:00.000001Z' }], page: 0, size: 20, total: 1 }))
    expect((await listAudit(denomination, { from: '2026-11-07T12:00:00.000001Z', to: '2026-11-07T12:00:00.000002Z' })).items).toHaveLength(1)
    await expect(listAudit(denomination, { to: '2026-11-07T12:00:00.000001Z' })).rejects.toThrow('validar')
  })
  it('valida entrada antes da rede', async () => {
    const fetcher = server()
    await expect(listAudit(denomination, { from: 'invalid' })).rejects.toThrow('validar')
    await expect(listAudit(denomination, { from: entry.occurredAt, to: entry.occurredAt })).rejects.toThrow('validar')
    await expect(listAudit(denomination, {}, 100001)).rejects.toThrow('validar')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
