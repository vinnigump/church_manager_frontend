import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
import { readAudience, saveAudience, validateAudiencePolicy, type AudiencePolicy, type AudienceView } from './audience-api'

const church = '00000000-0000-0000-0000-000000000001', id = '00000000-0000-0000-0000-000000000002', role = 'a0000000-0000-0000-0000-000000000003', ministry = '00000000-0000-0000-0000-000000000004', other = '00000000-0000-0000-0000-000000000005'
const account = { id, personId: id, login: 'ana', status: 'ACTIVE' }
const policy: AudiencePolicy = { visibility: 'ELIGIBLE_AUDIENCE', churchLinkRequired: true, activeMembershipRequired: true, functionIds: [role], ministryIds: [ministry], departmentIds: [], minimumAge: 18, maximumAge: 65 }
const before: AudienceView = { occurrenceId: id, churchId: church, revision: 7, configured: true, policy }
const next = { ...policy, minimumAge: 21 }
const result = { ...before, revision: 8, policy: next }
const json = (v: unknown) => new Response(JSON.stringify(v))
const route = `/eventos/igrejas/${church}/ocorrencias/${id}/audiencia`
function Switch() { const navigate = useNavigate(); return <button onClick={() => navigate(route.replace(id, other))}>Trocar ocorrência de teste</button> }
function show(path = route) { return render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><Switch/><App/></AuthContext.Provider></MemoryRouter>) }
function server(handler?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined, permissions = ['EVENT_VIEW', 'EVENT_EDIT']) {
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init); if (custom !== undefined) return custom
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-AUDIENCE-CSRF', token: 'fixture' })
    if (url.includes('/authorization?')) return json({ allowed: permissions.includes(new URL(url, 'https://example.test').searchParams.get('permissionCode') ?? '') })
    if (init.method === 'PUT') return json(result)
    if (url.endsWith('/audience-policy')) return json(before)
    throw new Error('Unexpected fixture request')
  }); vi.stubGlobal('fetch', fetcher); return fetcher
}
const writes = (fetcher: ReturnType<typeof server>) => fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')
async function prepare() { fireEvent.change(await screen.findByLabelText('Idade mínima inclusiva (vazia: sem limite)'), { target: { value: '21' } }); fireEvent.click(screen.getByRole('button', { name: 'Revisar política de audiência' })) }
async function confirm() { await prepare(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar política de audiência' })) }
afterEach(() => api.clear())

describe('contrato administrativo de audiência', () => {
  it('lê legado sem default PUBLIC e projeta política autorizada', async () => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue({ ...before, configured: false, policy: null, personFacts: 'private' })
    expect(await readAudience(church, id, undefined, client)).toEqual({ ...before, configured: false, policy: null })
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/occurrences/${id}/audience-policy`, { signal: undefined })
  })
  it.each([{ churchId: other }, { occurrenceId: other }, { revision: -1 }, { configured: false }, { configured: true, policy: null }, { policy: undefined }])('rejeita view incompatível %j', async patch => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue({ ...before, ...patch })
    await expect(readAudience(church, id, undefined, client)).rejects.toThrow()
  })
  it.each([{ visibility: '' }, { visibility: ['PUBLIC'] }, { churchLinkRequired: 'true' }, { activeMembershipRequired: null }, { minimumAge: -1 }, { maximumAge: 17 }, { maximumAge: 2.5 }, { maximumAge: 2147483648 },
    { functionIds: null }, { functionIds: [role, role.toUpperCase()] }, { ministryIds: ['bad'] }, { departmentIds: [null] }, { departmentIds: Array.from({ length: 101 }, (_, i) => `10000000-0000-0000-0000-${String(i).padStart(12, '0')}`) },
  ])('rejeita política incompatível %j', patch => {
    expect(() => validateAudiencePolicy({ ...policy, ...patch })).toThrow()
  })
  it('aceita limites inclusivos iguais e100 referências; idades opcionais omitidas viram null', () => {
    const refs = Array.from({ length: 100 }, (_, i) => `10000000-0000-0000-0000-${String(i).padStart(12, '0')}`)
    expect(validateAudiencePolicy({ ...policy, functionIds: refs, minimumAge: 0, maximumAge: 0 }).functionIds).toHaveLength(100)
    expect(validateAudiencePolicy({ ...policy, minimumAge: undefined, maximumAge: undefined }).minimumAge).toBeNull()
  })
  it('PUT projeta corpo completo com CSRF no cliente compartilhado e revisão da ocorrência', async () => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue(result)
    expect(await saveAudience(church, id, before, { ...next, personFacts: 'private' } as AudiencePolicy, undefined, client)).toEqual(result)
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/occurrences/${id}/audience-policy`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Expected-Revision': '7' }, body: JSON.stringify(next), signal: undefined })
  })
  it('no-op ignora ordem de conjuntos e conserva revisão', async () => {
    const client = new ApiClient(); const original = { ...before, policy: { ...policy, functionIds: [role, other] } }
    vi.spyOn(client, 'request').mockResolvedValue({ ...original, policy: { ...original.policy, functionIds: [other, role] } })
    expect((await saveAudience(church, id, original, original.policy, undefined, client)).revision).toBe(7)
  })
  it.each([{ revision: 7 }, { revision: 9 }, { occurrenceId: other }, { configured: false, policy: null }, { policy: { ...next, ministryIds: [] } }])('não confirma resultado incompatível %j', async patch => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue({ ...result, ...patch })
    await expect(saveAudience(church, id, before, next, undefined, client)).rejects.toThrow()
  })
})

describe('configuração explícita com revisão compartilhada', () => {
  it.each(['PUBLIC', 'CHURCH', 'ELIGIBLE_AUDIENCE'] as const)('configura %s sem publicar/inscrever e relê resultado confirmado', async visibility => {
    let current = before
    const fetcher = server((url, init) => {
      if (init.method === 'PUT') { current = { ...before, revision: 8, policy: JSON.parse(init.body as string) }; return json(current) }
      if (url.endsWith('/audience-policy')) return json(current)
    }); await api.login('ana', 'fixture-password'); show()
    fireEvent.change(await screen.findByLabelText('Visibilidade'), { target: { value: visibility } })
    await prepare(); expect(writes(fetcher)).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Confirmar substituição na revisão 7' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar política de audiência' }))
    expect(await screen.findByText(/Política confirmada pelo servidor na revisão 8/)).toBeInTheDocument()
    expect(await screen.findByText('Revisão compartilhada consultada: 8.')).toBeInTheDocument()
    const init = writes(fetcher)[0][1]
    expect(init.headers.get('X-AUDIENCE-CSRF')).toBe('fixture'); expect(init.headers.get('X-Expected-Revision')).toBe('7')
    expect(JSON.parse(init.body)).toEqual({ ...next, visibility })
    expect(fetcher.mock.calls.some(([url]) => /\/publish|\/registrations|\/accounts\/people/.test(url))).toBe(false)
  })
  it('ausência mantém campos explícitos vazios sem default de visibilidade ou vínculo', async () => {
    const fetcher = server(url => url.endsWith('/audience-policy') ? json({ ...before, configured: false, policy: null }) : undefined); show()
    expect(await screen.findByText('Política ainda não configurada. A ausência não significa visibilidade pública.')).toBeInTheDocument()
    expect(await screen.findByLabelText('Visibilidade')).toHaveValue('')
    expect(screen.getByLabelText('Exigir vínculo com a igreja')).toHaveValue('')
    expect(screen.getByLabelText('Exigir membresia formal ativa')).toHaveValue('')
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('remove referência conhecida somente por escolha explícita e preserva demais categorias', async () => {
    const fetcher = server((url, init) => init.method === 'PUT' ? json({ ...result, policy: { ...next, ministryIds: [] } }) : undefined)
    await api.login('ana', 'fixture-password'); show()
    fireEvent.click(await screen.findByLabelText(`Manter Ministérios ${ministry}`))
    await confirm(); await screen.findByText(/Política confirmada/)
    expect(JSON.parse(writes(fetcher)[0][1].body)).toEqual({ ...next, ministryIds: [] })
  })
  it('idade invertida bloqueia confirmação e escrita', async () => {
    const fetcher = server(); show()
    fireEvent.change(await screen.findByLabelText('Idade mínima inclusiva (vazia: sem limite)'), { target: { value: '66' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar política de audiência' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('máxima deve ser maior')
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('política ausente exige flags explícitas mesmo após escolher PUBLIC', async () => {
    const fetcher = server(url => url.endsWith('/audience-policy') ? json({ ...before, configured: false, policy: null }) : undefined); show()
    fireEvent.change(await screen.findByLabelText('Visibilidade'), { target: { value: 'PUBLIC' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Configuração explícita de audiência' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Selecione explicitamente')
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('detalhe publicado oferece audiência e não impõe restrição de edição de rascunho', async () => {
    server(url => url.endsWith(`/occurrences/${id}`) ? json({ id, churchId: church, eventTypeId: role, eventTypeVersionId: null, recurrenceRuleId: null, startsAt: '2032-01-01T13:00:00Z', endsAt: '2032-01-01T14:00:00Z', capacity: null, status: 'PUBLISHED', modality: 'ONLINE', participationMode: 'OPEN_EVENT', checkInRequired: false, firstPublishedAt: '2031-12-01T13:00:00Z', configured: true, revision: 7 }) : undefined)
    show(route.replace('/audiencia', ''))
    fireEvent.click(await screen.findByRole('link', { name: 'Consultar audiência da ocorrência' }))
    expect(await screen.findByRole('button', { name: 'Revisar política de audiência' })).toBeEnabled()
  })
  it.each([{ permissions: ['EVENT_VIEW'] }, { permissions: ['EVENT_VIEW', 'EVENT_PUBLISH'] }])('leitura/publicação não concedem edição %j', async ({ permissions }) => {
    const fetcher = server(undefined, permissions); show(); await screen.findByText('Revisão compartilhada consultada: 7.')
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.includes('EVENT_EDIT'))).toBe(true))
    expect(screen.queryByRole('button', { name: 'Revisar política de audiência' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('edição sem leitura não consulta política', async () => {
    const fetcher = server(undefined, ['EVENT_EDIT']); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
  })
  it('foco conserva rascunho mas descarta confirmação', async () => {
    server(); show(); await prepare(); fireEvent(window, new Event('focus'))
    expect(await screen.findByLabelText('Idade mínima inclusiva (vazia: sem limite)')).toHaveValue(21)
    expect(screen.queryByRole('button', { name: 'Confirmar política de audiência' })).not.toBeInTheDocument()
  })
  it('nova revisão não é incorporada silenciosamente; descarte consulta novo snapshot', async () => {
    let revision = 7
    const fetcher = server(url => url.endsWith('/audience-policy') ? json({ ...before, revision }) : undefined)
    show(); await prepare(); revision = 8; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('revisão original não foi substituída')
    expect(screen.queryByRole('button', { name: 'Confirmar política de audiência' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Descartar tentativa e recarregar audiência' }))
    expect(await screen.findByLabelText('Idade mínima inclusiva (vazia: sem limite)')).toHaveValue(18)
    expect(writes(fetcher)).toHaveLength(0)
  })
  it('perda de EVENT_VIEW remove política e rascunho da exibição', async () => {
    let allowed = true
    server(url => url.includes('/authorization?') ? json({ allowed }) : undefined); show(); await prepare()
    allowed = false; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByLabelText('Visibilidade')).not.toBeInTheDocument()
    expect(screen.queryByText(/Funções eclesiásticas:/)).not.toBeInTheDocument()
  })
  it('confirmação incompatível é incerta e não libera replay por foco', async () => {
    const fetcher = server((url, init) => init.method === 'PUT' ? json({ ...result, policy: { ...next, ministryIds: [] } }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar')
    expect(screen.queryByText(/Política confirmada/)).not.toBeInTheDocument()
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: 'Revisar política de audiência' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it.each([403, 409, 422, 500])('erro %s não confirma nem repete por foco', async status => {
    const fetcher = server((url, init) => init.method === 'PUT' ? new Response(null, { status }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('resultado pode ter sido gravado')
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: 'Revisar política de audiência' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('trava sobrevive a duplo envio e reautorização', async () => {
    let finish!: (v: Response) => void
    const fetcher = server((url, init) => init.method === 'PUT' ? new Promise<Response>(done => { finish = done }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await prepare()
    const button = screen.getByRole('button', { name: 'Confirmar política de audiência' }); fireEvent.click(button); fireEvent.click(button)
    fireEvent(window, new Event('focus')); expect(await screen.findByRole('button', { name: 'Revisar política de audiência' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => finish(json(result)))
    await screen.findByText(/Política confirmada/)
  })
  it('troca de ocorrência aborta e descarta resposta antiga', async () => {
    let finish!: (v: Response) => void
    const fetcher = server((url, init) => {
      if (init.method === 'PUT') return new Promise<Response>(done => { finish = done })
      if (url.includes(`/occurrences/${other}/audience-policy`)) return json({ ...before, occurrenceId: other, configured: false, policy: null })
    }); await api.login('ana', 'fixture-password'); show(); await confirm()
    await waitFor(() => expect(writes(fetcher)).toHaveLength(1)); const signal = writes(fetcher)[0][1].signal
    fireEvent.click(screen.getByRole('button', { name: 'Trocar ocorrência de teste' }))
    await screen.findByText('Política ainda não configurada. A ausência não significa visibilidade pública.')
    expect(signal.aborted).toBe(true)
    await act(async () => finish(json(result)))
    expect(screen.queryByText(/Política confirmada/)).not.toBeInTheDocument()
  })
  it('URL inválida não consulta nem concede permissão', () => {
    const fetcher = server(); show(route.replace(church, 'invalid'))
    expect(screen.getByRole('alert')).toHaveTextContent('acesso à audiência é inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
