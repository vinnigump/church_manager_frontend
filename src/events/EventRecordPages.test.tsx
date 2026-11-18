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
function agendaResponse(url: string, items = [value]) {
  const params = new URL(url, 'https://example.test').searchParams, view = params.get('view') ?? 'WEEK', anchor = params.get('date') ?? '2035-01-03'
  const start = new Date(`${anchor}T00:00:00Z`)
  if (view === 'MONTH') start.setUTCDate(1); else start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7)
  const end = new Date(start); if (view === 'MONTH') end.setUTCMonth(end.getUTCMonth() + 1); else end.setUTCDate(end.getUTCDate() + 7)
  const startsOn = start.toISOString().slice(0, 10), endsOnExclusive = end.toISOString().slice(0, 10)
  const from = `${startsOn}T03:00:00Z`, to = `${endsOnExclusive}T03:00:00Z`, size = Number(params.get('size') ?? 100), page = Number(params.get('page') ?? 0)
  const visible = items.filter(v => Date.parse(v.endsAt) > Date.parse(from) && Date.parse(v.startsAt) < Date.parse(to))
  return json({ referenceAt: '2035-01-03T12:00:00Z', timeZone: 'America/Fortaleza', today: '2035-01-03', anchorDate: anchor, view,
    startsOn, endsOnExclusive, from, to, total: visible.length, size, page, items: visible.slice(page * size, (page + 1) * size) })
}
type Handler = (url: string, init: RequestInit) => Response | Promise<Response> | undefined
function backend(handler?: Handler, permissions = ['EVENT_VIEW', 'EVENT_CREATE', 'EVENT_EDIT']) {
  const fetcher = vi.fn(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init); if (custom !== undefined) return custom
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-TEST-CSRF', token: 'synthetic-csrf' })
    if (url.includes('/authorization?')) return json({ allowed: permissions.includes(new URL(url, 'https://example.test').searchParams.get('permissionCode') ?? '') })
    if (url.includes('/types?')) return json({ items: [{ id: type, name: 'Encontro local', enabled: true, scopeType: 'CHURCH', mandatory: false }], page: 0, size: 20, total: 1 })
    if (url.includes('/records/agenda?')) return agendaResponse(url, url.includes(`/churches/${other}/`) ? [] : [value])
    if (url.includes('/records?')) return json({ items: [value], page: 0, size: 20, total: 1 })
    if (url.endsWith(`/records/${id}`) && !init.method) return json(value)
    if (['POST', 'PUT'].includes(init.method ?? '')) { const body = JSON.parse(String(init.body)); return json({ ...value, ...body, status: body.draft ? 'DRAFT' : 'AVAILABLE', revision: init.method === 'POST' ? 1 : 5 }, init.method === 'POST' ? 201 : 200) }
    throw new Error('Unexpected fixture request')
  })
  vi.stubGlobal('fetch', fetcher); return fetcher
}
const writes = (fetcher: ReturnType<typeof backend>) => fetcher.mock.calls.filter(([, init]) => ['POST', 'PUT'].includes(init?.method ?? ''))
function SwitchChurch() { const navigate = useNavigate(); return <button onClick={() => navigate(`/eventos/igrejas/${other}/cadastro?view=list`)}>Trocar igreja</button> }
function tree(path: string, current = account) { return <MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account: current, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><SwitchChurch/><App/></AuthContext.Provider></MemoryRouter> }
const login = () => api.login('ana', 'synthetic-password')
async function fill() {
  await screen.findByRole('option', { name: 'Encontro local' })
  for (const [label, content] of [['Nome do evento', 'Culto de domingo'], ['Local ou endereço de acesso público', 'Templo'], ['Tipo de evento', type],
    ['Início', '2035-01-01T09:00:00'], ['Duração', '7200000000000'], ['Modalidade', 'IN_PERSON'],
    ['Como as pessoas participam?', 'OPEN_EVENT'], ['Quem pode ver o evento?', 'PUBLIC']]) fireEvent.change(screen.getByLabelText(label), { target: { value: content } })
}
afterEach(() => api.clear())
describe('cadastro v4 por API real integrada (testes de componente com transporte simulado)', () => {
  it('lista nomes e estados e não oferece publicação', async () => {
    backend(); render(tree(`${base}?view=list`))
    expect(await screen.findByRole('link', { name: 'Ver evento Encontro de famílias' })).toHaveAttribute('href', `${base}/${id}?view=list`)
    expect(screen.getByText('Rascunho')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Criar evento' })).toHaveAttribute('href', `${base}/novo?view=list`)
    expect(screen.queryByRole('link', { name: /publicar|calendário anual/i })).not.toBeInTheDocument()
  })
  it.each([['Salvar rascunho', true], ['Salvar evento', false]] as const)('cria pelo botão %s com audiência, CSRF e fuso, sem publicar', async (button, draft) => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Salvar evento' }))
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
    render(tree(`${base}?view=list`)); await waitFor(() => expect(finish).toBeDefined())
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
    render(tree(`${base}?view=list`)); await screen.findByText('Nenhum evento cadastrado.')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('21 eventos · Página 2')
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/records?page=1&size=20'))).toBe(true)
  })
  it('falha ao consultar mantém mensagem segura e não mostra dados inventados', async () => {
    backend(url => url.includes('/records?') ? new Response('private-secret', { status: 500 }) : undefined)
    render(tree(`${base}?view=list`)); await screen.findByText('Não foi possível concluir a solicitação.')
    expect(screen.queryByText('private-secret')).not.toBeInTheDocument()
    expect(screen.queryByText(value.name)).not.toBeInTheDocument()
  })
  it('valida o período e preserva campos antes de qualquer gravação', async () => {
    const fetcher = backend(); await login(); render(tree(`${base}/novo`)); await fill()
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: 'inválido' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Cadastro de evento' }))
    await screen.findByText(/Informe início e duração válidos/)
    expect(writes(fetcher)).toHaveLength(0); expect(screen.getByLabelText('Nome do evento')).toHaveValue('Culto de domingo')
  })
  it('abre Semana com Hoje e fuso do servidor, exibindo horário da igreja', async () => {
    backend(); render(tree(base))
    await screen.findByRole('link', { name: 'Ver evento Encontro de famílias' })
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Hoje: 03\/01\/2035/)).toHaveTextContent('Horário de Brasília')
    expect(screen.getByText(/07:00 · Duração: .* · Rascunho/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver evento Encontro de famílias' })).toHaveAttribute('href', `${base}/${id}?view=week&date=2035-01-03`)
  })
  it('Anterior/Próximo seguem o período e Hoje volta à referência do servidor', async () => {
    const fetcher = backend(); render(tree(base)); await screen.findByText(/1 eventos no período/)
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    await screen.findByText('Nenhum evento neste período.')
    expect(fetcher.mock.calls.some(([url]) => url.includes('date=2035-01-10'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' })); await screen.findByText(/1 eventos no período/)
    expect(screen.getByRole('link', { name: 'Ver evento Encontro de famílias' })).toBeInTheDocument()
  })
  it('Hoje reconsulta o relógio mesmo quando a URL inicial já está sem data', async () => {
    let tomorrow = false
    backend(url => {
      if (!url.includes('/records/agenda?')) return undefined
      const response = agendaResponse(url)
      return tomorrow ? response.json().then(data => json({ ...data, referenceAt: '2035-01-04T12:00:00Z', today: '2035-01-04', anchorDate: '2035-01-04' })) : response
    })
    render(tree(base)); await screen.findByText(/Hoje: 03\/01\/2035/)
    tomorrow = true; fireEvent.click(screen.getByRole('button', { name: 'Hoje' }))
    await screen.findByText(/Hoje: 04\/01\/2035/)
  })
  it('evento de vários dias aparece por dia com indicação de continuação', async () => {
    const crossing = { ...value, startsAt: '2035-01-02T02:00:00Z', endsAt: '2035-01-03T06:00:00Z' }
    backend(url => url.includes('/records/agenda?') ? agendaResponse(url, [crossing]) : undefined)
    render(tree(base)); await screen.findAllByRole('link', { name: 'Ver evento Encontro de famílias' })
    expect(screen.getAllByRole('link', { name: 'Ver evento Encontro de famílias' })).toHaveLength(3)
    expect(screen.getAllByText(/Continuação · Duração: .* · Rascunho/)).toHaveLength(2)
  })
  it('voltar do detalhe restaura Mês, âncora e dia escolhido', async () => {
    backend(); render(tree(`${base}?view=month&date=2035-01-03&day=2035-01-01`))
    const links = await screen.findAllByRole('link', { name: 'Ver evento Encontro de famílias' }); fireEvent.click(links[0])
    await screen.findByRole('link', { name: 'Editar evento' })
    expect(screen.getByRole('link', { name: 'Todos os eventos' })).toHaveAttribute('href', `${base}?view=month&date=2035-01-03&day=2035-01-01`)
    fireEvent.click(screen.getByRole('link', { name: 'Todos os eventos' }))
    await screen.findByText(/1 eventos no período/)
    expect(screen.getByRole('button', { name: 'Mês' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'segunda-feira, 1 de janeiro de 2035' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('lista preserva a página no detalhe e no retorno', async () => {
    backend(url => url.includes('/records?') ? json({ items: [value], page: Number(new URL(url, 'https://example.test').searchParams.get('page')), size: 20, total: 21 }) : undefined)
    render(tree(`${base}?view=list&page=1`)); fireEvent.click(await screen.findByRole('link', { name: 'Ver evento Encontro de famílias' }))
    await screen.findByRole('link', { name: 'Editar evento' }); fireEvent.click(screen.getByRole('link', { name: 'Todos os eventos' }))
    await screen.findByText('21 eventos · Página 2')
  })
  it('falha da agenda não exibe um período parcial ou dados privados', async () => {
    backend(url => url.includes('/records/agenda?') ? new Response('private-url', { status: 500 }) : undefined)
    render(tree(base)); await screen.findByText('Não foi possível concluir a solicitação.')
    expect(screen.queryByRole('link', { name: 'Ver evento Encontro de famílias' })).not.toBeInTheDocument()
    expect(screen.queryByText('private-url')).not.toBeInTheDocument()
  })
})
