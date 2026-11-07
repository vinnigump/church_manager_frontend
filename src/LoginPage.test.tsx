import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from './auth'
import LoginPage from './LoginPage'
import AccountPage from './AccountPage'

function showLogin(login = vi.fn().mockResolvedValue(undefined), notice?: 'changed' | 'uncertain') {
  render(<MemoryRouter><AuthContext.Provider value={{ account: null, grants: [], expired: false, passwordNotice: notice, login, logout: vi.fn() }}><LoginPage /></AuthContext.Provider></MemoryRouter>)
  return login
}
describe('acesso aprovado UI-RIO-03', () => {
  it('alterna a visibilidade sem enviar ou alterar a senha', () => {
    const login = showLogin()
    const password = screen.getByLabelText('Senha')
    fireEvent.change(password, { target: { value: 'synthetic-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('synthetic-password')
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true')
    expect(login).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(password).toHaveAttribute('type', 'password')
  })
  it('bloqueia envio duplicado e oculta/limpa senha após falha', async () => {
    let reject!: (reason: Error) => void
    const login = showLogin(vi.fn().mockImplementation(() => new Promise<void>((_, fail) => { reject = fail })))
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'synthetic' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'synthetic-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    const form = screen.getByRole('button', { name: 'Entrar' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(login).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeDisabled()
    await act(async () => { reject(new Error('Não foi possível entrar.')) })
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível entrar.')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })
  it.each([
    ['changed', 'Senha alterada. Entre novamente com a nova senha.'],
    ['uncertain', 'Resultado da alteração não confirmado. Entre com a senha válida para continuar.'],
  ] as const)('preserva aviso de senha %s no novo painel', (notice, text) => {
    showLogin(undefined, notice)
    expect(screen.getByRole('status')).toHaveTextContent(text)
  })
  it('apresenta conta real e preserva alteração de senha e saída sem argumentos', () => {
    const logout = vi.fn()
    render(<MemoryRouter><AuthContext.Provider value={{ account: { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'conta.real', status: 'ACTIVE' }, grants: [], expired: false, login: vi.fn(), logout }}><AccountPage /></AuthContext.Provider></MemoryRouter>)
    expect(screen.getByText('Conectado como conta.real.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Alterar minha senha' })).toHaveAttribute('href', '/conta/senha')
    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))
    expect(logout).toHaveBeenCalledExactlyOnceWith()
  })
})
