import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
import { readWindow, validateWindow, writeWindow, type WindowView } from './window-api'
import type { Occurrence } from './occurrence-api'

const church = '00000000-0000-0000-0000-000000000001', id = '00000000-0000-0000-0000-000000000002', other = '00000000-0000-0000-0000-000000000003'
const account = { id, personId: id, login: 'ana', status: 'ACTIVE' }
const opensAt = '2032-01-01T10:00:00.000001Z', closesAt = '2032-01-01T11:00:00.000001Z'
const before: WindowView = { churchId: church, occurrenceId: id, revision: 7, configured: true, opensAt, closesAt }
const absent: WindowView = { ...before, configured: false, opensAt: null, closesAt: null }
const occurrence: Occurrence = { id, churchId: church, eventTypeId: other, eventTypeVersionId: null, recurrenceRuleId: null, startsAt: '2032-01-01T12:00:00Z', endsAt: '2032-01-01T13:00:00Z', capacity: 30, status: 'PUBLISHED', modality: 'ONLINE', participationMode: 'REGISTRATION_REQUIRED', checkInRequired: false, firstPublishedAt: '2031-01-01T12:00:00Z', configured: true, revision: 7 }
const next = { opensAt, closesAt: occurrence.startsAt }, result = { ...before, ...next, revision: 8 }
const json = (v: unknown) => new Response(JSON.stringify(v))
const route = `/eventos/igrejas/${church}/ocorrencias/${id}/janela-inscricao`
function Switch() { const navigate = useNavigate(); return <button onClick={() => navigate(route.replace(id, other))}>Trocar ocorrência de teste</button> }
function show(path = route) { return render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><Switch/><App/></AuthContext.Provider></MemoryRouter>) }
function server(handler?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined, permissions = ['EVENT_VIEW', 'EVENT_EDIT']) {
  let current = before
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init); if (custom !== undefined) return custom
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-WINDOW-CSRF', token: 'fixture' })
    if (url.includes('/authorization?')) return json({ allowed: permissions.includes(new URL(url, 'https://example.test').searchParams.get('permissionCode') ?? '') })
    if (init.method === 'PUT') { current = { ...before, ...JSON.parse(init.body as string), revision: 8 }; return json(current) }
    if (init.method === 'DELETE') { current = { ...absent, revision: 8 }; return json(current) }
    if (url.endsWith('/registration-window')) return json(current)
    if (url.endsWith(`/occurrences/${id}`)) return json({ ...occurrence, revision: current.revision })
    throw new Error('Unexpected fixture request')
  }); vi.stubGlobal('fetch', fetcher); return fetcher
}
const writes = (fetcher: ReturnType<typeof server>) => fetcher.mock.calls.filter(([, init]) => ['PUT', 'DELETE'].includes(init?.method))
async function prepare() { fireEvent.change(await screen.findByLabelText('Fechamento da inscrição'), { target: { value: occurrence.startsAt } }); fireEvent.click(screen.getByRole('button', { name: 'Revisar janela de inscrição' })) }
async function confirm() { await prepare(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar gravação da janela' })) }
afterEach(() => api.clear())

describe('contrato de janela de inscrição', () => {
  it('projeta legado ausente sem inventar limites ou propagar campos privados', async () => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue({ ...absent, people: 'private' })
    expect(await readWindow(church, id, undefined, client)).toEqual(absent)
  })
  it.each([{ churchId: other }, { occurrenceId: other }, { revision: -1 }, { revision: 1.5 }, { configured: false }, { configured: 'true' }, { opensAt: null }, { closesAt: opensAt }, { opensAt: '2032-01-01T10:00:00.0000001Z' }])('rejeita snapshot inválido %j', async patch => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue({ ...before, ...patch }); await expect(readWindow(church, id, undefined, client)).rejects.toThrow()
  })
  it.each([{ opensAt: '' }, { closesAt: '' }, { opensAt: '2032-02-30T10:00:00Z' }, { opensAt: '2032-01-01T10:00:00' }, { closesAt: opensAt }, { closesAt: '2032-01-01T09:00:00Z' }, { closesAt: '2032-01-01T11:00:00.0000001Z' }])('recusa intervalo inválido %j', patch => {
    expect(() => validateWindow({ opensAt, closesAt, ...patch })).toThrow()
  })
  it('compara microssegundos além da precisão de Date e preserva offsets explícitos', () => {
    const value = { opensAt: '2032-01-01T07:00:00.000001-03:00', closesAt: '2032-01-01T10:00:00.000002Z' }
    expect(validateWindow(value)).toEqual(value)
    expect(() => validateWindow({ ...value, closesAt: '2032-01-01T10:00:00.000000Z' })).toThrow()
  })
  it('PUT envia somente limites e revisão compartilhada', async () => {
    const client = new ApiClient(), request = vi.spyOn(client, 'request').mockResolvedValue(result)
    expect(await writeWindow(church, id, before, occurrence, { ...next, private: 'secret' } as typeof next, undefined, client)).toEqual(result)
    expect(request).toHaveBeenCalledWith(expect.stringContaining('/registration-window'), { method: 'PUT', headers: { 'X-Expected-Revision': '7', 'Content-Type': 'application/json' }, body: JSON.stringify(next), signal: undefined })
  })
  it('DELETE sem corpo confirma ausência e incremento', async () => {
    const client = new ApiClient(), request = vi.spyOn(client, 'request').mockResolvedValue({ ...absent, revision: 8 })
    await writeWindow(church, id, before, occurrence, null, undefined, client)
    expect(request).toHaveBeenCalledWith(expect.any(String), { method: 'DELETE', headers: { 'X-Expected-Revision': '7' }, signal: undefined })
  })
  it('no-op reconhece instante equivalente em outro offset e revisão inalterada', async () => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue(before)
    expect((await writeWindow(church, id, before, occurrence, { opensAt: '2032-01-01T07:00:00.000001-03:00', closesAt }, undefined, client)).revision).toBe(7)
    vi.mocked(client.request).mockResolvedValue(absent)
    expect((await writeWindow(church, id, absent, occurrence, null, undefined, client)).revision).toBe(7)
  })
  it.each([{ revision: 7 }, { revision: 9 }, { occurrenceId: other }, { configured: false, opensAt: null, closesAt: null }, { closesAt }])('não confirma resultado incompatível %j', async patch => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue({ ...result, ...patch }); await expect(writeWindow(church, id, before, occurrence, next, undefined, client)).rejects.toThrow()
  })
  it.each([{ participationMode: 'OPEN_EVENT' as const }, { participationMode: null }, { revision: 8 }, { id: other }, { startsAt: opensAt }])('não escreve contra ocorrência incompatível %j', async patch => {
    const client = new ApiClient(), request = vi.spyOn(client, 'request')
    await expect(writeWindow(church, id, before, { ...occurrence, ...patch }, next, undefined, client)).rejects.toThrow(); expect(request).not.toHaveBeenCalled()
  })
})

describe('administração autorizada da janela', () => {
  it('configura ocorrência publicada com limite inclusivo, confirmação, CSRF e nova consulta', async () => {
    const fetcher = server(); await api.login('ana', 'fixture-password'); show(); await prepare()
    expect(writes(fetcher)).toHaveLength(0); expect(screen.getByText('Revisão compartilhada original: 7.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar gravação da janela' }))
    expect(await screen.findByText('Janela configurada confirmada pelo servidor na revisão 8.')).toBeInTheDocument()
    await screen.findByText('Revisão compartilhada consultada: 8.')
    const init = writes(fetcher)[0][1]; expect(init.headers.get('X-WINDOW-CSRF')).toBe('fixture'); expect(init.headers.get('X-Expected-Revision')).toBe('7'); expect(JSON.parse(init.body)).toEqual(next)
    expect(fetcher.mock.calls.some(([url]) => /\/publish|\/registrations|\/accounts\/people/.test(url))).toBe(false)
  })
  it('remoção explícita não cria janela pública ilimitada e não envia corpo', async () => {
    const fetcher = server(); await api.login('ana', 'fixture-password'); show()
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar remoção da janela' }))
    expect(screen.getByText(/Os dois limites serão removidos/)).toBeInTheDocument(); expect(writes(fetcher)).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar remoção da janela' }))
    await screen.findByText('Janela removida confirmada pelo servidor na revisão 8.')
    expect(writes(fetcher)[0][1].method).toBe('DELETE'); expect(writes(fetcher)[0][1].body).toBeUndefined()
    await screen.findByText('Janela não configurada. Ausência não significa inscrição pública ilimitada.')
  })
  it('legado permanece com ambos campos vazios e sem remoção automática', async () => {
    const fetcher = server(url => url.endsWith('/registration-window') ? json(absent) : undefined); show()
    expect(await screen.findByLabelText('Abertura da inscrição')).toHaveValue(''); expect(screen.getByLabelText('Fechamento da inscrição')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Revisar remoção da janela' })).not.toBeInTheDocument(); expect(writes(fetcher)).toHaveLength(0)
  })
  it.each(['OPEN_EVENT', null])('modo %s não oferece configuração de limites', async mode => {
    const fetcher = server(url => url.endsWith(`/occurrences/${id}`) ? json({ ...occurrence, participationMode: mode, ...(mode === null && { modality: null, checkInRequired: null, configured: false }) }) : undefined); show()
    await screen.findByText(/Configuração indisponível/); expect(screen.queryByLabelText('Abertura da inscrição')).not.toBeInTheDocument(); expect(writes(fetcher)).toHaveLength(0)
  })
  it.each(['2032-01-01T12:00:00.000001Z', opensAt, '2032-01-01T11:00:00', '2032-01-01T11:00:00.0000001Z'])('bloqueia fechamento inválido %s antes de confirmar', async value => {
    const fetcher = server(); show(); fireEvent.change(await screen.findByLabelText('Fechamento da inscrição'), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: 'Revisar janela de inscrição' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Confirmar gravação da janela' })).not.toBeInTheDocument(); expect(writes(fetcher)).toHaveLength(0)
  })
  it.each([['EVENT_VIEW'], ['EVENT_VIEW', 'EVENT_PUBLISH']])('permissões %j não oferecem escrita', async (...permissions) => {
    const fetcher = server(undefined, permissions as string[]); show(); await screen.findByText('Revisão compartilhada consultada: 7.')
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.includes('EVENT_EDIT'))).toBe(true)); expect(screen.queryByLabelText('Abertura da inscrição')).not.toBeInTheDocument(); expect(writes(fetcher)).toHaveLength(0)
  })
  it('EDIT sem VIEW não consulta dados', async () => {
    const fetcher = server(undefined, ['EVENT_EDIT']); show(); expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado'); expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
  })
  it('revisões diferentes entre GETs bloqueiam editor', async () => {
    const fetcher = server(url => url.endsWith(`/occurrences/${id}`) ? json({ ...occurrence, revision: 8 }) : undefined); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os dados administrativos'); expect(screen.queryByLabelText('Abertura da inscrição')).not.toBeInTheDocument(); expect(writes(fetcher)).toHaveLength(0)
  })
  it('foco conserva valores mas descarta confirmação', async () => {
    server(); show(); await prepare(); fireEvent(window, new Event('focus')); expect(await screen.findByLabelText('Fechamento da inscrição')).toHaveValue(occurrence.startsAt); expect(screen.queryByRole('button', { name: 'Confirmar gravação da janela' })).not.toBeInTheDocument()
  })
  it('mudança de revisão exige descarte explícito sem atualizar rascunho silenciosamente', async () => {
    let revision = 7
    server(url => url.endsWith('/registration-window') ? json({ ...before, revision }) : url.endsWith(`/occurrences/${id}`) ? json({ ...occurrence, revision }) : undefined)
    show(); await prepare(); revision = 8; fireEvent(window, new Event('focus')); expect(await screen.findByRole('alert')).toHaveTextContent('revisão original foi preservada')
    fireEvent.click(screen.getByRole('button', { name: 'Descartar tentativa e recarregar janela' })); expect(await screen.findByLabelText('Fechamento da inscrição')).toHaveValue(closesAt)
  })
  it.each([403, 409, 422, 500])('erro %s exige consulta antes de repetir', async status => {
    const fetcher = server((_, init) => init.method === 'PUT' ? new Response('', { status }) : undefined); await api.login('ana', 'fixture-password'); show(); await confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Consulte os dados antes de outra tentativa'); expect(screen.getByRole('button', { name: 'Revisar janela de inscrição' })).toBeDisabled(); expect(writes(fetcher)).toHaveLength(1)
  })
  it('duplo clique e foco durante escrita não repetem operação', async () => {
    let resolve!: (v: Response) => void
    const fetcher = server((_, init) => init.method === 'PUT' ? new Promise<Response>(r => { resolve = r }) : undefined); await api.login('ana', 'fixture-password'); show(); await prepare()
    const button = screen.getByRole('button', { name: 'Confirmar gravação da janela' }); fireEvent.click(button); fireEvent.click(button); fireEvent(window, new Event('focus'))
    await waitFor(() => expect(writes(fetcher)).toHaveLength(1)); await screen.findByLabelText('Fechamento da inscrição'); expect(screen.getByRole('button', { name: 'Revisar janela de inscrição' })).toBeDisabled()
    await act(async () => resolve(json(result))); await screen.findByText('Janela configurada confirmada pelo servidor na revisão 8.'); expect(writes(fetcher)).toHaveLength(1)
  })
  it('troca de contexto aborta escrita e ignora resposta antiga', async () => {
    let signal: AbortSignal | null | undefined, resolve!: (v: Response) => void
    server((url, init) => {
      if (init.method === 'PUT') { signal = init.signal; return new Promise<Response>(r => { resolve = r }) }
      if (url.includes(`/occurrences/${other}`)) return new Response('', { status: 404 })
    }); await api.login('ana', 'fixture-password'); show(); await confirm(); await waitFor(() => expect(signal).toBeDefined()); fireEvent.click(screen.getByRole('button', { name: 'Trocar ocorrência de teste' }))
    await waitFor(() => expect(signal?.aborted).toBe(true)); await act(async () => resolve(json(result))); expect(screen.queryByText(/Janela configurada confirmada/)).not.toBeInTheDocument()
  })
  it('perda de VIEW esconde valores e rascunho', async () => {
    let allowed = true
    server(url => url.includes('/authorization?') ? json({ allowed }) : undefined); show(); await prepare(); allowed = false; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado'); expect(screen.queryByLabelText('Abertura da inscrição')).not.toBeInTheDocument(); expect(screen.queryByText(opensAt)).not.toBeInTheDocument()
  })
  it('link do detalhe usa contexto autorizado', async () => {
    server(); show(route.replace('/janela-inscricao', '')); fireEvent.click(await screen.findByRole('link', { name: 'Consultar janela de inscrição' })); expect(await screen.findByLabelText('Abertura da inscrição')).toHaveValue(opensAt)
  })
  it('URL inválida não consulta backend', async () => {
    const fetcher = server(); show(route.replace(church, 'invalid')); expect(await screen.findByRole('alert')).toHaveTextContent('Acesso inválido'); expect(fetcher).not.toHaveBeenCalled()
  })
})
