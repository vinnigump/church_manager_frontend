import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
import { listGroupMembers, parseGroupMembership, readGroupHistory, readGroupMembership, releaseGroupMember, type GroupMembership } from './group-api'

const church = '00000000-0000-0000-0000-000000000001', group = '00000000-0000-0000-0000-000000000002', id = '00000000-0000-0000-0000-000000000003', person = '00000000-0000-0000-0000-000000000004', other = '00000000-0000-0000-0000-000000000005'
const context = { churchId: church, kind: 'MINISTRY' as const, groupId: group }
const item: GroupMembership = { ...context, id, personId: person, status: 'ACTIVE', revision: 0, linkedAt: '2020-01-01T13:00:00.000001Z', linkedBy: person, releasedAt: null, releasedBy: null }
const inactive: GroupMembership = { ...item, status: 'INACTIVE', revision: 1, releasedAt: '2032-01-01T13:00:00Z', releasedBy: person }
const history = { id: other, action: 'LINKED', beforeStatus: null, afterStatus: 'ACTIVE', revision: 0, actorId: person, occurredAt: item.linkedAt, reason: 'Motivo reservado' }
const account = { id: person, personId: person, login: 'ana', status: 'ACTIVE' }
const route = `/igrejas/${church}/grupos/MINISTRY/${group}/vinculos`
const json = (v: unknown) => new Response(JSON.stringify(v))
const page = (items: unknown[], index = 0, total = items.length) => ({ items, page: index, size: 20, total })
function Switch() { const navigate = useNavigate(); return <button onClick={() => navigate(route.replace(group, other))}>Trocar grupo de teste</button> }
function show(path = `${route}/${id}`) { return render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><Switch/><App/></AuthContext.Provider></MemoryRouter>) }
function server(handler?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined, permissions = ['GROUP_MEMBERSHIP_MANAGE']) {
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init); if (custom !== undefined) return custom
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-GROUP-CSRF', token: 'fixture' })
    if (url.includes('/authorization?')) return json({ allowed: permissions.includes(new URL(url, 'https://example.test').searchParams.get('permissionCode') ?? '') })
    if (url.includes('/members?')) return json(page([item]))
    if (url.includes('/history?')) return json(page([history]))
    if (url.endsWith('/release')) return json({ membership: inactive, changed: true })
    if (url.endsWith(`/group-memberships/${id}`)) return json(item)
    throw new Error('Unexpected fixture request')
  }); vi.stubGlobal('fetch', fetcher); return fetcher
}
const writes = (fetcher: ReturnType<typeof server>) => fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')
async function confirm() { fireEvent.click(await screen.findByRole('button', { name: 'Revisar desvinculação' })); fireEvent.click(screen.getByRole('button', { name: 'Confirmar desvinculação' })) }
afterEach(() => api.clear())

describe('contrato de vínculos próprios do grupo', () => {
  it('projeta DTO e preserva estado ativo sem expirar pela data antiga', () => {
    expect(parseGroupMembership({ ...item, name: 'private', contact: 'private' }, context)).toEqual(item)
  })
  it.each([{ churchId: other }, { groupId: other }, { kind: 'DEPARTMENT' }, { personId: 'bad' }, { revision: -1 }, { linkedAt: 'bad' }, { linkedBy: null },
    { releasedAt: inactive.releasedAt }, { releasedBy: person }, { status: 'INACTIVE' }, { status: 'PENDING' }])('rejeita vínculo incompatível %j', patch => {
    expect(() => parseGroupMembership({ ...item, ...patch }, context)).toThrow('validar')
  })
  it('envia estado/página ao servidor e recusa página fora do filtro sem retornar parcial', async () => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue(page([item]))
    expect((await listGroupMembers(context, 'ACTIVE', 0, undefined, client)).items).toEqual([item])
    expect(request).toHaveBeenCalledWith(`/membership/churches/${church}/groups/MINISTRY/${group}/members?page=0&size=20&status=ACTIVE`, { signal: undefined })
    await expect(listGroupMembers(context, 'INACTIVE', 0, undefined, client)).rejects.toThrow()
  })
  it.each([{ total: 2 }, { page: 1 }, { size: 10 }, { items: [item, item], total: 2 }])('recusa metadados incoerentes %j', async patch => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue({ ...page([item]), ...patch })
    await expect(listGroupMembers(context, undefined, 0, undefined, client)).rejects.toThrow()
  })
  it('detalhe exige ID exato', async () => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue({ ...item, id: other })
    await expect(readGroupMembership(context, id, undefined, client)).rejects.toThrow()
  })
  it('histórico projeta motivo apenas após contexto validado', async () => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(page([{ ...history, contacts: ['private'] }]))
    expect((await readGroupHistory(context, item, 0, undefined, client)).items).toEqual([history])
  })
  it.each([{ action: 'REQUESTED' }, { beforeStatus: 'ACTIVE' }, { afterStatus: 'INACTIVE' }, { reason: 'x'.repeat(501) }, { actorId: null }])('recusa histórico incompatível %j', async patch => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(page([{ ...history, ...patch }]))
    await expect(readGroupHistory(context, item, 0, undefined, client)).rejects.toThrow()
  })
  it('POST de saída envia somente motivo/revisão e aceita no-op com snapshot já inativo', async () => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request').mockResolvedValue({ membership: inactive, changed: true })
    expect(await releaseGroupMember(context, item, '  saída externa  ', undefined, client)).toEqual({ membership: inactive, changed: true })
    expect(request).toHaveBeenCalledWith(`/membership/churches/${church}/group-memberships/${id}/release`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Expected-Revision': '0' }, body: JSON.stringify({ reason: 'saída externa' }), signal: undefined })
    request.mockResolvedValue({ membership: inactive, changed: false })
    expect((await releaseGroupMember(context, inactive, '', undefined, client)).changed).toBe(false)
  })
  it.each([{ membership: { ...inactive, personId: other }, changed: true }, { membership: { ...inactive, revision: 2 }, changed: true }, { membership: inactive, changed: false }, { membership: item, changed: true }])('não confirma escrita incompatível %j', async raw => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(raw)
    await expect(releaseGroupMember(context, item, '', undefined, client)).rejects.toThrow()
  })
  it('motivo excessivo não escreve', async () => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request')
    await expect(releaseGroupMember(context, item, 'x'.repeat(501), undefined, client)).rejects.toThrow('500')
    expect(request).not.toHaveBeenCalled()
  })
})

describe('gestão contextual de participantes do grupo', () => {
  it('gestor consulta histórico e registra saída direta, sem workflow ou alteração de membresia formal', async () => {
    let released = false
    const fetcher = server((url, init) => {
      if (init.method === 'POST') { released = true; return json({ membership: inactive, changed: true }) }
      if (url.endsWith(`/group-memberships/${id}`)) return json(released ? inactive : item)
    }); await api.login('ana', 'fixture-password'); show()
    await screen.findByText('Motivo: Motivo reservado')
    fireEvent.change(screen.getByLabelText('Motivo opcional'), { target: { value: 'Comunicação externa recebida' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar desvinculação' }))
    expect(writes(fetcher)).toHaveLength(0)
    expect(screen.getByText(/A membresia formal, cargos/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar desvinculação' }))
    expect(await screen.findByText('Desvinculação confirmada. O histórico foi preservado.')).toBeInTheDocument()
    expect(await screen.findByText(/Vínculo encerrado; histórico preservado/)).toBeInTheDocument()
    const init = writes(fetcher)[0][1]
    expect(init.headers.get('X-GROUP-CSRF')).toBe('fixture')
    expect(init.headers.get('X-Expected-Revision')).toBe('0')
    expect(JSON.parse(init.body)).toEqual({ reason: 'Comunicação externa recebida' })
    expect(fetcher.mock.calls.filter(([url]) => url.includes('GROUP_MEMBERSHIP_MANAGE_LED'))).toHaveLength(0)
  })
  it('liderança candidata exige confirmação do grupo exato no endpoint', async () => {
    const fetcher = server((url) => url.includes('/membership/') ? new Response(null, { status: 403 }) : undefined, ['GROUP_MEMBERSHIP_MANAGE_LED'])
    show(); expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByLabelText('Motivo opcional')).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([url]) => url.includes('GROUP_MEMBERSHIP_MANAGE_LED'))).toBe(true)
    expect(fetcher.mock.calls.some(([url]) => url.includes('/history?'))).toBe(false)
  })
  it('líder autorizado pode consultar sob código próprio sem ser gestor global', async () => {
    server(undefined, ['GROUP_MEMBERSHIP_MANAGE_LED']); show()
    expect(await screen.findByLabelText('Motivo opcional')).toBeInTheDocument()
  })
  it('departamento exige contexto próprio e consulta sem converter em ministério', async () => {
    server(url => url.endsWith(`/group-memberships/${id}`) ? json({ ...item, kind: 'DEPARTMENT' }) : undefined)
    show(`${route.replace('MINISTRY', 'DEPARTMENT')}/${id}`)
    expect(await screen.findByLabelText('Motivo opcional')).toBeInTheDocument()
  })
  it('permissões de evento não concedem gestão do grupo', async () => {
    const fetcher = server(undefined, ['EVENT_VIEW', 'EVENT_EDIT']); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
  })
  it('falha na decisão permanece fechada sem consultar negócio', async () => {
    const fetcher = server(url => url.includes('/authorization?') ? new Response(null, { status: 500 }) : undefined); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('acesso permanece bloqueado')
    expect(fetcher.mock.calls).toHaveLength(1)
  })
  it('lista aplica filtro no servidor e página preserva estado e total', async () => {
    const fetcher = server(url => {
      if (!url.includes('/members?')) return undefined
      const params = new URL(url, 'https://example.test').searchParams
      const n = Number(params.get('page'))
      const first = params.get('status') === 'INACTIVE' ? inactive : item
      const rows = [first, ...Array.from({ length: 19 }, (_, index) => ({ ...first, id: `10000000-0000-0000-0000-${String(index).padStart(12, '0')}` }))]
      return json(page(n ? [] : rows, n, n ? 20 : 21))
    }); show(route)
    await screen.findByRole('link', { name: `Consultar vínculo ${id}` })
    fireEvent.change(screen.getByLabelText('Estado do vínculo'), { target: { value: 'INACTIVE' } })
    expect(new URL(fetcher.mock.calls.at(-1)![0], 'https://example.test').searchParams.has('status')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtro de vínculos' }))
    await screen.findAllByText(/Estado Inativo/)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Nenhum vínculo nesta página e filtro.')
    const params = new URL(fetcher.mock.calls.at(-1)![0], 'https://example.test').searchParams
    expect(params.get('status')).toBe('INACTIVE'); expect(params.get('page')).toBe('1')
  })
  it('grupo divergente no detalhe não inicia leitura do histórico', async () => {
    const fetcher = server(url => url.endsWith(`/group-memberships/${id}`) ? json({ ...item, groupId: other }) : undefined); show()
    await screen.findByRole('alert')
    expect(fetcher.mock.calls.some(([url]) => url.includes('/history?'))).toBe(false)
  })
  it('foco descarta motivo/confirmação e relê revisão', async () => {
    server(); show(); fireEvent.change(await screen.findByLabelText('Motivo opcional'), { target: { value: 'reservado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar desvinculação' })); fireEvent(window, new Event('focus'))
    expect(await screen.findByLabelText('Motivo opcional')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Confirmar desvinculação' })).not.toBeInTheDocument()
  })
  it('perda de acesso no foco remove motivo e histórico anteriormente autorizado', async () => {
    let allowed = true
    server(url => url.includes('/authorization?') ? json({ allowed }) : undefined)
    show(); fireEvent.change(await screen.findByLabelText('Motivo opcional'), { target: { value: 'restrito' } })
    allowed = false; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByLabelText('Motivo opcional')).not.toBeInTheDocument()
    expect(screen.queryByText('Motivo: Motivo reservado')).not.toBeInTheDocument()
  })
  it('resposta de escrita incompatível é incerta e bloqueia replay', async () => {
    const fetcher = server((url, init) => init.method === 'POST' ? json({ membership: { ...inactive, personId: other }, changed: true }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar a desvinculação')
    expect(screen.queryByText(/Desvinculação confirmada/)).not.toBeInTheDocument()
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: 'Revisar desvinculação' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('alterar motivo invalida confirmação antes da escrita', async () => {
    const fetcher = server(); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar desvinculação' }))
    fireEvent.change(screen.getByLabelText('Motivo opcional'), { target: { value: 'novo motivo' } })
    expect(screen.queryByRole('button', { name: 'Confirmar desvinculação' })).not.toBeInTheDocument()
    expect(writes(fetcher)).toHaveLength(0)
  })
  it.each([403, 409, 422, 500])('falha %s não confirma nem repete por foco', async status => {
    const fetcher = server((url, init) => init.method === 'POST' ? new Response(null, { status }) : undefined)
    await api.login('ana', 'fixture-password'); show(); await confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Atualize e confira')
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('button', { name: 'Revisar desvinculação' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar dados e reavaliar acesso' }))
    expect(await screen.findByRole('button', { name: 'Revisar desvinculação' })).toBeEnabled()
    expect(writes(fetcher)).toHaveLength(1)
  })
  it('trava permanece durante duplo envio/reautorização', async () => {
    let finish!: (v: Response) => void
    const fetcher = server((url, init) => init.method === 'POST' ? new Promise<Response>(done => { finish = done }) : undefined)
    await api.login('ana', 'fixture-password'); show(); fireEvent.click(await screen.findByRole('button', { name: 'Revisar desvinculação' }))
    const button = screen.getByRole('button', { name: 'Confirmar desvinculação' }); fireEvent.click(button); fireEvent.click(button)
    fireEvent(window, new Event('focus')); expect(await screen.findByRole('button', { name: 'Revisar desvinculação' })).toBeDisabled()
    expect(writes(fetcher)).toHaveLength(1)
    await act(async () => finish(json({ membership: inactive, changed: true })))
    await screen.findByText(/Desvinculação confirmada/)
  })
  it('troca de grupo aborta e descarta resultado antigo', async () => {
    let finish!: (v: Response) => void
    const fetcher = server((url, init) => {
      if (init.method === 'POST') return new Promise<Response>(done => { finish = done })
      if (url.includes(`/groups/MINISTRY/${other}/members?`)) return json(page([]))
    }); await api.login('ana', 'fixture-password'); show(); await confirm()
    await waitFor(() => expect(writes(fetcher)).toHaveLength(1)); const signal = writes(fetcher)[0][1].signal
    fireEvent.click(screen.getByRole('button', { name: 'Trocar grupo de teste' }))
    await screen.findByText('Nenhum vínculo nesta página e filtro.')
    expect(signal.aborted).toBe(true)
    await act(async () => finish(json({ membership: inactive, changed: true })))
    expect(screen.queryByText(/Desvinculação confirmada/)).not.toBeInTheDocument()
  })
  it.each([route.replace('MINISTRY', 'CHURCH'), route.replace(group, 'invalid')])('contexto inválido %s não consulta', path => {
    const fetcher = server(); show(path)
    expect(screen.getByRole('alert')).toHaveTextContent('acesso ao grupo é inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
