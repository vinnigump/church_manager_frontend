import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
import { listAudit } from './audit-api'

const denomination = '00000000-0000-0000-0000-000000000001', id = '00000000-0000-0000-0000-000000000002', link = '00000000-0000-0000-0000-000000000003'
const account = { id, personId: id, login: 'ana', status: 'ACTIVE' }
const entry = { id, occurredAt: '2032-01-01T13:00:00Z', actorUserId: id, action: 'GROUP_MEMBER_LINKED', resourceType: 'GROUP_MEMBERSHIP', resourceId: link, outcome: 'SUCCESS' }
const domain = { ...entry, resourceType: 'EVENT_TYPE', action: 'EVENT_TYPE_CREATED' }
const json = (v: unknown) => new Response(JSON.stringify(v))
const page = (items: unknown[], page = 0, total = items.length) => ({ items, page, size: 20, total })
const route = `/seguranca/denominacoes/${denomination}/auditoria`
function show(path = route) { render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>) }
afterEach(() => api.clear())

describe('auditoria1.6 de vínculos de grupos', () => {
  it.each(['GROUP_MEMBER_LINKED', 'GROUP_MEMBER_RELEASED'])('consulta %s explicitamente e nunca propaga motivo/metadata', async action => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue(page([{ ...entry, action, reason: 'private', metadata: { reason: 'private' }, personName: 'private' }]))
    expect((await listAudit(denomination, { resourceType: 'GROUP_MEMBERSHIP', resourceId: link }, 0, undefined, client)).items).toEqual([{ ...entry, action }])
    expect(request).toHaveBeenCalledWith(`/security/denominations/${denomination}/audit?page=0&size=20&resourceType=GROUP_MEMBERSHIP&resourceId=${link}`, { signal: undefined })
  })
  it.each([{}, { resourceId: link }, { resourceType: 'EVENT_RECURRENCE_RULE' as const }, { resourceType: 'AUDIT_LOG' as const }])('recusa vínculo sem filtro exato %j', async filters => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(page([entry]))
    await expect(listAudit(denomination, filters, 0, undefined, client)).rejects.toThrow('validar')
  })
  it.each([{ action: 'GROUP_MEMBER_REQUESTED' }, { action: 'GROUP_MEMBER_APPROVED' }, { outcome: 'DENIED' }, { resourceId: null }, { actorUserId: null }])('recusa par/ator/resultado incompatível %j', async patch => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(page([{ ...entry, ...patch }]))
    await expect(listAudit(denomination, { resourceType: 'GROUP_MEMBERSHIP' }, 0, undefined, client)).rejects.toThrow('validar')
  })
  it('mantém recurso/contexto filtrado sem retornar registro de outro vínculo', async () => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(page([entry]))
    await expect(listAudit(denomination, { resourceType: 'GROUP_MEMBERSHIP', resourceId: id }, 0, undefined, client)).rejects.toThrow('validar')
  })
  it('selecionar não consulta; aplicar/paginar/limpar preserva contrato sem expor motivo', async () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({ ...entry, id: `10000000-0000-0000-0000-${String(index).padStart(12, '0')}` }))
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes('/authorization?')) return json({ allowed: true })
      const params = new URL(url, 'https://example.test').searchParams, n = Number(params.get('page'))
      if (params.get('resourceType') !== 'GROUP_MEMBERSHIP') return json(page([domain]))
      return json(page(n ? [{ ...entry, reason: 'private' }] : rows, n, 21))
    }); vi.stubGlobal('fetch', fetcher); show(); await screen.findByRole('heading', { name: 'EVENT_TYPE_CREATED' })
    const calls = fetcher.mock.calls.length
    fireEvent.change(screen.getByLabelText('Tipo de recurso'), { target: { value: 'GROUP_MEMBERSHIP' } })
    expect(fetcher).toHaveBeenCalledTimes(calls)
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros de auditoria' }))
    await screen.findAllByRole('heading', { name: 'GROUP_MEMBER_LINKED' })
    expect(screen.getByRole('note')).toHaveTextContent('motivo privado pertence ao histórico autorizado')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByRole('heading', { name: 'GROUP_MEMBER_LINKED' })
    expect(new URL(fetcher.mock.calls.at(-1)![0], 'https://example.test').searchParams.get('page')).toBe('1')
    expect(screen.queryByText('private')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tipo de recurso'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros de auditoria' }))
    await screen.findByRole('heading', { name: 'EVENT_TYPE_CREATED' })
    expect(new URL(fetcher.mock.calls.at(-1)![0], 'https://example.test').searchParams.has('resourceType')).toBe(false)
  })
  it('rota contextual exige permissão de auditoria própria e conserva tipo/ID', async () => {
    const fetcher = vi.fn(async (url: string) => url.includes('/authorization?') ? json({ allowed: true }) : json(page([entry])))
    vi.stubGlobal('fetch', fetcher); show(`${route}/GROUP_MEMBERSHIP/${link}`)
    await screen.findByRole('heading', { name: 'GROUP_MEMBER_LINKED' })
    expect(screen.getByLabelText('Tipo de recurso')).toBeDisabled()
    expect(screen.getByText(`Recurso selecionado: Vínculo de grupo · ${link}`)).toBeInTheDocument()
    expect(new URL(fetcher.mock.calls[0][0], 'https://example.test').searchParams.get('permissionCode')).toBe('security:audit:read')
  })
  it('gestão de participantes não concede auditoria denominacional', async () => {
    const fetcher = vi.fn(async (url: string) => json({ allowed: new URL(url, 'https://example.test').searchParams.get('permissionCode') === 'GROUP_MEMBERSHIP_MANAGE' }))
    vi.stubGlobal('fetch', fetcher); show(`${route}/GROUP_MEMBERSHIP/${link}`)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls).toHaveLength(1)
  })
  it('revogação em foco remove metadados do vínculo', async () => {
    let allowed = true
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/authorization?') ? json({ allowed }) : json(page([entry]))))
    show(`${route}/GROUP_MEMBERSHIP/${link}`); await screen.findByRole('heading', { name: 'GROUP_MEMBER_LINKED' })
    allowed = false; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'GROUP_MEMBER_LINKED' })).not.toBeInTheDocument())
  })
})
