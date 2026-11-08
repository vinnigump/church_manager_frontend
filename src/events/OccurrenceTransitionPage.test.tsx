import { act, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
import type { Occurrence } from './occurrence-api'
import { transitionOccurrence, type Transition } from './lifecycle-api'

const church = '00000000-0000-0000-0000-000000000001'
const id = '00000000-0000-0000-0000-000000000002'
const other = '00000000-0000-0000-0000-000000000003'
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const occurrence: Occurrence = { id, churchId: church, eventTypeId: other, eventTypeVersionId: null, recurrenceRuleId: null, startsAt: '2026-11-09T10:00:00Z', endsAt: '2026-11-09T11:00:00Z', capacity: null, status: 'PUBLISHED', modality: 'ONLINE', participationMode: 'OPEN_EVENT', checkInRequired: false, firstPublishedAt: '2026-11-01T10:00:00Z', configured: true, revision: 7 }
const result = { id, churchId: church, status: 'CANCELLED', revision: 8 }
const json = (v: unknown) => new Response(JSON.stringify(v))
const path = (action: string, churchId = church) => `/eventos/igrejas/${churchId}/ocorrencias/${id}/transicoes/${action}`
function backend(handler?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined, permissions = ['EVENT_VIEW', 'EVENT_CANCEL', 'EVENT_PUBLISH', 'EVENT_EDIT']) {
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init); if (custom !== undefined) return custom
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-LIFECYCLE-CSRF', token: 'fixture' })
    if (url.includes('/authorization?')) return json({ allowed: permissions.includes(new URL(url, 'https://example.test').searchParams.get('permissionCode') ?? '') })
    if (init.method === 'POST') return json(result)
    if (url.endsWith(`/occurrences/${id}`)) return json(occurrence)
    throw new Error('Unexpected fixture request')
  }); vi.stubGlobal('fetch', fetcher); return fetcher
}
function show(action = 'cancel', churchId = church) { return render(<MemoryRouter initialEntries={[path(action, churchId)]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>) }
const writes = (fetcher: ReturnType<typeof backend>) => fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')
afterEach(() => api.clear())

describe('contrato de transições integrado', () => {
  it.each([
    ['cancel', 'DRAFT', 'CANCELLED', 8], ['cancel', 'PUBLISHED', 'CANCELLED', 8], ['cancel', 'CANCELLED', 'CANCELLED', 7],
    ['unpublish', 'PUBLISHED', 'DRAFT', 8], ['unpublish', 'DRAFT', 'DRAFT', 7],
    ['complete', 'IN_PROGRESS', 'COMPLETED', 8], ['complete', 'PUBLISHED', 'COMPLETED', 8],
    ['complete', 'PUBLISHED', 'COMPLETED', 9], ['complete', 'COMPLETED', 'COMPLETED', 7],
  ] as [Transition, string, string, number][])('confirma %s de %s para %s revisão %s', async (action, status, target, revision) => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue({ ...result, status: target, revision, privateUrl: 'private', participant: 'private' })
    expect(await transitionOccurrence(church, { ...occurrence, status }, action, undefined, client)).toEqual({ ...result, status: target, revision })
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/occurrences/${id}/${action}`, { method: 'POST', headers: { 'X-Expected-Revision': '7' }, signal: undefined })
  })
  it.each([null, [], {}, { ...result, id: other }, { ...result, churchId: other }, { ...result, churchId: undefined },
    { ...result, status: 'COMPLETED' }, { ...result, revision: 7 }, { ...result, revision: 9 }, { ...result, revision: '8' },
  ])('recusa resposta incompatível sem afirmar sucesso %j', async response => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(response)
    await expect(transitionOccurrence(church, occurrence, 'cancel', undefined, client)).rejects.toThrow('confirmar')
  })
  it.each(['OPEN', 'CLOSED', 'IN_PROGRESS', 'COMPLETED'])('não cancela estado incompatível %s', async status => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request')
    await expect(transitionOccurrence(church, { ...occurrence, status }, 'cancel', undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
  it.each([{ churchId: other }, { id: '../x' }, { revision: -1 }, { revision: 0.5 }])('recusa snapshot inválido antes da rede %j', async patch => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request')
    await expect(transitionOccurrence(church, { ...occurrence, ...patch }, 'cancel', undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
})
describe('fluxo administrativo de transições', () => {
  it('detalhe expõe somente transição permitida, sem ação de publicar', async () => {
    backend(undefined, ['EVENT_VIEW', 'EVENT_CANCEL'])
    render(<MemoryRouter initialEntries={[`/eventos/igrejas/${church}/ocorrencias/${id}`]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>)
    expect(await screen.findByRole('link', { name: 'Cancelar ocorrência' })).toHaveAttribute('href', path('cancel'))
    expect(screen.queryByRole('link', { name: 'Despublicar ocorrência' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Concluir ocorrência' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Publicar ocorrência' })).not.toBeInTheDocument()
  })
  it('contexto inválido não é usado para verificar permissões', async () => {
    const fetcher = backend(); show('cancel', 'bad')
    expect(await screen.findByRole('alert')).toHaveTextContent('acesso à transição é inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([['cancel', 'Cancelar ocorrência', 'CANCELLED'], ['unpublish', 'Despublicar ocorrência', 'DRAFT'], ['complete', 'Concluir ocorrência', 'COMPLETED']])('confirma explicitamente %s com CSRF e revisão; consulta novamente após sucesso', async (action, label, target) => {
    let status = 'PUBLISHED'; let revision = 7
    const fetcher = backend((url, init) => {
      if (init.method === 'POST') { status = target; revision = 8; return json({ ...result, status }) }
      if (url.endsWith(`/occurrences/${id}`)) return json({ ...occurrence, status, revision })
    }); await api.login('ana', 'fixture-password'); show(action)
    fireEvent.click(await screen.findByRole('button', { name: label }))
    expect(writes(fetcher)).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar transição' }))
    expect(await screen.findByText(`Estado registrado: ${target} · Revisão: 8`)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(action === 'unpublish' ? 'despublicada' : action === 'cancel' ? 'cancelada' : 'concluída')
    expect(writes(fetcher)).toHaveLength(1)
    expect(writes(fetcher)[0][1].headers.get('X-LIFECYCLE-CSRF')).toBe('fixture')
    expect(writes(fetcher)[0][1].headers.get('X-Expected-Revision')).toBe('7')
    expect(writes(fetcher)[0][1].body).toBeUndefined()
    expect(fetcher.mock.calls.filter(([url]) => url.includes('/authorization?')).length).toBeGreaterThanOrEqual(4)
  })
  it.each(['cancel', 'unpublish', 'complete'])('não consulta detalhe sem a permissão própria de %s', async action => {
    const fetcher = backend(undefined, ['EVENT_VIEW']); show(action)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
  })
  it('permissão de escrita não concede leitura nem valida contexto inválido', async () => {
    const fetcher = backend(undefined, ['EVENT_CANCEL']); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
  })
  it.each(['reopen', 'bad'])('ação %s não abre endpoint ou concessão por URL', async action => {
    const fetcher = backend(); show(action)
    expect(await screen.findByRole('alert')).toHaveTextContent('acesso à transição é inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each(['OPEN', 'CLOSED', 'COMPLETED', 'CANCELLED', 'IN_PROGRESS'])('não oferece cancelamento nem reabertura em %s', async status => {
    const fetcher = backend(url => url.endsWith(`/occurrences/${id}`) ? json({ ...occurrence, status }) : undefined); show()
    await screen.findByText(/não está disponível para o estado/)
    expect(screen.queryByRole('button', { name: 'Cancelar ocorrência' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('voltar cancela confirmação; foco invalida confirmação e relê a revisão', async () => {
    let revision = 7
    const fetcher = backend(url => url.endsWith(`/occurrences/${id}`) ? json({ ...occurrence, revision }) : undefined); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar ocorrência' }))
    fireEvent.click(screen.getByRole('button', { name: 'Voltar sem alterar' }))
    expect(screen.queryByRole('button', { name: 'Confirmar transição' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar ocorrência' }))
    revision = 8; fireEvent(window, new Event('focus'))
    await screen.findByRole('button', { name: 'Cancelar ocorrência' })
    expect(screen.queryByRole('button', { name: 'Confirmar transição' })).not.toBeInTheDocument()
    expect(screen.getByText(/Estado registrado:/)).toHaveTextContent('Revisão: 8')
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('foco e clique repetido conservam uma só escrita pendente', async () => {
    let resolve!: (v: Response) => void
    const fetcher = backend((url, init) => init.method === 'POST' ? new Promise<Response>(done => { resolve = done }) : undefined)
    await api.login('ana', 'fixture-password'); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar ocorrência' }))
    const confirm = screen.getByRole('button', { name: 'Confirmar transição' }); fireEvent.click(confirm); fireEvent.click(confirm)
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: 'Cancelar ocorrência' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => resolve(json(result)))
    await screen.findByText('Ocorrência cancelada. O histórico foi preservado.')
  })
  it.each([403, 404, 409, 422, 500])('erro %s bloqueia repetição, inclusive após foco; atualização reautoriza', async status => {
    const fetcher = backend((url, init) => init.method === 'POST' ? new Response(null, { status }) : undefined)
    await api.login('ana', 'fixture-password'); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar ocorrência' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar transição' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Atualize e confira')
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: 'Cancelar ocorrência' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar ocorrência e reavaliar acesso' }))
    expect(await screen.findByRole('button', { name: 'Cancelar ocorrência' })).toBeEnabled()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('resposta incompatível não anuncia sucesso ou repete comando', async () => {
    const fetcher = backend((url, init) => init.method === 'POST' ? json({ ...result, churchId: other }) : undefined)
    await api.login('ana', 'fixture-password'); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar ocorrência' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar transição' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar')
    expect(screen.queryByText('Ocorrência cancelada. O histórico foi preservado.')).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('falha de leitura não oferece confirmação ou escrita', async () => {
    const fetcher = backend(url => url.endsWith(`/occurrences/${id}`) ? new Response(null, { status: 404 }) : undefined); show()
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Cancelar ocorrência' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('perda da permissão por foco remove a confirmação e não repete a operação', async () => {
    let allowed = true
    const fetcher = backend(url => url.includes('/authorization?') ? json({ allowed }) : undefined); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar ocorrência' }))
    allowed = false; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByRole('button', { name: 'Confirmar transição' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('troca de igreja elimina a confirmação do contexto anterior', async () => {
    const fetcher = backend(url => url.endsWith(`/occurrences/${id}`) ? json({ ...occurrence, churchId: url.includes(`/churches/${other}/`) ? other : church }) : undefined)
    render(<MemoryRouter initialEntries={[path('cancel')]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><Link to={path('cancel', other)}>Trocar contexto de teste</Link><App/></AuthContext.Provider></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar ocorrência' }))
    fireEvent.click(screen.getByRole('link', { name: 'Trocar contexto de teste' }))
    await screen.findByRole('button', { name: 'Cancelar ocorrência' })
    expect(screen.queryByRole('button', { name: 'Confirmar transição' })).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([url]) => url.includes(`/churches/${other}/`))).toBe(true)
    expect(writes(fetcher)).toHaveLength(0)
  })
})
