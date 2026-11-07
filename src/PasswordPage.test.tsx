import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { api } from './api'
import { AuthContext, AuthProvider } from './auth'

const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'ana', status: 'ACTIVE' }
const json = (value: unknown) => new Response(JSON.stringify(value))
afterEach(() => api.clear())
async function show() {
  render(<MemoryRouter initialEntries={['/conta/senha']}><AuthProvider><App/></AuthProvider></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'ana' } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'old-password' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)
  await screen.findByLabelText('Senha atual')
}
function server(status = 204) {
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/accounts/me')) return json(account)
    if (url.endsWith('/csrf')) return json({ headerName: 'X-CUSTOM-CSRF', token: 'controlled-token' })
    return new Response(null, { status })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function submit(password = 'new-password-123', confirmation = password) {
  fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'old-password' } })
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: confirmation } })
  fireEvent.submit(screen.getByRole('button', { name: 'Alterar senha' }).closest('form')!)
}
describe('alteração da própria senha', () => {
  it('autentica, envia comando com CSRF e exige novo login após sucesso', async () => {
    const fetcher = server(); await show(); submit()
    expect(await screen.findByText('Senha alterada. Entre novamente com a nova senha.')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toHaveValue('')
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][]
    const [, init] = calls.find(([url]) => url.endsWith('/password'))!
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ currentPassword: 'old-password', newPassword: 'new-password-123' })
    expect(new Headers(init.headers).get('X-CUSTOM-CSRF')).toBe('controlled-token')
    expect(init.credentials).toBe('same-origin')
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
    expect(document.title).toBe('Entrar | Church Manager')
  })
  it.each(['short', 'é'.repeat(37), ' '.repeat(12)])('valida limite e bytes da nova senha', async password => {
    const fetcher = server(); await show(); submit(password)
    expect(await screen.findByRole('alert')).toHaveTextContent('até 72 bytes')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('Senha atual')).toHaveValue('')
  })
  it('confirmação diferente não envia comando', async () => {
    const fetcher = server(); await show(); submit('new-password-123', 'other-password')
    expect(screen.getByRole('alert')).toHaveTextContent('confirmação')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it.each([400, 403, 404, 409])('erro conhecido %s não anuncia sucesso nem repete automaticamente', async status => {
    const fetcher = server(status); await show(); submit()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alterar senha' })).toBeEnabled()
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(screen.getByLabelText('Nova senha')).toHaveValue('')
  })
  it('401 encerra a sessão', async () => {
    server(401); await show(); submit()
    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeInTheDocument()
  })
  it.each(['network', '500', 'schema'])('resultado incerto %s bloqueia repetição e permite encerrar sessão', async mode => {
    const fetcher = server(); await show()
    fetcher.mockImplementation(async () => {
      if (mode === 'network') throw new Error('sensitive-details')
      return mode === '500' ? new Response(null, { status: 500 }) : json({ unexpected: true })
    })
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar')
    expect(screen.getByRole('button', { name: 'Alterar senha' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar sessão local e entrar novamente' }))
    expect(await screen.findByText('Resultado da alteração não confirmado. Entre com a senha válida para continuar.')).toBeInTheDocument()
    expect(screen.queryByText('sensitive-details')).not.toBeInTheDocument()
  })
  it('trava duplo envio e limpa campos durante a requisição', async () => {
    const fetcher = server(); await show()
    let finish!: (value: Response) => void
    fetcher.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    submit()
    const form = screen.getByRole('button', { name: 'Alterando senha…' }).closest('form')!
    fireEvent.submit(form)
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(screen.getByLabelText('Nova senha')).toHaveValue('')
    await act(async () => finish(new Response(null, { status: 204 })))
    await waitFor(() => expect(screen.getByLabelText('Login')).toBeInTheDocument())
  })
  it('oferece acesso a partir de Minha conta', async () => {
    render(<MemoryRouter initialEntries={['/conta']}><AuthContext.Provider value={{ account, grants: [], expired: false, login: vi.fn(), logout: vi.fn() }}><App/></AuthContext.Provider></MemoryRouter>)
    fireEvent.click(screen.getByRole('link', { name: 'Alterar minha senha' }))
    expect(screen.getByRole('heading', { name: 'Alterar minha senha' })).toBeInTheDocument()
  })
})
