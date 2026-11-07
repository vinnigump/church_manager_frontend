import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api } from '../api'
import { AuthContext } from '../auth'

const church = '00000000-0000-0000-0000-000000000001'
const id = '00000000-0000-0000-0000-000000000002'
const type = '00000000-0000-0000-0000-000000000003'
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const occurrence = { id, churchId: church, eventTypeId: type, eventTypeVersionId: null, recurrenceRuleId: null, startsAt: '2026-11-09T10:00:00Z', endsAt: '2026-11-09T11:00:00Z', capacity: null, status: 'DRAFT', modality: 'ONLINE', participationMode: 'OPEN_EVENT', checkInRequired: false, firstPublishedAt: null, configured: true, revision: 7 }
const space = { occurrenceId: id, churchId: church, code: 'MAIN', name: 'Salão', revision: 7, defined: true, label: 'Salão' }
const route = `/eventos/igrejas/${church}/ocorrencias/${id}/planejamento/espaco`
const json = (v: unknown) => new Response(JSON.stringify(v))
function backend(handler?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined, permissions = ['EVENT_VIEW', 'EVENT_EDIT']) {
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init)
    if (custom !== undefined) return custom
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-SPACE-CSRF', token: 'fixture' })
    if (url.includes('/authorization?')) return json({ allowed: permissions.includes(new URL(url, 'https://example.test').searchParams.get('permissionCode') ?? '') })
    if (url.endsWith('/space')) return json(init.method === 'PUT' ? { space, conflicts: null } : space)
    if (url.endsWith(`/occurrences/${id}`)) return json(occurrence)
    throw new Error('Unexpected fixture request')
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function show() { return render(<MemoryRouter initialEntries={[route]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>) }
const writes = (fetcher: ReturnType<typeof backend>) => fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')
afterEach(() => api.clear())
describe('espaço do rascunho', () => {
  it('envia PUT com CSRF/revisão reais, aceita no-op e avaliação null sem vazar candidatos', async () => {
    const fetcher = backend(); await api.login('ana', 'fixture-password'); show()
    await screen.findByLabelText('Código do espaço')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar espaço do rascunho' }))
    expect(await screen.findByRole('link', { name: 'Consultar planejamento atualizado' })).toHaveAttribute('href', route.replace('/espaco', ''))
    expect(screen.getByRole('status')).toHaveTextContent('avaliação de sobreposições não foi disponibilizada')
    expect(writes(fetcher)).toHaveLength(1)
    const init = writes(fetcher)[0][1]
    expect(init.headers.get('X-SPACE-CSRF')).toBe('fixture')
    expect(init.headers.get('X-Expected-Revision')).toBe('7')
    expect(JSON.parse(init.body)).toEqual({ code: 'MAIN', name: 'Salão' })
  })
  it.each([{ permissions: ['EVENT_VIEW'] }, { permissions: ['EVENT_EDIT'] }, { permissions: [] }])('não lê nem escreve sem permissões distintas %j', async ({ permissions }) => {
    const fetcher = backend(undefined, permissions); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
  })
  it.each([{ status: 'OPEN' }, { firstPublishedAt: occurrence.startsAt }])('recusa configuração fora de DRAFT sem marco %j', async patch => {
    backend(url => url.endsWith(`/occurrences/${id}`) ? json({ ...occurrence, ...patch }) : undefined); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Somente rascunhos sem marco')
    expect(screen.queryByRole('button', { name: 'Salvar espaço do rascunho' })).not.toBeInTheDocument()
  })
  it('não inicializa formulário com duas revisões consultadas diferentes', async () => {
    backend(url => url.endsWith('/space') ? json({ ...space, revision: 8 }) : undefined); show()
    await screen.findByRole('alert')
    expect(screen.queryByLabelText('Código do espaço')).not.toBeInTheDocument()
  })
  it('limpar ambos os campos envia null/null, não código normalizado ou nome residual', async () => {
    const fetcher = backend((url, init) => init.method === 'PUT' ? json({ space: { ...space, code: null, name: null, defined: false, label: 'A definir', revision: 8 } }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await screen.findByLabelText('Código do espaço')
    fireEvent.change(screen.getByLabelText('Código do espaço'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Nome de exibição (opcional)'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar espaço do rascunho' }))
    await screen.findByRole('link', { name: 'Consultar planejamento atualizado' })
    expect(JSON.parse(writes(fetcher)[0][1].body)).toEqual({ code: null, name: null })
  })
  it('código inválido não é corrigido silenciosamente e nome sem código não é enviado', async () => {
    const fetcher = backend(); show(); await screen.findByLabelText('Código do espaço')
    fireEvent.change(screen.getByLabelText('Código do espaço'), { target: { value: ' MAIN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar espaço do rascunho' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Código do espaço')).toHaveValue(' MAIN')
    fireEvent.change(screen.getByLabelText('Código do espaço'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar espaço do rascunho' }))
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('foco e envio duplo conservam a trava e campos locais enquanto PUT está pendente', async () => {
    let resolve!: (v: Response) => void
    const fetcher = backend((url, init) => init.method === 'PUT' ? new Promise<Response>(done => { resolve = done }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await screen.findByLabelText('Código do espaço')
    const button = screen.getByRole('button', { name: 'Salvar espaço do rascunho' })
    fireEvent.click(button); fireEvent.click(button); fireEvent(window, new Event('focus'))
    await screen.findByLabelText('Código do espaço')
    expect(screen.getByLabelText('Código do espaço')).toHaveValue('MAIN')
    expect(screen.getByRole('button', { name: 'Salvar espaço do rascunho' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => resolve(json({ space, conflicts: null })))
    await screen.findByRole('link', { name: 'Consultar planejamento atualizado' })
  })
  it.each([409, 422, 500])('bloqueia repetição após %s, inclusive por foco', async status => {
    const fetcher = backend((url, init) => init.method === 'PUT' ? new Response(null, { status }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await screen.findByLabelText('Código do espaço')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar espaço do rascunho' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Recarregue e confira')
    fireEvent(window, new Event('focus')); await screen.findByLabelText('Código do espaço')
    expect(screen.getByRole('button', { name: 'Salvar espaço do rascunho' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar espaço e descartar alterações locais' }))
    await screen.findByLabelText('Código do espaço')
    expect(screen.getByRole('button', { name: 'Salvar espaço do rascunho' })).toBeEnabled()
  })
  it('revisão compartilhada alterada por outra edição não substitui campos sujos/snapshot', async () => {
    let revision = 7
    const fetcher = backend(url => url.endsWith('/space') ? json({ ...space, revision }) : url.endsWith(`/occurrences/${id}`) ? json({ ...occurrence, revision }) : undefined)
    show(); await screen.findByLabelText('Código do espaço')
    fireEvent.change(screen.getByLabelText('Código do espaço'), { target: { value: 'main' } })
    revision = 8; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('revisão da ocorrência mudou')
    expect(screen.getByLabelText('Código do espaço')).toHaveValue('main')
    expect(screen.getByRole('button', { name: 'Salvar espaço do rascunho' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(0)
  })
})
