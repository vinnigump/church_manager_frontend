import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api } from '../api'
import { AuthContext } from '../auth'

const church = '00000000-0000-0000-0000-000000000001', id = '00000000-0000-0000-0000-000000000002'
const type = '00000000-0000-0000-0000-000000000003', other = '00000000-0000-0000-0000-000000000004'
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const audience = { visibility: 'CHURCH', churchLinkRequired: false, activeMembershipRequired: false, minimumAge: null, maximumAge: null, functionIds: [], ministryIds: [], departmentIds: [] }
const value = { id, churchId: church, eventTypeId: type, eventTypeVersionId: null, recurrenceRuleId: null, name: 'Encontro de famílias', location: 'Salão principal',
  startsAt: '2035-01-01T10:00:00.123456Z', endsAt: '2035-01-01T11:00:00Z', capacity: null, modality: 'IN_PERSON', participationMode: 'REGISTRATION_REQUIRED',
  checkInRequired: true, draft: true, status: 'DRAFT', revision: 4, audience }
const base = `/eventos/igrejas/${church}/cadastro`
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
type Handler = (url: string, init: RequestInit) => Response | Promise<Response> | undefined
function backend(handler?: Handler, permissions = ['EVENT_VIEW', 'EVENT_CREATE', 'EVENT_EDIT']) {
  const fetcher = vi.fn(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init); if (custom !== undefined) return custom
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-TEST-CSRF', token: 'synthetic-csrf' })
    if (url.includes('/authorization?')) return json({ allowed: permissions.includes(new URL(url, 'https://example.test').searchParams.get('permissionCode') ?? '') })
    if (url.includes('/types?')) return json({ items: [{ id: type, name: 'Encontro local', enabled: true, scopeType: 'CHURCH', mandatory: false }], page: 0, size: 20, total: 1 })
    if (url.includes('/records?')) return json({ items: [value], page: 0, size: 20, total: 1 })
    if (url.endsWith(`/records/${id}`) && !init.method) return json(value)
    if (['POST', 'PUT'].includes(init.method ?? '')) { const body = JSON.parse(String(init.body)); return json({ ...value, ...body, status: body.draft ? 'DRAFT' : 'AVAILABLE', revision: init.method === 'POST' ? 1 : 5 }, init.method === 'POST' ? 201 : 200) }
    throw new Error('Unexpected fixture request')
  })
  vi.stubGlobal('fetch', fetcher); return fetcher
}
const writes = (fetcher: ReturnType<typeof backend>) => fetcher.mock.calls.filter(([, init]) => ['POST', 'PUT'].includes(init?.method ?? ''))
function SwitchChurch() { const navigate = useNavigate(); return <button onClick={() => navigate(`/eventos/igrejas/${other}/cadastro`)}>Trocar igreja</button> }
function tree(path: string, current = account) { return <MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account: current, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><SwitchChurch/><App/></AuthContext.Provider></MemoryRouter> }
const login = () => api.login('ana', 'synthetic-password')
async function fill() {
  await screen.findByRole('option', { name: 'Encontro local' })
  for (const [label, content] of [['Nome do evento', 'Culto de domingo'], ['Local ou endereço de acesso público', 'Templo'], ['Tipo de evento', type],
    ['Início', '2035-01-01T09:00:00'], ['Término', '2035-01-01T11:00:00'], ['Fuso dos horários', '-03:00'], ['Modalidade', 'IN_PERSON'],
    ['Como as pessoas participam?', 'OPEN_EVENT'], ['Quem pode ver o evento?', 'PUBLIC']]) fireEvent.change(screen.getByLabelText(label), { target: { value: content } })
}
afterEach(() => api.clear())
describe('cadastro v4 por API real integrada (testes de componente com transporte simulado)', () => {
  it('lista nomes e estados e não oferece publicação', async () => {
    backend(); render(tree(base))
    expect(await screen.findByRole('link', { name: 'Ver evento Encontro de famílias' })).toHaveAttribute('href', `${base}/${id}`)
    expect(screen.getByText('Rascunho')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Criar evento' })).toHaveAttribute('href', `${base}/novo`)
    expect(screen.queryByRole('link', { name: /publicar|calendário anual/i })).not.toBeInTheDocument()
  })
  it.each([['Salvar rascunho', true], ['Salvar e disponibilizar', false]] as const)('cria pelo botão %s com audiência, CSRF e fuso, sem publicar', async (button, draft) => {
    const fetcher = backend(); await login(); render(tree(`${base}/novo`)); await fill()
    fireEvent.click(screen.getByRole('button', { name: button }))
    await screen.findByRole('link', { name: 'Ver evento salvo' })
    expect(writes(fetcher)).toHaveLength(1)
    const [url, init] = writes(fetcher)[0]; expect(url).toMatch(/\/records$/)
    expect(new Headers(init?.headers).get('X-TEST-CSRF')).toBe('synthetic-csrf')
    expect(JSON.parse(String(init?.body))).toMatchObject({ draft, name: 'Culto de domingo', location: 'Templo', startsAt: '2035-01-01T09:00:00-03:00',
      participationMode: 'OPEN_EVENT', checkInRequired: false, audience: { visibility: 'PUBLIC' } })
    expect(fetcher.mock.calls.some(([url]) => /\/publish|\/calendars/.test(url))).toBe(false)
  })
  it('preserva política, revisão e microssegundos ao editar um evento disponível', async () => {
    const restricted = { ...value, draft: false, status: 'AVAILABLE', audience: { ...audience, visibility: 'ELIGIBLE_AUDIENCE', ministryIds: [other], minimumAge: 18 } }
    const fetcher = backend((url, init) => url.endsWith(`/records/${id}`) && !init.method ? json(restricted) : undefined)
    await login(); render(tree(`${base}/${id}/editar`)); await screen.findByDisplayValue(value.name)
    fireEvent.change(screen.getByLabelText('Nome do evento'), { target: { value: 'Encontro atualizado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e disponibilizar' }))
    await screen.findByRole('link', { name: 'Ver evento salvo' })
    const [, init] = writes(fetcher)[0]
    expect(new Headers(init?.headers).get('X-Expected-Revision')).toBe('4')
    expect(JSON.parse(String(init?.body))).toMatchObject({ startsAt: value.startsAt, audience: restricted.audience })
  })
  it('nega edição e criação sem permissão, sem consultar eventos/tipos', async () => {
    const fetcher = backend(undefined, []); render(tree(`${base}/novo`))
    await screen.findByText('Acesso não autorizado para este recurso.')
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([url]) => /\/types|\/records/.test(url))).toBe(false)
  })
  it('erros de catálogo não inventam tipos ou liberam criação', async () => {
    const fetcher = backend(url => url.includes('/types?') ? new Response(null, { status: 403 }) : undefined)
    render(tree(`${base}/novo`)); await screen.findByText('Você não tem permissão ou a proteção da sessão expirou.')
    expect(screen.queryByLabelText('Tipo de evento')).not.toBeInTheDocument(); expect(writes(fetcher)).toHaveLength(0)
  })
  it.each([409, 422, 500])('bloqueia nova gravação após %s, inclusive após foco', async status => {
    const fetcher = backend((_url, init) => init.method === 'PUT' ? new Response(null, { status }) : undefined)
    await login(); render(tree(`${base}/${id}/editar`)); await screen.findByDisplayValue(value.name)
    fireEvent.change(screen.getByLabelText('Nome do evento'), { target: { value: 'Alteração' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await screen.findByText(/Recarregue e confira os dados/)
    fireEvent.focus(window); await screen.findByDisplayValue('Alteração')
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled(); expect(writes(fetcher)).toHaveLength(1)
  })
  it('mantém trava contra envio duplicado durante foco e resposta pendente', async () => {
    let finish!: (response: Response) => void
    const fetcher = backend((_url, init) => init.method === 'POST' ? new Promise<Response>(done => { finish = done }) : undefined)
    await login(); render(tree(`${base}/novo`)); await fill()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' })); fireEvent.focus(window)
    await screen.findByDisplayValue('Culto de domingo')
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled()
    const body = JSON.parse(String(writes(fetcher)[0][1]?.body))
    await act(async () => finish(json({ ...value, ...body, status: 'DRAFT', revision: 1 })))
    await screen.findByText('Rascunho salvo.'); expect(writes(fetcher)).toHaveLength(1)
  })
  it('mantém campos sujos e exige reconciliação de revisão ao recuperar foco', async () => {
    let revision = 4
    backend((url, init) => url.endsWith(`/records/${id}`) && !init.method ? json({ ...value, revision }) : undefined)
    render(tree(`${base}/${id}/editar`)); await screen.findByDisplayValue(value.name)
    fireEvent.change(screen.getByLabelText('Nome do evento'), { target: { value: 'Meu rascunho local' } })
    revision = 5; fireEvent.focus(window)
    await screen.findByText('O evento mudou. Descarte as alterações e recarregue antes de salvar.')
    expect(screen.getByDisplayValue('Meu rascunho local')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled()
  })
  it('estado finalizado é consultável e não mostra editor', async () => {
    backend((url, init) => url.endsWith(`/records/${id}`) && !init.method ? json({ ...value, draft: false, status: 'COMPLETED' }) : undefined)
    render(tree(`${base}/${id}/editar`)); await screen.findByText('O estado do evento não permite edição por este cadastro.')
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })
  it('detalhe oferece período de inscrição e retorno ao novo cadastro sem publicação', async () => {
    backend(); render(tree(`${base}/${id}`))
    expect(await screen.findByRole('link', { name: 'Editar evento' })).toHaveAttribute('href', `${base}/${id}/editar`)
    expect(screen.getByRole('link', { name: 'Consultar período de inscrição' })).toHaveAttribute('href', `/eventos/igrejas/${church}/ocorrencias/${id}/janela-inscricao?retorno=cadastro`)
    expect(screen.queryByRole('link', { name: /publicar/i })).not.toBeInTheDocument()
  })
  it('descarta resposta anterior ao trocar igreja', async () => {
    let finish!: (response: Response) => void
    backend(url => url.includes(`/churches/${church}/records?`) ? new Promise<Response>(done => { finish = done }) : url.includes(`/churches/${other}/records?`) ? json({ items: [], page: 0, size: 20, total: 0 }) : undefined)
    render(tree(base)); await waitFor(() => expect(finish).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: 'Trocar igreja' })); await screen.findByText('Nenhum evento cadastrado.')
    await act(async () => finish(json({ items: [value], page: 0, size: 20, total: 1 })))
    expect(screen.queryByText(value.name)).not.toBeInTheDocument()
  })
  it('nova sessão da mesma conta descarta campos locais e cancela a gravação anterior', async () => {
    let finish!: (response: Response) => void
    const fetcher = backend((_url, init) => init.method === 'POST' ? new Promise<Response>(done => { finish = done }) : undefined)
    await login(); const view = render(tree(`${base}/novo`)); await fill()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(finish).toBeDefined())
    const call = writes(fetcher)[0][1]!
    view.rerender(tree(`${base}/novo`, { ...account }))
    await screen.findByRole('option', { name: 'Encontro local' })
    expect(screen.getByLabelText('Nome do evento')).toHaveValue('')
    expect(call.signal?.aborted).toBe(true)
    await act(async () => finish(json({ ...value, ...JSON.parse(String(call.body)), status: 'DRAFT', revision: 1 })))
    expect(screen.queryByText('Rascunho salvo.')).not.toBeInTheDocument()
  })
  it('revogação ao foco remove o formulário e impede novos comandos', async () => {
    backend(); render(tree(`${base}/novo`)); await fill()
    const fetcher = backend(undefined, [])
    fireEvent.focus(window); await screen.findByText('Acesso não autorizado para este recurso.')
    expect(screen.queryByRole('form')).not.toBeInTheDocument(); expect(writes(fetcher)).toHaveLength(0)
  })
  it('trata lista vazia e paginação sem filtrar apenas a página atual', async () => {
    const fetcher = backend(url => url.includes('/records?') ? json({ items: [], page: Number(new URL(url, 'https://example.test').searchParams.get('page')), size: 20, total: 21 }) : undefined)
    render(tree(base)); await screen.findByText('Nenhum evento cadastrado.')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('21 eventos · Página 2')
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/records?page=1&size=20'))).toBe(true)
  })
  it('falha ao consultar mantém mensagem segura e não mostra dados inventados', async () => {
    backend(url => url.includes('/records?') ? new Response('private-secret', { status: 500 }) : undefined)
    render(tree(base)); await screen.findByText('Não foi possível concluir a solicitação.')
    expect(screen.queryByText('private-secret')).not.toBeInTheDocument()
    expect(screen.queryByText(value.name)).not.toBeInTheDocument()
  })
  it('valida o período e preserva campos antes de qualquer gravação', async () => {
    const fetcher = backend(); await login(); render(tree(`${base}/novo`)); await fill()
    fireEvent.change(screen.getByLabelText('Término'), { target: { value: '2034-01-01T11:00:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e disponibilizar' }))
    await screen.findByText(/Revise a configuração:/)
    expect(writes(fetcher)).toHaveLength(0); expect(screen.getByLabelText('Nome do evento')).toHaveValue('Culto de domingo')
  })
})
