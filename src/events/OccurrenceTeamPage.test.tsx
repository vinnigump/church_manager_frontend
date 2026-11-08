import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ApiClient } from '../api'
import { AuthContext } from '../auth'
import { readOccurrenceTeam } from './team-api'

const church = '00000000-0000-0000-0000-000000000001'
const occurrence = '00000000-0000-0000-0000-000000000002'
const member = '00000000-0000-0000-0000-000000000003'
const assignment = '00000000-0000-0000-0000-000000000004'
const account = { id: member, personId: member, login: 'ana', status: 'ACTIVE' }
const item = { id: assignment, membershipId: member, role: 'COORDINATOR', assignedAt: '2032-01-01T13:00:00.000001Z', releasedAt: null, eligible: true }
const page = { occurrenceId: occurrence, revision: 7, items: [item], page: 0, size: 20, total: 1 }
const route = `/eventos/igrejas/${church}/ocorrencias/${occurrence}/equipe`
const json = (v: unknown) => new Response(JSON.stringify(v))
function show(path = route) { return render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>) }
function backend(handler?: (url: string) => Response | Promise<Response> | undefined, allowed = true) {
  const fetcher = vi.fn().mockImplementation(async (url: string) => {
    const custom = handler?.(url); if (custom !== undefined) return custom
    if (url.includes('/authorization?')) return json({ allowed })
    if (url.includes('/team?')) return json(page)
    throw new Error('Unexpected fixture request')
  }); vi.stubGlobal('fetch', fetcher); return fetcher
}
afterEach(() => api.clear())

describe('contrato de histórico da equipe', () => {
  it('projeta somente contrato autorizado com página, sinal e contexto exatos', async () => {
    const client = new ApiClient(); const controller = new AbortController()
    const request = vi.spyOn(client, 'request').mockResolvedValue({ ...page, privateUrl: 'private', items: [{ ...item, name: 'private' }] })
    expect(await readOccurrenceTeam(church, occurrence, 0, controller.signal, client)).toEqual(page)
    expect(request).toHaveBeenCalledWith(`/events/churches/${church}/occurrences/${occurrence}/team?page=0&size=20`, { signal: controller.signal })
  })
  it('preserva liberada com fração menor que milissegundo sem confundir ordem', async () => {
    const client = new ApiClient(); const released = { ...item, releasedAt: '2032-01-01T13:00:00.000002Z', eligible: false }
    vi.spyOn(client, 'request').mockResolvedValue({ ...page, items: [released] })
    expect((await readOccurrenceTeam(church, occurrence, 0, undefined, client)).items).toEqual([released])
  })
  it.each([{ occurrenceId: member }, { revision: -1 }, { revision: 0.1 }, { total: -1 }, { total: 2 }, { page: 1 }, { size: 10 }, { items: null },
    { items: [{ ...item, id: 'bad' }] }, { items: [{ ...item, membershipId: null }] }, { items: [{ ...item, role: 'OWNER' }] },
    { items: [{ ...item, assignedAt: '2032-02-30T13:00:00Z' }] }, { items: [{ ...item, eligible: 'true' }] },
    { items: [{ ...item, releasedAt: undefined }] }, { items: [{ ...item, releasedAt: '2032-01-01T13:00:00.000000Z', eligible: false }] },
    { items: [{ ...item, releasedAt: item.assignedAt }] }, { items: [item, item], total: 2 },
  ])('recusa resposta incompatível %j sem filtrar silenciosamente', async patch => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue({ ...page, ...patch })
    await expect(readOccurrenceTeam(church, occurrence, 0, undefined, client)).rejects.toThrow('validar')
  })
  it.each([-1, 0.5, 100001, NaN])('recusa página %s antes de consultar', async value => {
    const client = new ApiClient(); const request = vi.spyOn(client, 'request')
    await expect(readOccurrenceTeam(church, occurrence, value, undefined, client)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
  it('aceita página vazia além do total após alteração concorrente', async () => {
    const client = new ApiClient(); vi.spyOn(client, 'request').mockResolvedValue({ ...page, page: 1, items: [] })
    expect((await readOccurrenceTeam(church, occurrence, 1, undefined, client)).total).toBe(1)
  })
})

describe('consulta administrativa da equipe', () => {
  it('mostra papel, histórico e elegibilidade sem inferir contagem global', async () => {
    backend(); show()
    expect(await screen.findByRole('heading', { name: 'Coordenação' })).toBeInTheDocument()
    expect(screen.getByText('Elegível nesta consulta', { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/incluindo liberadas/)).toHaveTextContent('1 atribuições')
    expect(screen.getByText(/não conta toda a equipe ativa/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Atribuir|Liberar/ })).not.toBeInTheDocument()
  })
  it('mantém página selecionada em foco e revalida autorização antes do GET', async () => {
    const full = Array.from({ length: 20 }, (_, index) => ({ ...item, id: `00000000-0000-0000-0000-${String(index + 10).padStart(12, '0')}` }))
    const fetcher = backend(url => url.includes('/team?') ? json(url.includes('page=1') ? { ...page, page: 1, total: 21, items: [{ ...item, role: 'SUPPORT', releasedAt: item.assignedAt, eligible: false }] } : { ...page, total: 21, items: full }) : undefined)
    show(); await screen.findAllByRole('heading', { name: 'Coordenação' })
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(await screen.findByRole('heading', { name: 'Apoio' })).toBeInTheDocument()
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('heading', { name: 'Apoio' })).toBeInTheDocument()
    expect(fetcher.mock.calls.filter(([url]) => url.includes('/team?')).at(-1)?.[0]).toContain('page=1')
  })
  it('nega sem EVENT_VIEW e não consulta negócio', async () => {
    const fetcher = backend(undefined, false); show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher.mock.calls.every(([url]) => url.includes('/authorization?'))).toBe(true)
  })
  it('valida URL antes de solicitar autorização', () => {
    const fetcher = backend(); show(route.replace(church, 'invalid'))
    expect(screen.getByRole('alert')).toHaveTextContent('acesso à equipe é inválido')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([403, 404, 500])('mostra erro %s sem dados inventados', async status => {
    backend(url => url.includes('/team?') ? new Response(null, { status }) : undefined); show()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Coordenação' })).not.toBeInTheDocument()
  })
  it('mostra vazio legítimo', async () => {
    backend(url => url.includes('/team?') ? json({ ...page, items: [], total: 0 }) : undefined); show()
    expect(await screen.findByText('Nenhuma atribuição nesta página.')).toBeInTheDocument()
  })
  it('reautorização negada remove dados anteriormente consultados', async () => {
    let allowed = true
    backend(url => url.includes('/authorization?') ? json({ allowed }) : undefined); show()
    await screen.findByRole('heading', { name: 'Coordenação' }); allowed = false; fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Coordenação' })).not.toBeInTheDocument())
  })
})
