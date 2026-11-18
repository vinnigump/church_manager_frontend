import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth'
import EventAccess from './EventAccess'

const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const churchA = { resourceType: 'CHURCH', resourceId: '20000000-0000-0000-0000-000000000001', label: 'Igreja A' }
const churchB = { resourceType: 'CHURCH', resourceId: '20000000-0000-0000-0000-000000000002', label: 'Igreja B' }
const denomination = { resourceType: 'DENOMINATION', resourceId: '30000000-0000-0000-0000-000000000001', label: 'Denominação D' }
const response = (value: unknown) => new Response(JSON.stringify(value))
function tree(current: typeof account | null = account) {
  return <MemoryRouter><AuthContext.Provider value={{ account: current, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><EventAccess /></AuthContext.Provider></MemoryRouter>
}
function mockAccess(contexts = [churchA, churchB, denomination], allowed = [churchA.resourceId]) {
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/authorization/contexts')) return response({ contexts })
    const query = new URL(url, 'https://example.test').searchParams
    expect(query.get('permissionCode')).toBe('EVENT_VIEW')
    expect(query.get('resourceType')).toBe('CHURCH')
    return response({ allowed: allowed.includes(query.get('resourceId') ?? '') })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

describe('acessos reais à gestão de eventos', () => {
  it('mostra somente igrejas com EVENT_VIEW, sem seleção global ou calendário anual', async () => {
    const fetcher = mockAccess()
    render(tree())
    expect(await screen.findByRole('link', { name: 'Consultar eventos de Igreja A' })).toHaveAttribute('href', `/eventos/igrejas/${churchA.resourceId}/cadastro`)
    expect(screen.queryByText(churchB.label)).not.toBeInTheDocument()
    expect(screen.queryByText(denomination.label)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /publicar|calendário anual/i })).not.toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
  it('distingue ausência de EVENT_VIEW de ausência de contextos sem conceder acesso', async () => {
    mockAccess([churchA], [])
    render(tree())
    expect(await screen.findByRole('status')).toHaveTextContent(/Carregando|ainda não tem acesso/)
    await screen.findByText('Você ainda não tem acesso à gestão de eventos de uma igreja.')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
  it('falha de uma decisão não apresenta uma lista parcialmente autorizada', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/contexts')) return response({ contexts: [churchA, churchB] })
      return url.includes(churchA.resourceId) ? response({ allowed: true }) : new Response('detalhe-sensivel', { status: 503 })
    }))
    render(tree())
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText('detalhe-sensivel')).not.toBeInTheDocument()
  })
  it('invalida acessos ao foco e remove igreja cuja concessão foi revogada', async () => {
    mockAccess([churchA])
    render(tree())
    await screen.findByRole('link', { name: 'Consultar eventos de Igreja A' })
    mockAccess([churchA], [])
    fireEvent.focus(window)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    await screen.findByText('Você ainda não tem acesso à gestão de eventos de uma igreja.')
  })
  it('descarta descoberta tardia após atualização e propaga cancelamento', async () => {
    let finish!: (value: Response) => void
    const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() => new Promise(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', fetcher)
    render(tree())
    mockAccess([churchB], [churchB.resourceId])
    fireEvent.focus(window)
    await screen.findByRole('link', { name: 'Consultar eventos de Igreja B' })
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true)
    await act(async () => { finish(response({ contexts: [churchA] })) })
    expect(screen.queryByText(churchA.label)).not.toBeInTheDocument()
  })
  it('limpa acessos ao trocar a sessão, inclusive ao retornar à mesma conta', async () => {
    mockAccess([churchA])
    const view = render(tree())
    await screen.findByRole('link', { name: 'Consultar eventos de Igreja A' })
    mockAccess([churchB], [churchB.resourceId])
    view.rerender(tree({ ...account }))
    expect(screen.queryByText(churchA.label)).not.toBeInTheDocument()
    await screen.findByRole('link', { name: 'Consultar eventos de Igreja B' })
    view.rerender(tree(null))
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
  it('permite recuperar uma descoberta que falhou sem manter opções antigas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(tree())
    await screen.findByRole('alert')
    mockAccess([churchA])
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    await screen.findByRole('link', { name: 'Consultar eventos de Igreja A' })
  })
})
