import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
import { listAudit } from './audit-api'

const denomination = '00000000-0000-0000-0000-000000000001'
const id = '00000000-0000-0000-0000-000000000002'
const series = '00000000-0000-0000-0000-000000000003'
const account = { id, personId: id, login: 'ana', status: 'ACTIVE' }
const entry = { id, occurredAt: '2032-01-01T13:00:00Z', actorUserId: id, action: 'EVENT_SERIES_UPDATED', resourceType: 'EVENT_RECURRENCE_RULE', resourceId: series, outcome: 'SUCCESS' }
const domain = { ...entry, resourceType: 'EVENT_TYPE', action: 'EVENT_TYPE_CREATED' }
const page = (items: unknown[], page = 0, total = items.length) => ({ items, page, size: 20, total })
const json = (v: unknown) => new Response(JSON.stringify(v))
const route = `/seguranca/denominacoes/${denomination}/auditoria`
function show(path = route) { return render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>) }
function server(handler?: (url: string) => Response | undefined) {
  const fetcher = vi.fn(async (url: string) => {
    const custom = handler?.(url); if (custom !== undefined) return custom
    if (url.includes('/authorization?')) return json({ allowed: true })
    const params = new URL(url, 'https://example.test').searchParams
    const index = Number(params.get('page'))
    return json(page(index ? [] : [params.get('resourceType') === 'EVENT_RECURRENCE_RULE' ? entry : domain], index, 21))
  }); vi.stubGlobal('fetch', fetcher); return fetcher
}
afterEach(() => api.clear())

describe('auditoria1.5: série somente por filtro explícito', () => {
  it('envia filtro contextual e projeta metadados sem conteúdo de edição', async () => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue(page([{ ...entry, metadata: { before: 'private' }, justification: 'private', selections: ['private'] }]))
    expect((await listAudit(denomination, { resourceType: 'EVENT_RECURRENCE_RULE', resourceId: series }, 0, undefined, client)).items).toEqual([entry])
    expect(request).toHaveBeenCalledWith(`/security/denominations/${denomination}/audit?page=0&size=20&resourceType=EVENT_RECURRENCE_RULE&resourceId=${series}`, { signal: undefined })
  })
  it.each([{}, { resourceId: series }, { resourceType: 'EVENT_TYPE' as const }])('rejeita série em consulta sem opt-in %j', async filters => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(page([entry]))
    await expect(listAudit(denomination, filters, 0, undefined, client)).rejects.toThrow('validar')
  })
  it.each([{ action: 'EVENT_SERIES_CREATED' }, { action: 'EVENT_SERIES_UPDATED', outcome: 'DENIED' }, { action: 'ARBITRARY' }, { resourceId: null }, { actorUserId: null }, { resourceType: 'EVENT_TYPE' }])('rejeita par/ator/resultado incompatível %j', async patch => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(page([{ ...entry, ...patch }]))
    await expect(listAudit(denomination, { resourceType: 'EVENT_RECURRENCE_RULE' }, 0, undefined, client)).rejects.toThrow('validar')
  })
  it('recusa registro de outra série sob filtro fixo', async () => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(page([entry]))
    await expect(listAudit(denomination, { resourceType: 'EVENT_RECURRENCE_RULE', resourceId: id }, 0, undefined, client)).rejects.toThrow('validar')
  })
  it.each(['PROFILE_READ_DENIED', 'ASSIGNMENT_READ_DENIED', 'DELEGATED_ASSIGNMENT_DENIED'])('aceita recusa nova %s somente no contrato explícito', async action => {
    const client = new ApiClient(); const denial = { ...entry, resourceType: 'AUDIT_LOG', action, outcome: 'DENIED', resourceId: null }
    vi.spyOn(client, 'request').mockResolvedValue(page([denial]))
    expect((await listAudit(denomination, { resourceType: 'AUDIT_LOG' }, 0, undefined, client)).items).toEqual([denial])
    await expect(listAudit(denomination, {}, 0, undefined, client)).rejects.toThrow('validar')
  })
  it('selecionar sem aplicar não consulta; paginação conserva opt-in e foco reautoriza voltando ao padrão existente', async () => {
    const fetcher = server(); show(); await screen.findByRole('heading', { name: 'EVENT_TYPE_CREATED' })
    const calls = fetcher.mock.calls.length
    fireEvent.change(screen.getByLabelText('Tipo de recurso'), { target: { value: 'EVENT_RECURRENCE_RULE' } })
    expect(fetcher).toHaveBeenCalledTimes(calls)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros de auditoria' }))
    expect(await screen.findByRole('heading', { name: 'EVENT_SERIES_UPDATED' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('somente edições seletivas de séries anuais')
    expect(screen.getByText('Tipo de recurso: Edição de série anual')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Nenhum registro de auditoria nesta página e filtros.')
    expect(new URL(fetcher.mock.calls.at(-1)![0], 'https://example.test').searchParams.get('page')).toBe('1')
    fireEvent(window, new Event('focus')); await screen.findByRole('button', { name: 'Aplicar filtros de auditoria' })
    // Existing audit workspace remounts on reauthorization: default query again,
    // never restoring an unsubmitted selector as an applied sensitive filter.
    await screen.findByRole('heading', { name: 'EVENT_TYPE_CREATED' })
    expect(new URL(fetcher.mock.calls.at(-1)![0], 'https://example.test').searchParams.has('resourceType')).toBe(false)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
  it('rota de série fixa tipo/ID e mantém permissão denominacional específica', async () => {
    const fetcher = server(); show(`${route}/EVENT_RECURRENCE_RULE/${series}`)
    expect(await screen.findByRole('heading', { name: 'EVENT_SERIES_UPDATED' })).toBeInTheDocument()
    expect(screen.getByLabelText('Tipo de recurso')).toBeDisabled()
    expect(screen.getByText(`Recurso selecionado: Edição de série anual · ${series}`)).toBeInTheDocument()
    expect(new URL(fetcher.mock.calls[0][0], 'https://example.test').searchParams.get('permissionCode')).toBe('security:audit:read')
  })
  it('perda de acesso remove dados anteriormente consultados', async () => {
    let allowed = true
    server(url => url.includes('/authorization?') ? json({ allowed }) : undefined); show(`${route}/EVENT_RECURRENCE_RULE/${series}`)
    await screen.findByRole('heading', { name: 'EVENT_SERIES_UPDATED' })
    allowed = false; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'EVENT_SERIES_UPDATED' })).not.toBeInTheDocument())
  })
})
