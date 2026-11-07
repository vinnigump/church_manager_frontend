import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from './api'
import { AuthContext, AuthProvider, useAuth } from './auth'
import { consultAuthorization, ResourceAccess, type AuthorizationQuery } from './authorization'

const query: AuthorizationQuery = { permissionCode: 'EVENT_VIEW', resourceType: 'CHURCH', resourceId: '00000000-0000-0000-0000-000000000001' }
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
function response(allowed: boolean) { return new Response(JSON.stringify({ allowed })) }
function tree(current: typeof account | null = account, resourceId = query.resourceId) {
  return <MemoryRouter><AuthContext.Provider value={{ account: current, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><Routes><Route path="/" element={<ResourceAccess {...query} resourceId={resourceId}><h1>Conteúdo protegido</h1></ResourceAccess>}/><Route path="/entrar" element={<h1>Entrar</h1>}/></Routes></AuthContext.Provider></MemoryRouter>
}

describe('contrato de própria decisão', () => {
  it('usa os parâmetros exatos sem enviar ator ou concessões locais', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(true)); vi.stubGlobal('fetch', fetcher)
    expect(await consultAuthorization(query)).toBe(true)
    const url = new URL(fetcher.mock.calls[0][0], 'https://example.test')
    expect(url.pathname).toBe('/api/v1/accounts/me/authorization')
    expect(Object.fromEntries(url.searchParams)).toEqual(query)
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store', credentials: 'same-origin' })
  })
  it('preserva Basic em memória na consulta real do cliente', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(
      url.includes('/authorization?') ? { allowed: true } : url.endsWith('/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'test' } : account)))
    vi.stubGlobal('fetch', fetcher)
    const client = new ApiClient()
    await client.login('ana', 'test-password')
    await consultAuthorization(query, undefined, client)
    expect(new Headers(fetcher.mock.calls[2][1].headers).get('Authorization')).toBe(`Basic ${btoa('ana:test-password')}`)
    client.clear()
  })
  it.each([{}, null, { allowed: 'true' }, { allowed: 1 }, { allowed: true, grants: [] }])('nega resposta fora do contrato %j', async decision => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(decision))))
    await expect(consultAuthorization(query)).rejects.toThrow('confirmar a permissão')
  })
})

describe('guarda por recurso', () => {
  it('não consulta para anônimo', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    render(tree(null))
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('bloqueia enquanto carrega e só exibe com allowed=true', async () => {
    let finish!: (value: Response) => void
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve })))
    render(tree())
    expect(screen.getByRole('status')).toHaveTextContent('Verificando permissão')
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
    await act(async () => { finish(response(true)) })
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
  })
  it('allowed=false não usa grants locais como fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(false)))
    render(tree())
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
  })
  it.each([400, 403, 404, 409, 422, 500])('nega erro HTTP %s', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('conteúdo privado', { status })))
    render(tree())
    expect(await screen.findByRole('alert')).toHaveTextContent('acesso permanece bloqueado')
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
    expect(screen.queryByText('conteúdo privado')).not.toBeInTheDocument()
  })
  it('permite repetir erro de rede sem presumir sucesso', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValue(response(false))
    vi.stubGlobal('fetch', fetcher)
    render(tree())
    fireEvent.click(await screen.findByRole('button', { name: 'Verificar novamente' }))
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('retira concessão antiga imediatamente na troca de recurso e ignora resposta atrasada', async () => {
    let finish!: (value: Response) => void
    const fetcher = vi.fn().mockResolvedValueOnce(response(true))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
      .mockResolvedValueOnce(response(false))
    vi.stubGlobal('fetch', fetcher)
    const view = render(tree())
    await screen.findByText('Conteúdo protegido')
    view.rerender(tree(account, '00000000-0000-0000-0000-000000000002'))
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
    view.rerender(tree(account, '00000000-0000-0000-0000-000000000003'))
    await screen.findByRole('alert')
    await act(async () => { finish(response(true)) })
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Acesso não autorizado')
  })
  it('não reaproveita decisão após nova sessão da mesma conta', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(true)).mockResolvedValueOnce(response(false))
    vi.stubGlobal('fetch', fetcher)
    const view = render(tree())
    await screen.findByText('Conteúdo protegido')
    view.rerender(tree({ ...account }))
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('reconsulta ao retomar foco e retira acesso revogado', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(true)).mockResolvedValueOnce(response(false))
    vi.stubGlobal('fetch', fetcher)
    render(tree())
    await screen.findByText('Conteúdo protegido')
    fireEvent(window, new Event('focus'))
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
  })
  it('401 invalida sessão pelo fluxo existente', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => url.includes('/authorization?')
      ? new Response(null, { status: 401 })
      : new Response(JSON.stringify(url.endsWith('/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'test' } : account)))
    vi.stubGlobal('fetch', fetcher)
    render(<MemoryRouter><AuthProvider><SessionTest/></AuthProvider></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }))
    expect(await screen.findByText('Sessão encerrada')).toBeInTheDocument()
  })
})

function SessionTest() {
  const { account: current, login, expired } = useAuth()
  return <>{!current && !expired && <button onClick={() => { void login('ana', 'test-password') }}>Conectar</button>}{expired ? <p>Sessão encerrada</p> : current && <ResourceAccess {...query}>Conteúdo protegido</ResourceAccess>}</>
}
