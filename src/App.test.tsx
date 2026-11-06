import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthContext, AuthProvider, hasGrant } from './auth'
import { api } from './api'

function show(path: string) { return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>) }
describe('navegação e autorização', () => {
  async function signIn() {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(
      url.endsWith('/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' }
        : { id: '1', personId: '2', login: 'ana', status: 'ACTIVE' }))))
    show('/conta')
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)
    expect(await screen.findByText('Conectado como ana.')).toBeInTheDocument()
  }
  it('navega para conta após login e bloqueia novamente após sair', async () => {
    await signIn()
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByText('Conectado como ana.')).not.toBeInTheDocument()
  })
  it('remove a conta protegida quando o backend retorna 401', async () => {
    await signIn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))
    await act(async () => { await expect(api.request('/accounts/me')).rejects.toMatchObject({ status: 401 }) })
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou')
    expect(screen.queryByText('Conectado como ana.')).not.toBeInTheDocument()
  })
  it('bloqueia acesso anônimo', () => { show('/admin'); expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument() })
  it('exibe página não encontrada', () => { show('/inexistente'); expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument() })
  it('exige permissão no escopo exato', () => {
    expect(hasGrant([{ permission: 'read', scope: 'church:1' }], 'read', 'church:2')).toBe(false)
    expect(hasGrant([{ permission: 'read', scope: 'church:1' }], 'read', 'church:1')).toBe(true)
  })
  it('não infere autoridade administrativa de conta autenticada', () => {
    render(<MemoryRouter initialEntries={['/admin']}><AuthContext.Provider value={{ account: { id: '1', personId: '2', login: 'ana', status: 'ACTIVE' }, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App /></AuthContext.Provider></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('Acesso indisponível')
  })
  it('apresenta loading e erro de autenticação', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve })))
    show('/entrar')
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)
    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()
    finish(new Response(null, { status: 401 }))
    expect(await screen.findByRole('alert')).toHaveTextContent('credenciais inválidas')
  })
})
