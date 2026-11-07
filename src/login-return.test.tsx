import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { api } from './api'
import { AuthProvider } from './auth'

const church = '00000000-0000-0000-0000-000000000001'
const path = `/eventos/igrejas/${church}/catalogo`
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const item = { id: '00000000-0000-0000-0000-000000000002', scopeType: 'DENOMINATION', name: 'Encontro autorizado', mandatory: true, enabled: true }
const json = (value: unknown) => new Response(JSON.stringify(value))
function server(allowed = true) {
  const fetcher = vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-CSRF-TOKEN', token: 'test' })
    if (url.includes('/authorization?')) return json({ allowed })
    return json({ items: [item], page: 0, size: 20, total: 1 })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function Probe() { const location = useLocation(); return <span data-testid="location">{JSON.stringify({ pathname: location.pathname, search: location.search, hash: location.hash, state: location.state })}</span> }
function show(pathname: string, state: unknown = null) {
  render(<MemoryRouter initialEntries={[{ pathname, state }]}><AuthProvider><Probe/><App/></AuthProvider></MemoryRouter>)
}
function signIn() {
  fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'ana' } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-password' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)
}

describe('retorno após autenticação', () => {
  it('volta ao catálogo solicitado após login e consulta permissão antes dos dados', async () => {
    const fetcher = server()
    show(path)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
    signIn()
    expect(await screen.findByText(item.name)).toBeInTheDocument()
    expect(JSON.parse(screen.getByTestId('location').textContent!).pathname).toBe(path)
    expect(fetcher.mock.calls.slice(0, 3).map(([url]) => url.split('?')[0])).toEqual(['/api/v1/accounts/me', '/api/v1/csrf', '/api/v1/accounts/me/authorization'])
    expect(document.title).toBe('Catálogo de eventos | Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
  })
  it('nega o catálogo quando a conta autenticada não tem permissão', async () => {
    const fetcher = server(false)
    show(path)
    signIn()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso não autorizado')
    expect(screen.queryByText(item.name)).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([url]) => url.includes('/events/churches/'))).toBe(false)
  })
  it('retorno à administração continua negado por padrão', async () => {
    server()
    show('/admin')
    signIn()
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso indisponível')
    expect(screen.queryByRole('heading', { name: 'Administração' })).not.toBeInTheDocument()
  })
  it('login direto sem destino usa Home logada', async () => {
    server()
    show('/entrar')
    signIn()
    expect(await screen.findByText('Conectado como ana.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bem-vindo' })).toBeInTheDocument()
    expect(JSON.parse(screen.getByTestId('location').textContent!).pathname).toBe('/')
  })
  it('login inválido preserva o destino para nova tentativa', async () => {
    const fetcher = server()
    fetcher.mockImplementationOnce(async () => new Response(null, { status: 401 }))
    show(path)
    signIn()
    expect(await screen.findByRole('alert')).toHaveTextContent('credenciais inválidas')
    expect(JSON.parse(screen.getByTestId('location').textContent!).state).toEqual({ returnTo: path })
    signIn()
    expect(await screen.findByText(item.name)).toBeInTheDocument()
  })
  it('sessão expirada permite reautenticar e voltar ao mesmo catálogo', async () => {
    const fetcher = server()
    show(path)
    signIn()
    await screen.findByText(item.name)
    const handler = fetcher.getMockImplementation()!
    fetcher.mockImplementationOnce(async () => new Response(null, { status: 401 }))
    await act(async () => { await expect(api.request('/accounts/me')).rejects.toMatchObject({ status: 401 }) })
    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou')
    expect(screen.queryByText(item.name)).not.toBeInTheDocument()
    fetcher.mockImplementation(handler)
    signIn()
    expect(await screen.findByText(item.name)).toBeInTheDocument()
  })
  it('não copia query, fragmento ou state anterior para o destino de login', async () => {
    server()
    render(<MemoryRouter initialEntries={[{ pathname: path, search: '?token=privado', hash: '#segredo', state: { secret: 'privado' } }]}><AuthProvider><Probe/><App/></AuthProvider></MemoryRouter>)
    expect(JSON.parse(screen.getByTestId('location').textContent!)).toEqual({ pathname: '/entrar', search: '', hash: '', state: { returnTo: path } })
    signIn()
    await screen.findByText(item.name)
    expect(screen.getByTestId('location')).not.toHaveTextContent(/privado|segredo/)
  })
  it.each([
    { returnTo: 'https://evil.test/path' }, { returnTo: '//evil.test/path' },
    { returnTo: '/\\evil.test' }, { returnTo: '/%2f%2fevil.test' },
    { returnTo: '/eventos?token=privado' }, { returnTo: '/eventos#privado' },
    { returnTo: '/entrar' }, { returnTo: '/entrar/' }, { returnTo: '/eventos\n' },
    { returnTo: '/a/../entrar' }, { returnTo: 123 }, [], 'invalid',
  ])('destino inválido %j recai em Home logada sem loop', async state => {
    server()
    show('/entrar', state)
    signIn()
    await screen.findByText('Conectado como ana.')
    await waitFor(() => expect(JSON.parse(screen.getByTestId('location').textContent!).pathname).toBe('/'))
  })
})
