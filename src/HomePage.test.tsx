import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './auth'
import { api } from './api'

function Probe() { const location = useLocation(); return <span data-testid="route">{location.pathname}</span> }
function show(path = '/') {
  const fetcher = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url.endsWith('/csrf')
    ? { headerName: 'X-CSRF-TOKEN', token: 'synthetic' }
    : { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' })))
  vi.stubGlobal('fetch', fetcher)
  render(<MemoryRouter initialEntries={[path]}><AuthProvider><Probe /><App /></AuthProvider></MemoryRouter>)
  return fetcher
}
function signIn() {
  fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'ana' } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'synthetic-password' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)
}
describe('Home pública e autenticada', () => {
  it.each(['/', '/entrar', '/entrar/'])('mostra somente acesso e marca ao visitante em %s, sem requisições', path => {
    const fetcher = show(path)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'RIO' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Minha conta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
    expect(document.title).toBe('Entrar | Church Manager')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each(['/', '/entrar'])('autentica a partir de %s e abre Home com navegação, título e foco', async path => {
    show(path)
    signIn()
    expect(await screen.findByRole('heading', { name: 'Bem-vindo' })).toBeInTheDocument()
    expect(screen.getByTestId('route')).toHaveTextContent(/^\/$/)
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
    expect(within(screen.getByRole('navigation', { name: 'Principal' })).getAllByRole('link')).toHaveLength(3)
    expect(document.title).toBe('Início | Church Manager')
    expect(screen.getByRole('main')).toHaveFocus()
  })
  it.each(['Sair', 'Sair da conta'])('saída %s volta à Home pública e não restaura Minha conta no próximo login', async action => {
    show()
    signIn()
    await screen.findByRole('heading', { name: 'Bem-vindo' })
    fireEvent.click(screen.getByRole('link', { name: /^Acessar minha conta/ }))
    fireEvent.click(screen.getByRole('button', { name: action }))
    expect(screen.getByTestId('route')).toHaveTextContent(/^\/$/)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    signIn()
    await screen.findByRole('heading', { name: 'Bem-vindo' })
    expect(screen.getByTestId('route')).toHaveTextContent(/^\/$/)
  })
  it('oculta imediatamente a Home interna e menus quando a sessão expira', async () => {
    show()
    signIn()
    await screen.findByRole('heading', { name: 'Bem-vindo' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))
    await act(async () => { await expect(api.request('/accounts/me')).rejects.toMatchObject({ status: 401 }) })
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Ver eventos/ })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou')
    expect(document.title).toBe('Entrar | Church Manager')
  })
})
